import { seedWorkspace } from '../src/engine/fixtures.ts';
import { BROKEN_FIRST_WINS, CHECKPOINT_METRICS, OWNER_ROSTER, STANDARD, evaluatePacket, type Ruleset } from '../src/engine/handoff.ts';
import { rankWorkflows } from '../src/engine/ranking.ts';
import { scoreOptions } from '../src/engine/buildBuy.ts';
import { measureEffort } from '../src/engine/effort.ts';
import { applyCommand } from '../src/engine/commands.ts';
import type { FieldId, Workspace } from '../src/engine/types.ts';

export interface EvalCase { id: string; title: string; expected: string; run: (rules: Ruleset) => string }
export interface EvalResult { id: string; title: string; expected: string; actual: string; pass: boolean }

const NOW = '2026-10-13T00:00:00Z';
const pkt = (ws: Workspace, id: string) => ws.packets.find((p) => p.id === id)!;
const field = (ws: Workspace, id: string, f: FieldId, rules: Ruleset) => {
  const r = evaluatePacket(pkt(ws, id), rules).fields.find((x) => x.field === f)!;
  return `${r.status}:${r.value ?? 'unknown'}`;
};
const ready1001 = () => {
  let ws = seedWorkspace();
  ws = applyCommand(ws, { type: 'assignOwner', packetId: 'HO-1001', owner: OWNER_ROSTER[0] }, NOW).ws;
  ws = applyCommand(ws, { type: 'setCheckpoint', packetId: 'HO-1001', date: '2026-11-03', metric: CHECKPOINT_METRICS[0], thresholdPct: 70 }, NOW).ws;
  return ws;
};
const tryCmd = (fn: () => unknown) => { try { fn(); return 'accepted'; } catch (e) { return `rejected:${(e as { code?: string }).code}`; } };

export const CASES: EvalCase[] = [
  { id: 'E01', title: 'Clean packet with owner and checkpoint is READY', expected: 'READY', run: (r) => evaluatePacket(pkt(ready1001(), 'HO-1001'), r).status },
  { id: 'E02', title: 'Two sources disagree on ATS: abstain, do not pick', expected: 'ABSTAIN:unknown', run: (r) => field(seedWorkspace(), 'HO-1002', 'ats', r) },
  { id: 'E03', title: 'Two sources disagree on seats: abstain, do not pick', expected: 'ABSTAIN:unknown', run: (r) => field(seedWorkspace(), 'HO-1002', 'seats', r) },
  { id: 'E04', title: 'Packet with contradictions is ABSTAIN overall', expected: 'ABSTAIN', run: (r) => evaluatePacket(pkt(seedWorkspace(), 'HO-1002'), r).status },
  { id: 'E05', title: 'SSO never mentioned stays unknown', expected: 'MISSING:unknown', run: (r) => field(seedWorkspace(), 'HO-1003', 'sso', r) },
  { id: 'E06', title: 'Consent only in a 91-day-old security review is stale, not used', expected: 'STALE:unknown', run: (r) => field(seedWorkspace(), 'HO-1003', 'recordingConsent', r) },
  { id: 'E07', title: 'Injected instruction is quarantined; its go-live date is ignored', expected: 'quarantined=1 goLive=RESOLVED:2026-10-27 status=HOLD', run: (r) => { const ws = seedWorkspace(); const e = evaluatePacket(pkt(ws, 'HO-1004'), r); return `quarantined=${e.quarantined.length} goLive=${field(ws, 'HO-1004', 'goLive', r)} status=${e.status}`; } },
  { id: 'E08', title: 'Recruiter-search clone and product overlaps are excluded from ranking', expected: 'candidate-search=EXCLUDED internal-interview-scheduling=EXCLUDED', run: () => { const rows = rankWorkflows(seedWorkspace().candidates).rows; return ['candidate-search', 'internal-interview-scheduling'].map((id) => `${id}=${rows.find((x) => x.candidate.id === id)!.status}`).join(' '); } },
  { id: 'E09', title: 'Workflow with an unknown input is not ranked', expected: 'UNKNOWN rank=none', run: () => { const x = rankWorkflows(seedWorkspace().candidates).rows.find((r) => r.candidate.id === 'discount-approval')!; return `${x.status} rank=${x.rank ?? 'none'}`; } },
  { id: 'E10', title: 'Top-ranked workflow is the sales-to-onboarding handoff', expected: 'sales-cs-handoff', run: () => rankWorkflows(seedWorkspace().candidates).recommendationId ?? 'none' },
  { id: 'E11', title: 'Build vs buy recommends build at full coverage', expected: 'build', run: () => scoreOptions(seedWorkspace().options).recommendationId ?? 'none' },
  { id: 'E12', title: 'Unknown evidence-fit on build withholds any recommendation', expected: 'none', run: () => { const ws = seedWorkspace(); ws.options.find((o) => o.id === 'build')!.scores.evidenceFit = null; return scoreOptions(ws.options).recommendationId ?? 'none'; } },
  { id: 'E13', title: 'Effort comparison holds; no-baseline segment is not counted', expected: 'HOLD strategic=NO_BASELINE excluded=3 misleadingAggregate=true', run: () => { const e = measureEffort(seedWorkspace().effort); return `${e.verdict} strategic=${e.segments.find((s) => s.segment === 'strategic')!.status} excluded=${e.exclusions.length} misleadingAggregate=${e.misleadingAggregate}`; } },
  { id: 'E14', title: 'Edit after approval makes approval stale and blocks execution', expected: 'approvalStale=true execute=rejected:approval_stale', run: () => { let ws = ready1001(); ws = applyCommand(ws, { type: 'approve', packetId: 'HO-1001', by: 'Reviewer (synthetic)' }, NOW).ws; ws = applyCommand(ws, { type: 'setCheckpoint', packetId: 'HO-1001', date: '2026-11-10', metric: CHECKPOINT_METRICS[0], thresholdPct: 70 }, NOW).ws; const w = ws; return `approvalStale=${evaluatePacket(pkt(ws, 'HO-1001')).approvalStale} execute=${tryCmd(() => applyCommand(w, { type: 'execute', packetId: 'HO-1001', idempotencyKey: 'k' }, NOW))}`; } },
  { id: 'E15', title: 'Checkpoint before go-live is rejected', expected: 'rejected:invalid_checkpoint', run: () => tryCmd(() => applyCommand(seedWorkspace(), { type: 'setCheckpoint', packetId: 'HO-1001', date: '2026-10-01', metric: CHECKPOINT_METRICS[0], thresholdPct: 70 }, NOW)) },
  { id: 'E16', title: 'Same idempotency key replays the same receipt', expected: 'replayed=true sameReceipt=true', run: () => { let ws = ready1001(); ws = applyCommand(ws, { type: 'approve', packetId: 'HO-1001', by: 'Reviewer (synthetic)' }, NOW).ws; const a = applyCommand(ws, { type: 'execute', packetId: 'HO-1001', idempotencyKey: 'k1' }, NOW); const b = applyCommand(a.ws, { type: 'execute', packetId: 'HO-1001', idempotencyKey: 'k1' }, NOW); const ra = a.result as { execution: { receiptId: string } }, rb = b.result as { replayed: boolean; execution: { receiptId: string } }; return `replayed=${rb.replayed} sameReceipt=${ra.execution.receiptId === rb.execution.receiptId}`; } },
];

export function runEvals(variant: 'standard' | 'broken' = 'standard'): { variant: string; rules: string; results: EvalResult[]; passed: number; failed: number } {
  const rules = variant === 'broken' ? BROKEN_FIRST_WINS : STANDARD;
  const results = CASES.map((c) => {
    let actual: string;
    try { actual = c.run(rules); } catch (e) { actual = `error:${(e as Error).message}`; }
    return { id: c.id, title: c.title, expected: c.expected, actual, pass: actual === c.expected };
  });
  const passed = results.filter((r) => r.pass).length;
  return { variant, rules: rules.name, results, passed, failed: results.length - passed };
}
