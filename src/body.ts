import { json } from './workspace.ts';

const tooLarge = (limit: number) => json({ error: 'too_large', message: `Body over ${limit} bytes` }, 413);

/** Counts bytes as they stream in and stops at the limit, so an oversized body is never buffered. */
export async function readBody(req: Request, limit: number): Promise<string | Response> {
  const declared = req.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) return json({ error: 'bad_length', message: 'Content-Length is not a number' }, 400);
    if (Number(declared) > limit) return tooLarge(limit);
  }
  if (!req.body) return '';
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return tooLarge(limit);
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { bytes.set(p, at); at += p.byteLength; }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return json({ error: 'invalid_utf8', message: 'Body is not valid UTF-8' }, 400);
  }
}
