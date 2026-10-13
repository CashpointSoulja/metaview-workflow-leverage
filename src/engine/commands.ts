import type { BuildBuyOption, CriterionId, FieldId, HandoffPacket, Workspace, WorkflowCandidate } from './types.ts';
import { LIMITS } from './types.ts';
import { rankWorkflows } from './ranking.ts';
import { CRITERIA, scoreOptions, validScore } from './buildBuy.ts';
import { CHECKPOINT_METRICS, FIELDS, OWNER_ROSTER, evaluatePacket, onboardingPlan } from './handoff.ts';
import { fingerprint } from './util.ts';
import { date, intIn, numIn, parseEffortCsv, parseImportedPacket, reject, text } from './validate.ts';
import { seedWorkspace } from './fixtures.ts';

export type Command =
  | { type: 'selectWorkflow'; workflowId: string }
  | { type: 'updateCandidate'; id: string; field: NumericField; value: number | null }
  | { type: 'setOptionScore'; optionId: BuildBuyOption['id']; criterion: CriterionId; score: number | null }
  | { type: 'recordDecision'; optionId: BuildBuyOption['id']; by: string }
  | { type: 'assignOwner'; packetId: string; owner: string }
  | { type: 'setCheckpoint'; packetId: string; date: string; metric: string; thresholdPct: number }
  | { type: 'resolveContradiction'; packetId: string; field: FieldId; value: string; sourceId: string; reason: string; by: string }
  | { type: 'approve'; packetId: string; by: string }
  | { type: 'execute'; packetId: string; idempotencyKey: string }
  | { type: 'logEffort'; packetId: string; minutes: number }
  | { type: 'importPackets'; packets: unknown }
  | { type: 'importEffortCsv'; csv: string }
  | { type: 'reset' };

export type NumericField = 'occurrencesPerMonth' | 'minutesPerOccurrence' | 'savedShare' | 'commercialWeight' | 'buildDays';
const NUMERIC: Record<NumericField, [number, number, boolean]> = {
  occurrencesPerMonth: [0, 100000, true], minutesPerOccurrence: [0, 10000, false], savedShare: [0, 1, false], commercialWeight: [1, 3, true], buildDays: [0.5, 365, false],
};

export interface PendingEvent { type: string; subject: string | null; detail: string }
export interface CommandOutcome { ws: Workspace; events: PendingEvent[]; result: unknown; changed: boolean }

export const COMMAND_TYPES = ['selectWorkflow', 'updateCandidate', 'setOptionScore', 'recordDecision', 'assignOwner', 'setCheckpoint', 'resolveContradiction', 'approve', 'execute', 'logEffort', 'importPackets', 'importEffortCsv', 'reset'] as const;

export const candidateFingerprint = (c: WorkflowCandidate) => fingerprint(c);
export const optionsFingerprint = (o: BuildBuyOption[]) => fingerprint(o);

export function selectionStale(ws: Workspace): boolean {
  if (!ws.selection) return false;
  const c = ws.candidates.find((x) => x.id === ws.selection!.workflowId);
  return !c || candidateFingerprint(c) !== ws.selection.fingerprint;
}
export function decisionStale(ws: Workspace): boolean {
  return !!ws.decision && ws.decision.fingerprint !== optionsFingerprint(ws.options);
}

function packetOf(ws: Workspace, id: unknown): HandoffPacket {
  const p = ws.packets.find((x) => x.id === id);
  if (!p) return reject('not_found', `No handoff packet ${String(id).slice(0, 40)}`, 404);
  return p;
}
function editable(p: HandoffPacket) {
  if (p.execution) reject('locked', `${p.id} was already executed; it is locked`, 409);
}

export function applyCommand(current: Workspace, cmd: Command, now: string): CommandOutcome {
  if (!cmd || typeof cmd !== 'object' || !COMMAND_TYPES.includes((cmd as Command).type)) reject('unknown_command', 'Unknown command type');
  const ws: Workspace = structuredClone(current);
  const ev: PendingEvent[] = [];
  let result: unknown = null;
  switch (cmd.type) {
    case 'selectWorkflow': {
      const row = rankWorkflows(ws.candidates).rows.find((r) => r.candidate.id === cmd.workflowId);
      if (!row) reject('not_found', 'No such workflow', 404);
      if (row!.status !== 'RANKED') reject('not_rankable', `Cannot select ${row!.candidate.name}: ${row!.reason}`, 422);
      ws.selection = { workflowId: row!.candidate.id, at: now, fingerprint: candidateFingerprint(row!.candidate) };
      ev.push({ type: 'workflow.selected', subject: row!.candidate.id, detail: `Selected at leverage ${row!.leverage} (hypothesis)` });
      break;
    }
    case 'updateCandidate': {
      const c = ws.candidates.find((x) => x.id === cmd.id) ?? reject('not_found', 'No such workflow', 404);
      const spec = NUMERIC[cmd.field as NumericField] ?? reject('invalid_field', 'Unknown workflow input');
      const value = cmd.value === null ? null : spec[2] ? intIn(cmd.value, cmd.field, spec[0], spec[1]) : numIn(cmd.value, cmd.field, spec[0], spec[1]);
      (c as unknown as Record<string, number | null>)[cmd.field] = value;
      ev.push({ type: 'workflow.input_changed', subject: c.id, detail: `${cmd.field} = ${value === null ? 'unknown' : value}` });
      break;
    }
    case 'setOptionScore': {
      const o = ws.options.find((x) => x.id === cmd.optionId) ?? reject('not_found', 'No such option', 404);
      if (!CRITERIA.some((c) => c.id === cmd.criterion)) reject('invalid_field', 'Unknown criterion');
      if (!validScore(cmd.score)) reject('invalid_number', 'Score must be a whole number from 1 to 5, or unknown');
      o.scores[cmd.criterion] = cmd.score;
      ev.push({ type: 'option.score_changed', subject: o.id, detail: `${cmd.criterion} = ${cmd.score ?? 'unknown'}` });
      break;
    }
    case 'recordDecision': {
      const by = text(cmd.by, 'Decision owner');
      const r = scoreOptions(ws.options);
      if (r.recommendationId === null) reject('no_recommendation', r.verdict, 422);
      if (cmd.optionId !== r.recommendationId) reject('not_recommended', `Only the recommended option (${r.recommendationId}) can be recorded; change the scores to change the recommendation`, 422);
      ws.decision = { optionId: cmd.optionId, by, at: now, fingerprint: optionsFingerprint(ws.options) };
      ev.push({ type: 'decision.recorded', subject: cmd.optionId, detail: `${by}: ${r.verdict}` });
      break;
    }
    case 'assignOwner': {
      const p = packetOf(ws, cmd.packetId); editable(p);
      if (!(OWNER_ROSTER as readonly string[]).includes(cmd.owner)) reject('invalid_owner', 'Owner must be on the CS roster');
      p.owner = cmd.owner;
      ev.push({ type: 'packet.owner_assigned', subject: p.id, detail: cmd.owner });
      break;
    }
    case 'setCheckpoint': {
      const p = packetOf(ws, cmd.packetId); editable(p);
      const d = date(cmd.date, 'Checkpoint date');
      if (!(CHECKPOINT_METRICS as readonly string[]).includes(cmd.metric)) reject('invalid_field', 'Checkpoint metric must be one of the defined metrics');
      const t = intIn(cmd.thresholdPct, 'Threshold', 1, 100);
      p.checkpoint = { date: d, metric: cmd.metric, thresholdPct: t };
      const problem = evaluatePacket(p).checkpointProblem;
      if (problem) reject('invalid_checkpoint', problem, 422);
      ev.push({ type: 'packet.checkpoint_set', subject: p.id, detail: `${d}: ${cmd.metric} >= ${t}%` });
      break;
    }
    case 'resolveContradiction': {
      const p = packetOf(ws, cmd.packetId); editable(p);
      if (!FIELDS.includes(cmd.field)) reject('invalid_field', 'Unknown field');
      const reason = text(cmd.reason, 'Reason', LIMITS.reason);
      const by = text(cmd.by, 'Resolved by');
      const f = evaluatePacket(p).fields.find((x) => x.field === cmd.field)!;
      if (f.status !== 'ABSTAIN') reject('not_contradicted', `${f.label} is ${f.status}, not a contradiction`, 422);
      if (!f.evidence.some((m) => m.sourceId === cmd.sourceId && m.value === cmd.value)) reject('not_cited', 'The chosen value must be cited by the chosen source', 422);
      p.resolutions = p.resolutions.filter((r) => r.field !== cmd.field);
      p.resolutions.push({ field: cmd.field, value: cmd.value, sourceId: cmd.sourceId, reason, by, candidatesFingerprint: f.candidatesFingerprint });
      ev.push({ type: 'packet.contradiction_resolved', subject: p.id, detail: `${cmd.field} = ${cmd.value} from ${cmd.sourceId}: ${reason}` });
      break;
    }
    case 'approve': {
      const p = packetOf(ws, cmd.packetId); editable(p);
      const by = text(cmd.by, 'Approver');
      const e = evaluatePacket(p);
      if (e.status !== 'READY') reject('not_ready', `${p.id} is ${e.status}: ${e.gaps.map((g) => g.message).join('; ')}`, 422);
      p.approval = { by, at: now, fingerprint: e.fingerprint };
      ev.push({ type: 'packet.approved', subject: p.id, detail: `${by} approved fingerprint ${e.fingerprint}` });
      break;
    }
    case 'execute': {
      const p = packetOf(ws, cmd.packetId);
      const key = text(cmd.idempotencyKey, 'Idempotency key', 80);
      if (p.execution) {
        if (p.execution.idempotencyKey === key) return { ws: current, events: [], result: { replayed: true, execution: p.execution }, changed: false };
        reject('already_executed', `${p.id} was already executed with a different key`, 409);
      }
      const e = evaluatePacket(p);
      if (!p.approval) reject('not_approved', `${p.id} has no approval`, 422);
      if (!e.approvalValid) reject('approval_stale', `${p.id} changed after approval (or is no longer READY); approve again`, 409);
      p.execution = { receiptId: `SIM-${p.id}-${e.fingerprint.slice(0, 8)}`, idempotencyKey: key, at: now, fingerprint: e.fingerprint, plan: onboardingPlan(p, e) };
      result = { replayed: false, execution: p.execution };
      ev.push({ type: 'packet.executed', subject: p.id, detail: `Simulated onboarding plan ${p.execution.receiptId}; no external system written` });
      break;
    }
    case 'logEffort': {
      const p = packetOf(ws, cmd.packetId);
      if (!p.execution) reject('not_executed', 'Log observed effort only after the bounded workflow ran', 422);
      const minutes = intIn(cmd.minutes, 'Minutes', 1, 1000);
      const id = `V-${p.id}`;
      if (ws.effort.some((r) => r.id === id)) reject('duplicate', `Effort for ${p.id} is already logged`, 409);
      if (ws.effort.length >= LIMITS.effortRows) reject('limit', `At most ${LIMITS.effortRows} effort rows`, 413);
      ws.effort.push({ id, arm: 'assisted', segment: p.segment, minutes, status: 'complete', packetId: p.id, origin: 'visitor' });
      ev.push({ type: 'effort.logged', subject: p.id, detail: `${minutes} synthetic minutes (assisted, ${p.segment})` });
      break;
    }
    case 'importPackets': {
      if (!Array.isArray(cmd.packets) || cmd.packets.length === 0) reject('invalid_import', 'packets must be a non-empty list');
      const incoming = (cmd.packets as unknown[]).map(parseImportedPacket);
      const ids = new Set(ws.packets.map((p) => p.id));
      for (const p of incoming) { if (ids.has(p.id)) reject('duplicate_id', `Packet ${p.id} already exists; nothing was imported`, 409); ids.add(p.id); }
      if (ws.packets.length + incoming.length > LIMITS.packets) reject('limit', `At most ${LIMITS.packets} packets; nothing was imported`, 413);
      ws.packets.push(...incoming);
      ev.push({ type: 'packets.imported', subject: null, detail: `${incoming.length} packet(s): ${incoming.map((p) => p.id).join(', ')}` });
      break;
    }
    case 'importEffortCsv': {
      const rows = parseEffortCsv(cmd.csv);
      if (!rows.length) reject('invalid_csv', 'CSV has a header but no rows');
      const ids = new Set(ws.effort.map((r) => r.id));
      for (const r of rows) { if (ids.has(r.id)) reject('duplicate_id', `Effort row ${r.id} already exists; nothing was imported`, 409); ids.add(r.id); }
      if (ws.effort.length + rows.length > LIMITS.effortRows) reject('limit', `At most ${LIMITS.effortRows} effort rows; nothing was imported`, 413);
      ws.effort.push(...rows);
      ev.push({ type: 'effort.imported', subject: null, detail: `${rows.length} row(s), ${rows.filter((r) => r.minutes === null || r.status === 'partial').length} will be excluded` });
      break;
    }
    case 'reset': {
      const fresh = seedWorkspace();
      fresh.revision = ws.revision + 1;
      return { ws: fresh, events: [{ type: 'workspace.reset', subject: null, detail: 'Reset to synthetic fixtures' }], result: null, changed: true };
    }
  }
  ws.revision = current.revision + 1;
  return { ws, events: ev, result, changed: true };
}
