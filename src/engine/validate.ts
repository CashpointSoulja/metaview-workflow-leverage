import type { EffortRow, HandoffPacket, Segment, Source, SourceKind, Workspace } from './types.ts';
import { LIMITS } from './types.ts';
import { isFiniteNumber, parseDay } from './util.ts';

export class Rejection extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export const reject = (code: string, message: string, status = 400): never => { throw new Rejection(status, code, message); };

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
export function text(v: unknown, field: string, max: number = LIMITS.textField, allowNewlines = false): string {
  if (typeof v !== 'string') return reject('invalid_field', `${field} must be text`);
  const t = v.trim();
  if (!t) return reject('invalid_field', `${field} is required`);
  if (t.length > max) return reject('too_long', `${field} is longer than ${max} characters`);
  if (CONTROL.test(t) || (!allowNewlines && /[\r\n]/.test(t))) return reject('invalid_field', `${field} contains control characters`);
  return t;
}
export function date(v: unknown, field: string): string {
  if (parseDay(v) === null) return reject('invalid_date', `${field} must be a real YYYY-MM-DD date`);
  return v as string;
}
export function intIn(v: unknown, field: string, lo: number, hi: number): number {
  if (!isFiniteNumber(v) || !Number.isInteger(v) || v < lo || v > hi) return reject('invalid_number', `${field} must be a whole number from ${lo} to ${hi}`);
  return v;
}
export function numIn(v: unknown, field: string, lo: number, hi: number): number {
  if (!isFiniteNumber(v) || v < lo || v > hi) return reject('invalid_number', `${field} must be a number from ${lo} to ${hi}`);
  return v;
}

const KINDS: SourceKind[] = ['order_form', 'call_note', 'crm_field', 'security_review', 'email_recap'];
const SEGMENTS: Segment[] = ['enterprise', 'mid-market', 'strategic'];
const PACKET_ID = /^HO-[A-Z0-9-]{1,20}$/;
const SOURCE_ID = /^SRC-[A-Z0-9-]{1,30}$/;

export function parseImportedPacket(v: unknown, i: number): HandoffPacket {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return reject('invalid_packet', `Packet ${i + 1} must be an object`);
  const o = v as Record<string, unknown>;
  const id = text(o.id, `Packet ${i + 1} id`);
  if (!PACKET_ID.test(id)) reject('invalid_packet', `Packet id ${JSON.stringify(id.slice(0, 40))} must look like HO-1234`);
  const segment = o.segment as Segment;
  if (!SEGMENTS.includes(segment)) reject('invalid_packet', `${id}: segment must be one of ${SEGMENTS.join(', ')}`);
  if (!Array.isArray(o.sources) || o.sources.length === 0) reject('invalid_packet', `${id}: sources must be a non-empty list`);
  const rawSources = o.sources as unknown[];
  if (rawSources.length > LIMITS.sourcesPerPacket) reject('too_many', `${id}: at most ${LIMITS.sourcesPerPacket} sources`);
  const seen = new Set<string>();
  const sources: Source[] = rawSources.map((s, j) => {
    if (!s || typeof s !== 'object') return reject('invalid_source', `${id} source ${j + 1} must be an object`);
    const so = s as Record<string, unknown>;
    const sid = text(so.id, `${id} source ${j + 1} id`);
    if (!SOURCE_ID.test(sid)) reject('invalid_source', `${id}: source id must look like SRC-1234-OF`);
    if (seen.has(sid)) reject('duplicate_id', `${id}: duplicate source id ${sid}`);
    seen.add(sid);
    if (!KINDS.includes(so.kind as SourceKind)) reject('invalid_source', `${sid}: kind must be one of ${KINDS.join(', ')}`);
    return { id: sid, kind: so.kind as SourceKind, capturedAt: date(so.capturedAt, `${sid} capturedAt`), author: text(so.author, `${sid} author`), text: text(so.text, `${sid} text`, LIMITS.sourceTextChars, true) };
  });
  return { id, account: text(o.account, `${id} account`), segment, closeDate: date(o.closeDate, `${id} closeDate`), ae: text(o.ae, `${id} ae`), sources, owner: null, checkpoint: null, resolutions: [], approval: null, execution: null };
}

export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', i = 0, quoted = false, wasQuoted = false;
  while (i < input.length) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') { if (input[i + 1] === '"') { cell += '"'; i += 2; continue; } quoted = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"') { if (cell.length || wasQuoted) reject('invalid_csv', `Unexpected quote on line ${rows.length + 1}`); quoted = true; wasQuoted = true; i++; continue; }
    if (ch === ',') { row.push(cell); cell = ''; wasQuoted = false; i++; continue; }
    if (ch === '\r' || ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; wasQuoted = false; i += ch === '\r' && input[i + 1] === '\n' ? 2 : 1; continue; }
    if (wasQuoted) reject('invalid_csv', `Text after closing quote on line ${rows.length + 1}`);
    cell += ch; i++;
  }
  if (quoted) reject('invalid_csv', 'Unclosed quote: the whole file was rejected and nothing was imported');
  if (cell.length || row.length || wasQuoted) { row.push(cell); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

export const EFFORT_HEADER = ['id', 'arm', 'segment', 'minutes', 'status'];
export function parseEffortCsv(csv: unknown): EffortRow[] {
  if (typeof csv !== 'string') return reject('invalid_csv', 'csv must be text');
  if (csv.length > 64 * 1024) reject('too_long', 'CSV is larger than 64 KB');
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  if (!rows.length) reject('invalid_csv', 'CSV is empty');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  if (header.join(',') !== EFFORT_HEADER.join(',')) reject('invalid_csv', `Header must be exactly: ${EFFORT_HEADER.join(',')}`);
  return rows.slice(1).map((r, i) => {
    const line = i + 2;
    if (r.length !== 5) return reject('invalid_csv', `Line ${line}: expected 5 columns, got ${r.length}`);
    const [id, arm, segment, minutes, status] = r.map((c) => c.trim());
    if (!/^[A-Za-z0-9-]{1,30}$/.test(id)) reject('invalid_csv', `Line ${line}: id must be 1-30 letters, digits or dashes`);
    if (arm !== 'baseline' && arm !== 'assisted') reject('invalid_csv', `Line ${line}: arm must be baseline or assisted`);
    if (!SEGMENTS.includes(segment as Segment)) reject('invalid_csv', `Line ${line}: segment must be one of ${SEGMENTS.join(', ')}`);
    if (status !== 'complete' && status !== 'partial') reject('invalid_csv', `Line ${line}: status must be complete or partial`);
    let m: number | null = null;
    if (minutes !== '') {
      if (!/^\d{1,4}$/.test(minutes) || Number(minutes) < 1 || Number(minutes) > 1000) reject('invalid_csv', `Line ${line}: minutes must be blank (unknown) or a whole number from 1 to 1000`);
      m = Number(minutes);
    }
    return { id, arm: arm as EffortRow['arm'], segment: segment as Segment, minutes: m, status: status as EffortRow['status'], packetId: null, origin: 'visitor' as const };
  });
}

/** Structural check used when loading stored state; anything unexpected triggers recovery. */
export function isWorkspace(v: unknown): v is Workspace {
  if (!v || typeof v !== 'object') return false;
  const w = v as Workspace;
  return w.schema === 1 && Number.isInteger(w.revision) && w.revision >= 1
    && Array.isArray(w.candidates) && Array.isArray(w.options) && w.options.length > 0 && Array.isArray(w.packets) && Array.isArray(w.effort)
    && w.packets.length <= LIMITS.packets && w.effort.length <= LIMITS.effortRows
    && w.packets.every((p) => p && typeof p.id === 'string' && Array.isArray(p.sources) && Array.isArray(p.resolutions) && typeof p.closeDate === 'string')
    && w.candidates.every((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
    && w.effort.every((r) => r && typeof r.id === 'string' && (r.minutes === null || isFiniteNumber(r.minutes)));
}
