import type { EventRecord, Workspace } from './types.ts';
import { rankWorkflows } from './ranking.ts';
import { CRITERIA, scoreOptions } from './buildBuy.ts';
import { STALE_DAYS, CHECKPOINT_MIN_DAYS, CHECKPOINT_MAX_DAYS, evaluatePacket } from './handoff.ts';
import { measureEffort, MIN_ARM_N, MIN_CELL_N } from './effort.ts';
import { decisionStale, selectionStale } from './commands.ts';
import { SYNTHETIC_NOTICE } from './fixtures.ts';
import { fingerprint, mdCell as c } from './util.ts';

export const AUTHOR_LINE = 'Commercial Workflow Leverage Lab. Independent concept by Ayo Ahmed. Not affiliated with, endorsed by or built for Metaview.';

export function buildPlaybook(ws: Workspace, generatedAt: string): string {
  const rank = rankWorkflows(ws.candidates);
  const bb = scoreOptions(ws.options);
  const evals = ws.packets.map((p) => ({ p, e: evaluatePacket(p) }));
  const effort = measureEffort(ws.effort);
  const executed = evals.filter((x) => x.p.execution).length;
  const status = executed === 0 ? 'DRAFT (no packet has been executed yet)' : `In use on ${executed} of ${ws.packets.length} synthetic packets`;
  const sel = ws.selection ? ws.candidates.find((x) => x.id === ws.selection!.workflowId)?.name ?? ws.selection.workflowId : 'None selected';
  const L: string[] = [];
  L.push('# Operating playbook: sales-to-onboarding handoff', '', `> ${SYNTHETIC_NOTICE}`, `> ${AUTHOR_LINE}`, '',
    `- Generated: ${generatedAt}`, `- Workspace revision: ${ws.revision} (fingerprint ${fingerprint(ws)})`, `- Status: ${status}`, '');
  L.push('## 1. Which workflow and why', '', `Selected: **${c(sel)}**${selectionStale(ws) ? ' (STALE: inputs changed after selection)' : ''}`, '', `Ranking verdict: ${c(rank.verdict)}`, '',
    'Leverage = occurrences/month x minutes x share saved / 60 x commercial weight / build days. Every input is a hypothesis. Any unknown input means the workflow is not ranked.', '',
    '| Rank | Workflow | Team | Status | Leverage | Note |', '|---|---|---|---|---|---|');
  for (const r of rank.rows) L.push(`| ${r.rank ?? '-'} | ${c(r.candidate.name)} | ${r.candidate.team} | ${r.status} | ${r.leverage ?? 'unknown'} | ${c(r.status === 'RANKED' ? r.candidate.hypothesisNote : r.reason)} |`);
  L.push('', '## 2. Build, buy, configure or do nothing', '', `Verdict: ${c(bb.verdict)}`, '',
    `Decision: ${ws.decision ? `${ws.decision.optionId} recorded by ${c(ws.decision.by)} at ${ws.decision.at}${decisionStale(ws) ? ' (STALE: scores changed after the decision)' : ''}` : 'not recorded'}`, '',
    '| Option | ' + CRITERIA.map((k) => `${k.label} (${k.weight})`).join(' | ') + ' | Score | Best case |', '|---|' + CRITERIA.map(() => '---|').join('') + '---|---|');
  for (const r of bb.rows) L.push(`| ${c(r.option.label)} | ${CRITERIA.map((k) => r.option.scores[k.id] ?? 'unknown').join(' | ')} | ${r.score} | ${r.upperBound} |`);
  L.push('', '## 3. Handoff rules', '',
    '1. Every implementation fact must quote an exact source sentence. No quote, no fact.',
    '2. A fact with no source is MISSING. It stays unknown and the packet holds.',
    `3. A source captured more than ${STALE_DAYS} days before close is STALE and is not used.`,
    '4. Two sources that disagree make the field ABSTAIN. A person must pick one cited value and give a reason.',
    '5. Instruction-like text inside a source is quarantined and treated as data. It never changes status.',
    `6. A named CS owner and an adoption checkpoint ${CHECKPOINT_MIN_DAYS}-${CHECKPOINT_MAX_DAYS} days after go-live are required.`,
    '7. Approval binds to a content fingerprint. Any later edit makes the approval stale.',
    '8. Execution is simulated, idempotent by key, and writes to no external system.', '');
  L.push('## 4. Packets', '', '| Packet | Account | Status | Owner | Checkpoint | Open gaps | Approval | Execution |', '|---|---|---|---|---|---|---|---|');
  for (const { p, e } of evals) L.push(`| ${p.id} | ${c(p.account)} | ${e.status} | ${c(p.owner ?? 'unassigned')} | ${c(p.checkpoint ? `${p.checkpoint.date} ${p.checkpoint.metric} >= ${p.checkpoint.thresholdPct}%` : 'none')} | ${c(e.gaps.map((g) => g.message).join('; ') || 'none')} | ${p.approval ? (e.approvalStale ? 'STALE' : 'valid') : 'none'} | ${p.execution ? p.execution.receiptId : 'not run'} |`);
  for (const { p, e } of evals) {
    L.push('', `### ${p.id} evidence`, '', '| Field | Status | Value | Source | Exact quote |', '|---|---|---|---|---|');
    for (const f of e.fields) {
      if (!f.evidence.length && !f.staleEvidence.length) L.push(`| ${f.label} | ${f.status} | unknown | - | - |`);
      for (const m of [...f.evidence, ...f.staleEvidence]) L.push(`| ${f.label} | ${f.status}${m.stale ? ' (stale source)' : ''} | ${c(f.status === 'RESOLVED' ? f.value : m.value)} | ${m.sourceId} | "${c(m.quote)}" |`);
    }
    if (e.quarantined.length) L.push('', 'Quarantined (data, not instructions): ' + e.quarantined.map((q) => `${q.sourceId}: "${c(q.text)}"`).join('; '));
    if (e.risks.length) L.push('', 'Risks: ' + e.risks.map(c).join('; '));
  }
  L.push('', '## 5. Effort: baseline vs observed (synthetic)', '', `Verdict: **${effort.verdict}**. ${c(effort.verdictText)}`, '',
    `Included rows: baseline ${effort.totals.baselineIncluded} of ${effort.totals.baselineTotal}, assisted ${effort.totals.assistedIncluded} of ${effort.totals.assistedTotal}. Minimum ${MIN_ARM_N} per arm and ${MIN_CELL_N} per segment cell.`, '',
    '| Segment | Baseline n | Baseline mean | Assisted n | Assisted mean | Difference | Status |', '|---|---|---|---|---|---|---|');
  for (const s of effort.segments) L.push(`| ${s.segment} | ${s.baseline.n} | ${s.baseline.mean ?? '-'} | ${s.assisted.n} | ${s.assisted.mean ?? '-'} | ${s.difference ?? '-'} | ${s.status}: ${c(s.note)} |`);
  L.push('', `Aggregate difference ${effort.aggregate.difference ?? '-'} min vs mix-adjusted ${effort.mixAdjusted.difference ?? '-'} min${effort.misleadingAggregate ? ' (aggregate is misleading: segment mix differs)' : ''}.`, '', 'Exclusions:', '');
  for (const x of effort.exclusions) L.push(`- ${x.id} (${x.arm}, ${x.segment}): ${c(x.reason)}`);
  if (!effort.exclusions.length) L.push('- none');
  L.push('', '## 6. Reuse this pattern', '', '1. Size candidates with explicit inputs; leave unknowns unknown.', '2. Exclude anything the company already sells.', '3. Score build/buy/configure/nothing with weights agreed up front; no recommendation while unknowns could flip it.',
    '4. Define the evidence contract (fields, sources, staleness, contradiction rule) before automating.', '5. Gate execution on a fingerprint-bound approval and an idempotency key.', '6. Measure effort per segment with exclusions written down; never report a lift from synthetic rows.', '');
  return L.join('\n');
}

export function buildAudit(ws: Workspace, events: EventRecord[], generatedAt: string) {
  return {
    notice: SYNTHETIC_NOTICE,
    author: AUTHOR_LINE,
    generatedAt,
    revision: ws.revision,
    workspaceFingerprint: fingerprint(ws),
    selection: ws.selection ? { ...ws.selection, stale: selectionStale(ws) } : null,
    decision: ws.decision ? { ...ws.decision, stale: decisionStale(ws) } : null,
    packets: ws.packets.map((p) => {
      const e = evaluatePacket(p);
      return { id: p.id, status: e.status, fingerprint: e.fingerprint, owner: p.owner, checkpoint: p.checkpoint, approval: p.approval ? { ...p.approval, stale: e.approvalStale } : null, execution: p.execution, gaps: e.gaps, quarantined: e.quarantined.length, fields: e.fields.map((f) => ({ field: f.field, status: f.status, value: f.value, sources: [...new Set(f.evidence.map((m) => m.sourceId))] })) };
    }),
    effort: measureEffort(ws.effort),
    events,
  };
}
