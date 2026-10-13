import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../src/engine/fixtures.ts';
import { applyCommand } from '../src/engine/commands.ts';
import { CHECKPOINT_METRICS, OWNER_ROSTER, evaluatePacket } from '../src/engine/handoff.ts';
import { rankWorkflows } from '../src/engine/ranking.ts';
import { scoreOptions } from '../src/engine/buildBuy.ts';
import { measureEffort } from '../src/engine/effort.ts';
import { buildPlaybook } from '../src/engine/playbook.ts';
import { parseDay } from '../src/engine/util.ts';
import { runEvals } from '../eval/cases.ts';
import type { Workspace } from '../src/engine/types.ts';
import type { Command } from '../src/engine/commands.ts';

const NOW = '2026-10-13T00:00:00Z';
const apply = (ws: Workspace, c: Command) => applyCommand(ws, c, NOW).ws;
const code = (fn: () => unknown) => { try { fn(); return 'accepted'; } catch (e) { return (e as { code: string }).code; } };
const ready = () => apply(apply(seedWorkspace(), { type: 'assignOwner', packetId: 'HO-1001', owner: OWNER_ROSTER[0] }), { type: 'setCheckpoint', packetId: 'HO-1001', date: '2026-11-03', metric: CHECKPOINT_METRICS[0], thresholdPct: 70 });

describe('happy path', () => {
  it('ranks, decides, approves, executes, logs effort and exports a non-draft playbook', () => {
    let ws = apply(seedWorkspace(), { type: 'selectWorkflow', workflowId: 'sales-cs-handoff' });
    ws = apply(ws, { type: 'recordDecision', optionId: 'build', by: 'Ops (synthetic)' });
    ws = apply(apply(apply(ws, { type: 'assignOwner', packetId: 'HO-1001', owner: OWNER_ROSTER[0] }), { type: 'setCheckpoint', packetId: 'HO-1001', date: '2026-11-03', metric: CHECKPOINT_METRICS[0], thresholdPct: 70 }), { type: 'approve', packetId: 'HO-1001', by: 'Dana' });
    ws = apply(ws, { type: 'execute', packetId: 'HO-1001', idempotencyKey: 'key-1' });
    ws = apply(ws, { type: 'logEffort', packetId: 'HO-1001', minutes: 110 });
    const p = ws.packets[0];
    expect(p.execution?.receiptId).toMatch(/^SIM-HO-1001-/);
    expect(p.execution?.plan.join(' ')).toContain('Greenhouse');
    expect(ws.effort.at(-1)).toMatchObject({ id: 'V-HO-1001', arm: 'assisted', origin: 'visitor' });
    const md = buildPlaybook(ws, NOW);
    expect(md).toContain('In use on 1 of 5');
    expect(md).toContain('Independent concept by Ayo Ahmed');
    expect(ws.revision).toBe(8);
  });
  it('playbook is DRAFT before any execution', () => expect(buildPlaybook(seedWorkspace(), NOW)).toContain('DRAFT'));
});

describe('rejected inputs', () => {
  it.each([
    [{ type: 'selectWorkflow', workflowId: 'candidate-search' }, 'not_rankable'],
    [{ type: 'selectWorkflow', workflowId: 'discount-approval' }, 'not_rankable'],
    [{ type: 'updateCandidate', id: 'sales-cs-handoff', field: 'savedShare', value: 1.5 }, 'invalid_number'],
    [{ type: 'updateCandidate', id: 'sales-cs-handoff', field: 'occurrencesPerMonth', value: Number.NaN }, 'invalid_number'],
    [{ type: 'setOptionScore', optionId: 'build', criterion: 'security', score: 6 }, 'invalid_number'],
    [{ type: 'recordDecision', optionId: 'buy', by: 'x' }, 'not_recommended'],
    [{ type: 'assignOwner', packetId: 'HO-1001', owner: 'Someone Else' }, 'invalid_owner'],
    [{ type: 'setCheckpoint', packetId: 'HO-1001', date: '2026-02-30', metric: CHECKPOINT_METRICS[0], thresholdPct: 70 }, 'invalid_date'],
    [{ type: 'setCheckpoint', packetId: 'HO-1001', date: '2026-11-03', metric: 'Revenue', thresholdPct: 70 }, 'invalid_field'],
    [{ type: 'setCheckpoint', packetId: 'HO-1001', date: '2026-11-03', metric: CHECKPOINT_METRICS[0], thresholdPct: 0 }, 'invalid_number'],
    [{ type: 'setCheckpoint', packetId: 'HO-1001', date: '2027-03-01', metric: CHECKPOINT_METRICS[0], thresholdPct: 70 }, 'invalid_checkpoint'],
    [{ type: 'approve', packetId: 'HO-1002', by: 'x' }, 'not_ready'],
    [{ type: 'execute', packetId: 'HO-1001', idempotencyKey: 'k' }, 'not_approved'],
    [{ type: 'logEffort', packetId: 'HO-1001', minutes: 10 }, 'not_executed'],
    [{ type: 'approve', packetId: 'HO-9999', by: 'x' }, 'not_found'],
    [{ type: 'drop_tables' }, 'unknown_command'],
    [{ type: 'importEffortCsv', csv: 'id,arm,segment,minutes,status\nX1,baseline,enterprise,"12,complete' }, 'invalid_csv'],
    [{ type: 'importEffortCsv', csv: 'id,arm,segment,minutes\nX1,baseline,enterprise,12' }, 'invalid_csv'],
    [{ type: 'importEffortCsv', csv: 'id,arm,segment,minutes,status\nX1,baseline,enterprise,-4,complete' }, 'invalid_csv'],
    [{ type: 'importEffortCsv', csv: 'id,arm,segment,minutes,status\nB-01,baseline,enterprise,12,complete' }, 'duplicate_id'],
    [{ type: 'importPackets', packets: [] }, 'invalid_import'],
    [{ type: 'importPackets', packets: [{ id: 'HO-1001', account: 'a', segment: 'enterprise', closeDate: '2026-10-01', ae: 'a', sources: [{ id: 'SRC-X', kind: 'call_note', capturedAt: '2026-10-01', author: 'a', text: 't' }] }] }, 'duplicate_id'],
  ] as [Command, string][])('%j -> %s', (cmd, expected) => expect(code(() => applyCommand(seedWorkspace(), cmd, NOW))).toBe(expected));

  it('a bad packet anywhere in an import rejects the whole import (atomic)', () => {
    const good = { id: 'HO-2001', account: 'A (synthetic)', segment: 'enterprise', closeDate: '2026-10-01', ae: 'a', sources: [{ id: 'SRC-2001', kind: 'call_note', capturedAt: '2026-10-01', author: 'a', text: '10 seats.' }] };
    const ws = seedWorkspace();
    expect(code(() => applyCommand(ws, { type: 'importPackets', packets: [good, { ...good, id: 'HO-2002', segment: 'galaxy' }] }, NOW))).toBe('invalid_packet');
    expect(ws.packets).toHaveLength(5);
    expect(applyCommand(ws, { type: 'importPackets', packets: [good] }, NOW).ws.packets).toHaveLength(6);
  });
  it('limits are enforced', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ id: `HO-3${String(i).padStart(3, '0')}`, account: 'A', segment: 'enterprise', closeDate: '2026-10-01', ae: 'a', sources: [{ id: 'SRC-1', kind: 'call_note', capturedAt: '2026-10-01', author: 'a', text: 't' }] }));
    expect(code(() => applyCommand(seedWorkspace(), { type: 'importPackets', packets: many }, NOW))).toBe('limit');
  });
  it('strict dates', () => {
    expect(parseDay('2026-02-29')).toBeNull();
    expect(parseDay('2028-02-29')).not.toBeNull();
    expect(parseDay('2026-1-05')).toBeNull();
    expect(parseDay('2026-10-05T00:00')).toBeNull();
  });
});

describe('unknowns stay unknown', () => {
  it('a missing input removes a workflow from the ranking, never fills it', () => {
    const ws = apply(seedWorkspace(), { type: 'updateCandidate', id: 'inbound-lead-routing', field: 'buildDays', value: null });
    const row = rankWorkflows(ws.candidates).rows.find((r) => r.candidate.id === 'inbound-lead-routing')!;
    expect(row.status).toBe('UNKNOWN');
    expect(row.leverage).toBeNull();
  });
  it('near-tie gives no winner', () => {
    const ws = apply(seedWorkspace(), { type: 'updateCandidate', id: 'inbound-lead-routing', field: 'buildDays', value: 3.5 });
    expect(rankWorkflows(ws.candidates).recommendationId).toBeNull();
  });
  it('an unknown score that could flip the result withholds the recommendation', () => {
    const ws = apply(seedWorkspace(), { type: 'setOptionScore', optionId: 'configure', criterion: 'evidenceFit', score: null });
    expect(scoreOptions(ws.options).recommendationId).toBeNull();
  });
  it('a missing baseline is not turned into impact', () => {
    const ef = measureEffort(seedWorkspace().effort);
    const strategic = ef.segments.find((s) => s.segment === 'strategic')!;
    expect(strategic.status).toBe('NO_BASELINE');
    expect(strategic.difference).toBeNull();
    expect(ef.mixAdjusted.coveredSegments).not.toContain('strategic');
    expect(ef.verdict).toBe('HOLD');
    expect(ef.verdictText).not.toMatch(/lift|saved|improv/i);
  });
});

describe('hostile content', () => {
  it('instruction-like text is quarantined and cannot set a fact or status', () => {
    const e = evaluatePacket(seedWorkspace().packets.find((p) => p.id === 'HO-1004')!);
    expect(e.quarantined).toHaveLength(1);
    expect(e.status).toBe('HOLD');
    expect(e.fields.find((f) => f.field === 'goLive')!.value).toBe('2026-10-27');
  });
  it('markup in sources is escaped in markdown exports', () => {
    const ws = seedWorkspace();
    ws.packets[3].sources[2].text = 'Executive sponsor: Ravi Menon <img src=x onerror=alert(1)>. Success looks like <script>alert(1)</script> no notes.';
    const md = buildPlaybook(ws, NOW);
    expect(md).not.toMatch(/<img|<script/);
    expect(md).toContain('&lt;script&gt;');
  });
  it('table-breaking characters are escaped', () => {
    const ws = seedWorkspace();
    ws.packets[0].account = 'Pipe | Co\nNew line';
    expect(buildPlaybook(ws, NOW)).toContain('Pipe \\| Co New line');
  });
  it('control characters in names are rejected', () => {
    expect(code(() => applyCommand(ready(), { type: 'approve', packetId: 'HO-1001', by: 'Dana\u0007' }, NOW))).toBe('invalid_field');
  });
});

describe('staleness', () => {
  it('evidence older than 45 days before close is not used', () => {
    const f = evaluatePacket(seedWorkspace().packets.find((p) => p.id === 'HO-1003')!).fields.find((x) => x.field === 'recordingConsent')!;
    expect(f.status).toBe('STALE');
    expect(f.value).toBeNull();
  });
  it('editing after approval invalidates it', () => {
    let ws = apply(ready(), { type: 'approve', packetId: 'HO-1001', by: 'Dana' });
    expect(evaluatePacket(ws.packets[0]).approvalValid).toBe(true);
    ws = apply(ws, { type: 'assignOwner', packetId: 'HO-1001', owner: OWNER_ROSTER[1] });
    expect(evaluatePacket(ws.packets[0]).approvalStale).toBe(true);
    expect(code(() => applyCommand(ws, { type: 'execute', packetId: 'HO-1001', idempotencyKey: 'k' }, NOW))).toBe('approval_stale');
  });
  it('a resolution stops applying when the evidence changes', () => {
    let ws = apply(seedWorkspace(), { type: 'resolveContradiction', packetId: 'HO-1002', field: 'ats', value: 'Greenhouse', sourceId: 'SRC-1002-CN', reason: 'Recruiters use it', by: 'Dana' });
    expect(evaluatePacket(ws.packets[1]).fields.find((f) => f.field === 'ats')!.status).toBe('RESOLVED');
    ws = structuredClone(ws);
    ws.packets[1].sources[2].text += ' Their ATS is Lever.';
    expect(evaluatePacket(ws.packets[1]).fields.find((f) => f.field === 'ats')!.status).toBe('ABSTAIN');
  });
  it('selection and decision go stale when their inputs change', async () => {
    const { selectionStale, decisionStale } = await import('../src/engine/commands.ts');
    let ws = apply(apply(seedWorkspace(), { type: 'selectWorkflow', workflowId: 'sales-cs-handoff' }), { type: 'recordDecision', optionId: 'build', by: 'x' });
    ws = apply(apply(ws, { type: 'updateCandidate', id: 'sales-cs-handoff', field: 'buildDays', value: 7 }), { type: 'setOptionScore', optionId: 'buy', criterion: 'security', score: 3 });
    expect(selectionStale(ws)).toBe(true);
    expect(decisionStale(ws)).toBe(true);
  });
});

describe('idempotent execution', () => {
  it('same key replays without a new revision; a different key is refused', () => {
    const ws = apply(ready(), { type: 'approve', packetId: 'HO-1001', by: 'Dana' });
    const a = applyCommand(ws, { type: 'execute', packetId: 'HO-1001', idempotencyKey: 'k1' }, NOW);
    const b = applyCommand(a.ws, { type: 'execute', packetId: 'HO-1001', idempotencyKey: 'k1' }, NOW);
    expect(b.changed).toBe(false);
    expect(b.ws.revision).toBe(a.ws.revision);
    expect(code(() => applyCommand(a.ws, { type: 'execute', packetId: 'HO-1001', idempotencyKey: 'k2' }, NOW))).toBe('already_executed');
    expect(code(() => applyCommand(a.ws, { type: 'assignOwner', packetId: 'HO-1001', owner: OWNER_ROSTER[1] }, NOW))).toBe('locked');
  });
});

describe('evaluations', () => {
  it('standard rules pass every case', () => expect(runEvals('standard').failed).toBe(0));
  it('the deliberately broken rule turns red on the contradiction cases', () => {
    const out = runEvals('broken');
    expect(out.results.filter((r) => !r.pass).map((r) => r.id)).toEqual(['E02', 'E03', 'E04']);
  });
});
