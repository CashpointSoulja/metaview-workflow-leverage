import { VisitorWorkspace, json, type Env } from './workspace.ts';
import { LIMITS } from './engine/types.ts';
import { runEvals } from '../eval/cases.ts';

export { VisitorWorkspace };

const COOKIE = 'cwl_visitor';
const VISITOR = /^[a-f0-9]{32}$/;
const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'cache-control': 'no-store',
};

function visitorFrom(req: Request): string | null {
  const m = /(?:^|;\s*)cwl_visitor=([^;]+)/.exec(req.headers.get('cookie') ?? '');
  return m && VISITOR.test(m[1]) ? m[1] : null;
}
function newVisitor(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function finish(res: Response, setCookie: string | null): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  if (setCookie) out.headers.append('set-cookie', `${COOKIE}=${setCookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return out;
}

async function api(req: Request, env: Env, url: URL, visitor: string): Promise<Response> {
  const path = url.pathname;
  if (path === '/api/health' && req.method === 'GET') return json({ ok: true, synthetic: true, externalWrites: 'none' });
  if (path === '/api/evals' && req.method === 'GET') return json(runEvals(url.searchParams.get('variant') === 'broken' ? 'broken' : 'standard'));
  const stub = env.WORKSPACE.get(env.WORKSPACE.idFromName(visitor));
  if (path === '/api/state' && req.method === 'GET') return json(await stub.view());
  if (path === '/api/export/playbook.md' && req.method === 'GET') return new Response(await stub.playbook(), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': 'attachment; filename="operating-playbook.md"' } });
  if (path === '/api/export/audit.json' && req.method === 'GET') return new Response(JSON.stringify(await stub.audit(), null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="audit.json"' } });
  if (path === '/api/commands') {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed', message: 'Use POST' }, 405, { allow: 'POST' });
    if (req.headers.get('x-requested-with') !== 'cwl') return json({ error: 'missing_header', message: 'X-Requested-With: cwl is required' }, 403);
    if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return json({ error: 'unsupported_media_type', message: 'Send application/json' }, 415);
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > LIMITS.bodyBytes) return json({ error: 'too_large', message: `Body over ${LIMITS.bodyBytes} bytes` }, 413);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > LIMITS.bodyBytes) return json({ error: 'too_large', message: `Body over ${LIMITS.bodyBytes} bytes` }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: 'invalid_json', message: 'Body is not valid JSON' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'invalid_json', message: 'Body must be an object' }, 400);
    const key = req.headers.get('idempotency-key');
    const out = (await stub.command({ expectedRevision: body.expectedRevision, command: body.command, requestKey: key ?? undefined })) as unknown as { status: number; body: unknown; replay: boolean };
    return json(out.body, out.status, out.replay ? { 'idempotent-replay': 'true' } : {});
  }
  return json({ error: 'not_found', message: 'No such endpoint' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return finish(await env.ASSETS.fetch(req), null);
    let visitor = visitorFrom(req);
    let set: string | null = null;
    if (!visitor) { visitor = newVisitor(); set = visitor; }
    try {
      return finish(await api(req, env, url, visitor), set);
    } catch {
      return finish(json({ error: 'internal', message: 'Something went wrong; nothing was written' }, 500), set);
    }
  },
} satisfies ExportedHandler<Env>;
