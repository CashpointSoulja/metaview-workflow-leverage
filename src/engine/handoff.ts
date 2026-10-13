import type { Checkpoint, FieldId, HandoffPacket, Resolution, Source } from './types.ts';
import { dayToIso, fingerprint, parseDay } from './util.ts';

export const STALE_DAYS = 45;
export const CHECKPOINT_MIN_DAYS = 14;
export const CHECKPOINT_MAX_DAYS = 90;
export const OWNER_ROSTER = ['Dana Whitlock (CS, synthetic)', 'Marcus Oyelaran (CS, synthetic)', 'Ines Varga (CS, synthetic)'] as const;
export const CHECKPOINT_METRICS = [
  'Share of licensed interviewers with notes enabled',
  'Share of scheduled interviews captured',
  'Share of hiring managers who opened a report',
] as const;

export const FIELD_LABELS: Record<FieldId, string> = {
  ats: 'Applicant tracking system',
  seats: 'Licensed seats',
  goLive: 'Go-live date',
  sso: 'SSO requirement',
  videoTool: 'Video conferencing tool',
  recordingConsent: 'Recording consent posture',
  executiveSponsor: 'Executive sponsor',
  successCriterion: 'Customer success criterion',
};
export const FIELDS = Object.keys(FIELD_LABELS) as FieldId[];

const ATS = ['Greenhouse', 'Lever', 'Ashby', 'Workday', 'iCIMS', 'SmartRecruiters', 'Bullhorn', 'Teamtailor', 'BambooHR', 'Jobvite'];
const IDP = ['Okta', 'Azure AD', 'Google SSO', 'OneLogin', 'JumpCloud'];
const VIDEO = ['Zoom', 'Google Meet', 'Microsoft Teams', 'Webex'];
const alt = (xs: string[]) => xs.map((x) => x.replace(/ /g, '\\s+')).join('|');

interface Rule { field: FieldId; re: RegExp; norm: (m: RegExpExecArray) => string | null }

const canon = (list: string[], raw: string) => list.find((x) => x.toLowerCase() === raw.replace(/\s+/g, ' ').toLowerCase()) ?? null;

export const RULES: Rule[] = [
  { field: 'ats', re: new RegExp(`\\b(?:ATS|applicant tracking(?: system)?)\\b[^.;]*?\\b(${alt(ATS)})\\b`, 'gi'), norm: (m) => canon(ATS, m[1]) },
  { field: 'ats', re: new RegExp(`\\b(?:run|use|on)\\s+(${alt(ATS)})\\s+(?:as their|for their)\\s+ATS\\b`, 'gi'), norm: (m) => canon(ATS, m[1]) },
  { field: 'seats', re: /\b(\d{1,5})\s+(?:licensed\s+|interviewer\s+)?seats\b/gi, norm: (m) => { const n = Number(m[1]); return n > 0 && n <= 50000 ? String(n) : null; } },
  { field: 'goLive', re: /\bgo-live(?:\s+date)?\s*(?:is|:|of|on|by|=)?\s*(\d{4}-\d{2}-\d{2})\b/gi, norm: (m) => (parseDay(m[1]) === null ? null : m[1]) },
  { field: 'sso', re: new RegExp(`\\bSSO\\b[^.;]*?\\b(?:via|through|with|using|on)\\s+(${alt(IDP)})\\b`, 'gi'), norm: (m) => `Required via ${canon(IDP, m[1])}` },
  { field: 'sso', re: /\b(?:no SSO|SSO (?:is )?not required)\b/gi, norm: () => 'Not required' },
  { field: 'videoTool', re: new RegExp(`\\b(?:interviews?|calls?|meetings?)\\b[^.;]*?\\b(?:on|in|over|via|use|uses|using)\\s+(${alt(VIDEO)})\\b`, 'gi'), norm: (m) => canon(VIDEO, m[1]) },
  { field: 'recordingConsent', re: /\brecording consent(?: notice)?\s+(?:is\s+)?(required|not required)(?:\s+for\s+(EU|UK|US|all)\s+candidates)?/gi, norm: (m) => (m[1].toLowerCase() === 'required' ? `Required${m[2] ? ' for ' + m[2].toUpperCase().replace('ALL', 'all') + ' candidates' : ''}` : 'Not required') },
  { field: 'executiveSponsor', re: /\b[Ee]xec(?:utive)? [Ss]ponsor\s*(?:is|:)\s*([A-Z][a-z]+(?: [A-Z][a-z'-]+){0,2})/g, norm: (m) => m[1] },
  { field: 'successCriterion', re: /\bsuccess (?:looks like|criterion|criteria|means)\s*(?:is|are|:)?\s*([^.;\n]{8,160})/gi, norm: (m) => m[1].trim() },
];

export const INJECTION = /\b(ignore (?:all |the |any )?(?:previous |prior |above )?(?:instructions|rules|checklist|checks)|disregard (?:the |all )?(?:rules|checklist|instructions)|mark (?:this|the) (?:handoff|packet) (?:as )?ready|system prompt|you are now|override (?:the )?(?:checklist|rules|status))\b/i;

export interface Sentence { sourceId: string; start: number; end: number; text: string }

export function sentences(src: Source): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src.text))) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t) out.push({ sourceId: src.id, start: m.index + lead, end: m.index + lead + t.length, text: t });
  }
  return out;
}

export interface Match { field: FieldId; value: string; sourceId: string; quote: string; start: number; end: number; stale: boolean; capturedAt: string }

export type FieldStatus = 'RESOLVED' | 'MISSING' | 'STALE' | 'ABSTAIN';

export interface FieldResult {
  field: FieldId;
  label: string;
  status: FieldStatus;
  value: string | null;
  evidence: Match[];
  staleEvidence: Match[];
  candidates: string[];
  candidatesFingerprint: string;
  resolution: Resolution | null;
  note: string;
}

export interface Quarantined { sourceId: string; text: string; start: number; end: number }

export type PacketStatus = 'READY' | 'HOLD' | 'ABSTAIN';

export interface Gap { kind: 'missing' | 'stale' | 'contradiction' | 'owner' | 'checkpoint'; field: FieldId | 'owner' | 'checkpoint'; message: string; ask: string }

export interface PacketEvaluation {
  packetId: string;
  status: PacketStatus;
  fields: FieldResult[];
  gaps: Gap[];
  risks: string[];
  quarantined: Quarantined[];
  staleSources: string[];
  checkpointProblem: string | null;
  fingerprint: string;
  approvalValid: boolean;
  approvalStale: boolean;
}

export interface Ruleset { name: string; contradiction: 'abstain' | 'first-wins' }
export const STANDARD: Ruleset = { name: 'standard', contradiction: 'abstain' };
/** Deliberately broken for the eval demo only: silently picks the first value on contradiction. Never used by commands. */
export const BROKEN_FIRST_WINS: Ruleset = { name: 'broken-first-wins', contradiction: 'first-wins' };

export function isStale(src: Source, closeDate: string): boolean {
  const c = parseDay(src.capturedAt), d = parseDay(closeDate);
  if (c === null || d === null) return true;
  return d - c > STALE_DAYS;
}

export function extract(packet: HandoffPacket): { matches: Match[]; quarantined: Quarantined[]; staleSources: string[] } {
  const matches: Match[] = [];
  const quarantined: Quarantined[] = [];
  const staleSources: string[] = [];
  for (const src of packet.sources) {
    const stale = isStale(src, packet.closeDate);
    if (stale) staleSources.push(src.id);
    for (const s of sentences(src)) {
      if (INJECTION.test(s.text)) { quarantined.push({ sourceId: src.id, text: s.text, start: s.start, end: s.end }); continue; }
      for (const rule of RULES) {
        rule.re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = rule.re.exec(s.text))) {
          const value = rule.norm(m);
          if (value === null) continue;
          const start = s.start + m.index, end = start + m[0].length;
          matches.push({ field: rule.field, value, sourceId: src.id, quote: src.text.slice(start, end), start, end, stale, capturedAt: src.capturedAt });
        }
      }
    }
  }
  return { matches, quarantined, staleSources };
}

export function checkpointProblem(packet: HandoffPacket, goLive: string | null): string | null {
  const cp = packet.checkpoint;
  if (!cp) return 'No adoption checkpoint set';
  if (!(CHECKPOINT_METRICS as readonly string[]).includes(cp.metric)) return 'Checkpoint metric is not one of the defined metrics';
  if (!Number.isInteger(cp.thresholdPct) || cp.thresholdPct < 1 || cp.thresholdPct > 100) return 'Checkpoint threshold must be a whole percentage from 1 to 100';
  const d = parseDay(cp.date);
  if (d === null) return 'Checkpoint date is not a valid YYYY-MM-DD date';
  const g = goLive ? parseDay(goLive) : null;
  if (g === null) return 'Checkpoint cannot be validated until the go-live date is resolved';
  if (d - g < CHECKPOINT_MIN_DAYS || d - g > CHECKPOINT_MAX_DAYS) return `Checkpoint must fall ${CHECKPOINT_MIN_DAYS} to ${CHECKPOINT_MAX_DAYS} days after go-live (${dayToIso(g + CHECKPOINT_MIN_DAYS)} to ${dayToIso(g + CHECKPOINT_MAX_DAYS)})`;
  return null;
}

export function contentFingerprint(packet: HandoffPacket): string {
  return fingerprint({ id: packet.id, account: packet.account, closeDate: packet.closeDate, sources: packet.sources, owner: packet.owner, checkpoint: packet.checkpoint, resolutions: packet.resolutions });
}

export function evaluatePacket(packet: HandoffPacket, rules: Ruleset = STANDARD): PacketEvaluation {
  const { matches, quarantined, staleSources } = extract(packet);
  const fields: FieldResult[] = FIELDS.map((field) => {
    const all = matches.filter((m) => m.field === field);
    const evidence = all.filter((m) => !m.stale);
    const staleEvidence = all.filter((m) => m.stale);
    const candidates = [...new Set(evidence.map((m) => m.value))].sort();
    const candidatesFingerprint = fingerprint({ field, candidates, evidence: evidence.map((m) => [m.sourceId, m.start, m.end]) });
    const base = { field, label: FIELD_LABELS[field], evidence, staleEvidence, candidates, candidatesFingerprint, resolution: null as Resolution | null };
    if (candidates.length === 0) {
      if (staleEvidence.length > 0) return { ...base, status: 'STALE' as const, value: null, note: `Only stale evidence (older than ${STALE_DAYS} days before close)` };
      return { ...base, status: 'MISSING' as const, value: null, note: 'No source states this. Unknown stays unknown.' };
    }
    if (candidates.length === 1) return { ...base, status: 'RESOLVED' as const, value: candidates[0], note: `Cited in ${evidence.length} place${evidence.length > 1 ? 's' : ''}` };
    if (rules.contradiction === 'first-wins') return { ...base, status: 'RESOLVED' as const, value: evidence[0].value, note: 'First value taken (broken rule)' };
    const res = packet.resolutions.find((r) => r.field === field && r.candidatesFingerprint === candidatesFingerprint && evidence.some((m) => m.sourceId === r.sourceId && m.value === r.value));
    if (res) return { ...base, status: 'RESOLVED' as const, value: res.value, resolution: res, note: `Contradiction resolved by ${res.by}: ${res.reason}` };
    return { ...base, status: 'ABSTAIN' as const, value: null, note: `Sources disagree: ${candidates.join(' vs ')}` };
  });
  const get = (f: FieldId) => fields.find((x) => x.field === f)!;
  const gaps: Gap[] = [];
  for (const f of fields) {
    if (f.status === 'MISSING') gaps.push({ kind: 'missing', field: f.field, message: `${f.label}: not stated in any source`, ask: `Ask ${packet.ae} to confirm in writing` });
    if (f.status === 'STALE') gaps.push({ kind: 'stale', field: f.field, message: `${f.label}: only stale evidence`, ask: 'Re-confirm with the customer; stale evidence is not used' });
    if (f.status === 'ABSTAIN') gaps.push({ kind: 'contradiction', field: f.field, message: `${f.label}: ${f.note}`, ask: 'Resolve by choosing one cited value with a reason, or ask the AE' });
  }
  if (!packet.owner) gaps.push({ kind: 'owner', field: 'owner', message: 'No accountable CS owner', ask: 'Assign an owner from the CS roster' });
  const cpProblem = checkpointProblem(packet, get('goLive').value);
  if (cpProblem) gaps.push({ kind: 'checkpoint', field: 'checkpoint', message: cpProblem, ask: 'Set an adoption checkpoint' });
  const status: PacketStatus = fields.some((f) => f.status === 'ABSTAIN') ? 'ABSTAIN' : gaps.length > 0 ? 'HOLD' : 'READY';
  const risks: string[] = [];
  const g = parseDay(get('goLive').value), c = parseDay(packet.closeDate);
  if (g !== null && c !== null && g - c < 14) risks.push(`Tight go-live: ${g - c} days after close`);
  if (get('sso').value?.startsWith('Required')) risks.push(`SSO dependency: ${get('sso').value}`);
  if (get('recordingConsent').value?.startsWith('Required')) risks.push(`Consent notice must be live before the first recorded interview (${get('recordingConsent').value})`);
  const seats = Number(get('seats').value);
  if (Number.isFinite(seats) && seats > 250) risks.push(`Large rollout: ${seats} seats, plan phased enablement`);
  if (quarantined.length) risks.push(`${quarantined.length} instruction-like sentence${quarantined.length > 1 ? 's' : ''} quarantined; treated as data`);
  if (staleSources.length) risks.push(`${staleSources.length} stale source${staleSources.length > 1 ? 's' : ''} excluded`);
  const unresolved = gaps.filter((x) => x.kind === 'missing' || x.kind === 'stale' || x.kind === 'contradiction').length;
  if (unresolved) risks.push(`${unresolved} implementation fact${unresolved > 1 ? 's' : ''} unresolved`);
  const fp = contentFingerprint(packet);
  const approvalValid = !!packet.approval && packet.approval.fingerprint === fp && status === 'READY';
  return { packetId: packet.id, status, fields, gaps, risks, quarantined, staleSources, checkpointProblem: cpProblem, fingerprint: fp, approvalValid, approvalStale: !!packet.approval && !approvalValid };
}

export function onboardingPlan(packet: HandoffPacket, ev: PacketEvaluation): string[] {
  const v = (f: FieldId) => ev.fields.find((x) => x.field === f)!.value;
  return [
    `Kickoff owner: ${packet.owner}`,
    `Connect ${v('ats')} and ${v('videoTool')}; SSO: ${v('sso')}`,
    `Recording consent: ${v('recordingConsent')}`,
    `Enable ${v('seats')} seats by go-live ${v('goLive')}`,
    `Adoption checkpoint ${packet.checkpoint!.date}: ${packet.checkpoint!.metric} >= ${packet.checkpoint!.thresholdPct}%`,
    `Sponsor check-in with ${v('executiveSponsor')} on: ${v('successCriterion')}`,
    ...ev.risks.map((r) => `Risk to manage: ${r}`),
  ];
}

export function validCheckpointShape(v: unknown): v is Checkpoint {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.date === 'string' && typeof o.metric === 'string' && typeof o.thresholdPct === 'number';
}
