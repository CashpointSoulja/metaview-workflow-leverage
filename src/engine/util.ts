export function fingerprint(value: unknown): string {
  const s = stableStringify(value);
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a strict YYYY-MM-DD calendar date to a UTC day number, or null. Never string-compares dates. */
export function parseDay(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = ISO_DATE.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return Math.round(t / 86400000);
}

export function dayToIso(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function mdCell(v: unknown): string {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n|\r/g, ' ').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
