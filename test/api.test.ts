import { describe, expect, it } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';

const B = 'https://lab.example';
const worker = () => (exports as unknown as { default: { fetch: (r: Request) => Promise<Response> } }).default;

async function visitor() {
  const r = await worker().fetch(new Request(`${B}/api/state`));
  const cookie = /cwl_visitor=([a-f0-9]{32})/.exec(r.headers.get('set-cookie') ?? '')![1];
  return { cookie, state: (await r.json()) as { revision: number; workspace: { packets: { id: string; owner: string | null }[] }; recovered: string | null; eventCount: number } };
}
const get = (cookie: string, path: string) => worker().fetch(new Request(`${B}${path}`, { headers: { cookie: `cwl_visitor=${cookie}` } }));
const post = (cookie: string, body: unknown, headers: Record<string, string> = {}) => worker().fetch(new Request(`${B}/api/commands`, { method: 'POST', headers: { cookie: `cwl_visitor=${cookie}`, 'content-type': 'application/json', 'x-requested-with': 'cwl', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const owner = 'Dana Whitlock (CS, synthetic)';

describe('worker API', () => {
  it('health is up and says no external writes', async () => {
    const r = await worker().fetch(new Request(`${B}/api/health`));
    expect(await r.json()).toEqual({ ok: true, synthetic: true, externalWrites: 'none' });
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  });

  it('issues an HttpOnly visitor cookie and seeds revision 1', async () => {
    const r = await worker().fetch(new Request(`${B}/api/state`));
    expect(r.headers.get('set-cookie')).toMatch(/cwl_visitor=[a-f0-9]{32}; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    const s = (await r.json()) as { revision: number; workspace: { packets: unknown[] } };
    expect(s.revision).toBe(1);
    expect(s.workspace.packets).toHaveLength(5);
  });

  it('rejects requests without the CSRF header, wrong type, bad JSON or oversized bodies', async () => {
    const { cookie } = await visitor();
    expect((await worker().fetch(new Request(`${B}/api/commands`, { method: 'POST', headers: { cookie: `cwl_visitor=${cookie}`, 'content-type': 'application/json' }, body: '{}' }))).status).toBe(403);
    expect((await post(cookie, '{}', { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post(cookie, '{not json')).status).toBe(400);
    expect((await post(cookie, 'x'.repeat(300 * 1024))).status).toBe(413);
    expect((await post(cookie, { command: { type: 'reset' } })).status).toBe(400);
    expect((await worker().fetch(new Request(`${B}/api/commands`, { headers: { cookie: `cwl_visitor=${cookie}` } }))).status).toBe(405);
  });

  it('visitor isolation: one visitor cannot see or change another', async () => {
    const a = await visitor(), b = await visitor();
    expect(a.cookie).not.toBe(b.cookie);
    expect((await post(a.cookie, { expectedRevision: 1, command: { type: 'assignOwner', packetId: 'HO-1001', owner } })).status).toBe(200);
    const sa = (await (await get(a.cookie, '/api/state')).json()) as { revision: number; workspace: { packets: { owner: string | null }[] } };
    const sb = (await (await get(b.cookie, '/api/state')).json()) as { revision: number; workspace: { packets: { owner: string | null }[] } };
    expect(sa.workspace.packets[0].owner).toBe(owner);
    expect(sb.workspace.packets[0].owner).toBeNull();
    expect(sb.revision).toBe(1);
  });

  it('a forged or malformed cookie gets a fresh workspace, not someone else\'s', async () => {
    const r = await worker().fetch(new Request(`${B}/api/state`, { headers: { cookie: 'cwl_visitor=../../etc' } }));
    expect(r.headers.get('set-cookie')).toMatch(/cwl_visitor=[a-f0-9]{32}/);
  });

  it('concurrent commands at the same revision: exactly one wins, the other gets 409', async () => {
    const { cookie } = await visitor();
    const results = await Promise.all([
      post(cookie, { expectedRevision: 1, command: { type: 'assignOwner', packetId: 'HO-1001', owner } }),
      post(cookie, { expectedRevision: 1, command: { type: 'assignOwner', packetId: 'HO-1001', owner: 'Ines Varga (CS, synthetic)' } }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const s = (await (await get(cookie, '/api/state')).json()) as { revision: number };
    expect(s.revision).toBe(2);
  });

  it('idempotency keys replay the stored response and refuse reuse for a different body', async () => {
    const { cookie } = await visitor();
    const body = { expectedRevision: 1, command: { type: 'selectWorkflow', workflowId: 'sales-cs-handoff' } };
    const r1 = await post(cookie, body, { 'idempotency-key': 'key-abcdef-1' });
    const r2 = await post(cookie, body, { 'idempotency-key': 'key-abcdef-1' });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.headers.get('idempotent-replay')).toBe('true');
    expect(await r2.json()).toEqual(await r1.json());
    const r3 = await post(cookie, { ...body, expectedRevision: 2 }, { 'idempotency-key': 'key-abcdef-1' });
    expect(r3.status).toBe(422);
    const s = (await (await get(cookie, '/api/state')).json()) as { revision: number };
    expect(s.revision).toBe(2);
  });

  it('full bounded workflow through the API with simulated execution and exports', async () => {
    const { cookie } = await visitor();
    let rev = 1;
    const ok = async (command: unknown, key?: string) => { const r = await post(cookie, { expectedRevision: rev, command }, key ? { 'idempotency-key': key } : {}); const j = (await r.json()) as { revision: number }; expect(r.status, JSON.stringify(j)).toBe(200); rev = j.revision; return j; };
    await ok({ type: 'assignOwner', packetId: 'HO-1001', owner });
    await ok({ type: 'setCheckpoint', packetId: 'HO-1001', date: '2026-11-03', metric: 'Share of licensed interviewers with notes enabled', thresholdPct: 70 });
    await ok({ type: 'approve', packetId: 'HO-1001', by: 'Dana' });
    const ex = await ok({ type: 'execute', packetId: 'HO-1001', idempotencyKey: 'exec-1' }, 'exec-req-0001');
    const replay = await post(cookie, { expectedRevision: rev - 1, command: { type: 'execute', packetId: 'HO-1001', idempotencyKey: 'exec-1' } }, { 'idempotency-key': 'exec-req-0001' });
    expect(await replay.json()).toEqual(ex);
    const md = await (await get(cookie, '/api/export/playbook.md')).text();
    expect(md).toContain('SIM-HO-1001-');
    const audit = (await (await get(cookie, '/api/export/audit.json')).json()) as { events: { type: string }[]; packets: { id: string; execution: unknown }[] };
    expect(audit.events.map((e) => e.type)).toContain('packet.executed');
    expect(audit.events.filter((e) => e.type === 'packet.executed')).toHaveLength(1);
  });

  it('rejected commands leave state unchanged', async () => {
    const { cookie } = await visitor();
    const r = await post(cookie, { expectedRevision: 1, command: { type: 'importEffortCsv', csv: 'id,arm,segment,minutes,status\nX1,baseline,enterprise,"9,complete' } });
    expect(r.status).toBe(400);
    const s = (await (await get(cookie, '/api/state')).json()) as { revision: number; workspace: { effort: unknown[] } };
    expect(s.revision).toBe(1);
    expect(s.workspace.effort).toHaveLength(26);
  });

  it('recovery: corrupt stored state is backed up, reseeded and reported once', async () => {
    const { cookie } = await visitor();
    await post(cookie, { expectedRevision: 1, command: { type: 'assignOwner', packetId: 'HO-1001', owner } });
    const stub = env.WORKSPACE.get(env.WORKSPACE.idFromName(cookie));
    await runInDurableObject(stub, async (instance: { corruptForTest: (s: string) => void }) => instance.corruptForTest('{"schema":1,"revision":2,"packets":"oops"'));
    const s1 = (await (await get(cookie, '/api/state')).json()) as { revision: number; recovered: string | null; events: { type: string }[] };
    expect(s1.recovered).toMatch(/backed up/);
    expect(s1.events.map((e) => e.type)).toContain('workspace.recovered');
    const s2 = (await (await get(cookie, '/api/state')).json()) as { recovered: string | null };
    expect(s2.recovered).toBeNull();
    const backup = await runInDurableObject(stub, async (_i: unknown, state: DurableObjectState) => state.storage.sql.exec<{ v: string }>(`SELECT v FROM kv WHERE k = 'corrupt_backup'`).one().v);
    expect(backup).toContain('oops');
  });

  it('reset restores fixtures and clears the event log for that visitor only', async () => {
    const a = await visitor(), b = await visitor();
    await post(b.cookie, { expectedRevision: 1, command: { type: 'assignOwner', packetId: 'HO-1001', owner } });
    await post(a.cookie, { expectedRevision: 1, command: { type: 'assignOwner', packetId: 'HO-1001', owner } });
    const r = await post(a.cookie, { expectedRevision: 2, command: { type: 'reset' } });
    expect(r.status).toBe(200);
    const sa = (await (await get(a.cookie, '/api/state')).json()) as { eventCount: number; workspace: { packets: { owner: string | null }[] } };
    const sb = (await (await get(b.cookie, '/api/state')).json()) as { workspace: { packets: { owner: string | null }[] } };
    expect(sa.eventCount).toBe(1);
    expect(sa.workspace.packets[0].owner).toBeNull();
    expect(sb.workspace.packets[0].owner).toBe(owner);
  });

  it('evals endpoint: standard is green, broken is red', async () => {
    const s = (await (await worker().fetch(new Request(`${B}/api/evals`))).json()) as { failed: number };
    const b = (await (await worker().fetch(new Request(`${B}/api/evals?variant=broken`))).json()) as { failed: number };
    expect(s.failed).toBe(0);
    expect(b.failed).toBe(3);
  });

  it('unknown routes 404 as JSON', async () => {
    expect((await worker().fetch(new Request(`${B}/api/nope`))).status).toBe(404);
  });
});
