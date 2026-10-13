import './style.css';
import { h, toast, openDialog, chip, statusChip, randomKey, type Child } from './dom.ts';
import { getView, send, type View } from './api.ts';
import type { Command, NumericField } from '../src/engine/commands.ts';
import type { FieldId, HandoffPacket, CriterionId } from '../src/engine/types.ts';
import type { PacketEvaluation, FieldResult } from '../src/engine/handoff.ts';

const REPO = 'https://github.com/CashpointSoulja/metaview-workflow-leverage';
const ROUTES = [
  ['choose', '01', 'Choose a workflow'],
  ['build-buy', '02', 'Build vs buy'],
  ['desk', '03', 'Handoff desk'],
  ['effort', '04', 'Effort'],
  ['playbook', '05', 'Playbook & audit'],
  ['evals', '06', 'Evals'],
  ['about', '07', 'About'],
] as const;

let view: View | null = null;
const main = () => document.getElementById('main')!;
const route = () => { const parts = location.hash.replace(/^#\/?/, '').split('/'); return { page: parts[0] || 'choose', arg: parts[1] ? decodeURIComponent(parts[1]) : null }; };

async function refresh() {
  try { view = await getView(); }
  catch (e) { main().replaceChildren(h('div', { class: 'card' }, h('h2', null, 'Could not load your workspace'), h('p', { class: 'muted' }, String((e as Error).message)), h('button', { onclick: () => refresh() }, 'Retry'))); return; }
  if (view.recovered) toast(view.recovered, 'error');
  render();
}

async function run(command: Command, success: string, key?: string): Promise<string | null> {
  if (!view) return 'Workspace not loaded';
  const r = await send(view.revision, command, key);
  if (r.ok) { toast(r.replayed ? `${success} (already applied, replayed)` : success); await refresh(); return null; }
  if (r.error === 'revision_conflict') { await refresh(); return `${r.message} The latest version is now shown.`; }
  return r.message ?? `Request failed (${r.status})`;
}

function verdict(tag: string, text: string, kind: 'ok' | 'hold' | 'abstain' = 'ok') {
  return h('div', { class: `verdict ${kind}`, role: 'status' }, h('span', { class: 'tag' }, tag), h('p', null, text));
}
const header = (eyebrow: string, title: string, lede: Child) => [h('p', { class: 'eyebrow' }, eyebrow), h('h1', { tabindex: '-1', id: 'page-title' }, title), h('p', { class: 'lede' }, lede)];
const fmt = (v: number | null | undefined, suffix = '') => (v === null || v === undefined ? 'unknown' : `${v}${suffix}`);

function renderTabs() {
  const { page } = route();
  document.getElementById('tabs')!.replaceChildren(...ROUTES.map(([id, n, label]) => h('a', { href: `#/${id}`, 'aria-current': page === id ? 'page' : undefined }, h('span', { class: 'n' }, n), label)));
}

function render() {
  renderTabs();
  if (!view) return;
  const { page, arg } = route();
  const body = page === 'build-buy' ? pageBuildBuy() : page === 'desk' ? pageDesk(arg) : page === 'effort' ? pageEffort() : page === 'playbook' ? pagePlaybook() : page === 'evals' ? pageEvals() : page === 'about' ? pageAbout() : pageChoose();
  main().replaceChildren(...body.flatMap((x) => (x === null || x === undefined || x === false ? [] : [typeof x === 'number' ? String(x) : x])));
  document.title = `${ROUTES.find((r) => r[0] === page)?.[2] ?? 'Choose a workflow'} · Commercial Workflow Leverage Lab`;
}

/* 01 Choose */
const INPUTS: [NumericField, string, string][] = [
  ['occurrencesPerMonth', 'Occurrences per month', 'Whole number, 0 to 100000'],
  ['minutesPerOccurrence', 'Minutes per occurrence', '0 to 10000'],
  ['savedShare', 'Share of time saved', '0 to 1, e.g. 0.5'],
  ['commercialWeight', 'Commercial weight', '1 (low) to 3 (revenue-critical)'],
  ['buildDays', 'Build effort (days)', '0.5 to 365'],
];

function pageChoose(): Child[] {
  const v = view!; const rk = v.derived.ranking;
  const sel = v.workspace.selection;
  const rows = rk.rows.map((r) => {
    const c = r.candidate; const isSel = sel?.workflowId === c.id;
    return h('tr', { class: isSel ? 'selected' : '' },
      h('td', { class: 'num' }, r.rank ?? '–'),
      h('td', null, h('b', null, c.name), h('div', { class: 'small muted' }, r.status === 'RANKED' ? c.hypothesisNote : r.reason)),
      h('td', null, c.team),
      ...INPUTS.map(([k]) => h('td', { class: 'num' }, fmt(c[k] as number | null))),
      h('td', { class: 'num' }, h('b', null, r.leverage ?? '–')),
      h('td', null, statusChip(r.status), isSel ? h('div', { style: 'margin-top:6px' }, chip(v.derived.selectionStale ? '△ Selected, stale' : '● Selected', v.derived.selectionStale ? 'stale' : 'ok')) : null),
      h('td', null, h('div', { class: 'actions' },
        h('button', { class: 'secondary', 'aria-label': `Edit inputs for ${c.name}`, onclick: () => editCandidate(c.id), disabled: r.status === 'EXCLUDED' }, 'Edit'),
        h('button', { 'aria-label': `Select ${c.name}`, disabled: r.status !== 'RANKED' || (isSel && !v.derived.selectionStale), onclick: () => openDialog({ title: `Select “${c.name}”`, intro: 'Selection is bound to the current inputs. If any input changes later, the selection is marked stale.', body: [h('p', null, `Leverage hypothesis: ${r.leverage} weighted hours per month per build day.`)], submitLabel: 'Select workflow', onSubmit: () => run({ type: 'selectWorkflow', workflowId: c.id }, `Selected ${c.name}`) }) }, isSel ? 'Selected' : 'Select'))));
  });
  return [
    ...header('01 · Prioritise', 'Choose one commercial workflow worth the build', 'Rank candidate workflows across Sales, CS, Marketing, Ops and Talent by an explicit effort/value hypothesis. Unknown inputs are never filled in, and anything the company already sells is excluded rather than rebuilt.'),
    verdict(rk.recommendationId ? 'LEADS' : 'NO PICK', rk.verdict, rk.recommendationId ? 'ok' : 'hold'),
    h('div', { class: 'card', style: 'margin-top:16px' },
      h('h2', null, 'Leverage hypothesis'),
      h('p', { class: 'muted small mono' }, 'leverage = occurrences/month × minutes × share saved ÷ 60 × commercial weight ÷ build days'),
      h('p', { class: 'small muted' }, `${rk.rankedCount} of ${rk.total} workflows ranked. Every number is a synthetic hypothesis to test in discovery, not a measurement.`),
      h('div', { class: 'scroll' }, h('table', null,
        h('caption', { class: 'sr-only' }, 'Workflow candidates ranked by leverage hypothesis'),
        h('thead', null, h('tr', null, h('th', { class: 'num' }, 'Rank'), h('th', null, 'Workflow'), h('th', null, 'Team'), h('th', { class: 'num' }, 'Per month'), h('th', { class: 'num' }, 'Minutes'), h('th', { class: 'num' }, 'Share saved'), h('th', { class: 'num' }, 'Weight'), h('th', { class: 'num' }, 'Build days'), h('th', { class: 'num' }, 'Leverage'), h('th', null, 'Status'), h('th', null, h('span', { class: 'sr-only' }, 'Actions')))),
        h('tbody', null, ...rows)))),
  ];
}

function editCandidate(id: string) {
  const c = view!.workspace.candidates.find((x) => x.id === id)!;
  const fields = INPUTS.map(([k, label, hint]) => h('div', { class: 'formrow' }, h('label', { for: `in-${k}` }, label), h('input', { id: `in-${k}`, name: k, inputmode: 'decimal', value: c[k] === null ? '' : String(c[k]), 'aria-describedby': `in-${k}-h` }), h('p', { class: 'hint', id: `in-${k}-h` }, `${hint}. Leave blank for unknown.`)));
  openDialog({
    title: `Edit inputs: ${c.name}`, intro: 'Blank means unknown. An unknown input removes the workflow from the ranking instead of guessing.', body: fields, submitLabel: 'Save inputs',
    onSubmit: async (form) => {
      const data = new FormData(form);
      for (const [k] of INPUTS) {
        const raw = String(data.get(k) ?? '').trim();
        const value = raw === '' ? null : Number(raw);
        if (value !== null && !Number.isFinite(value)) return `${k}: not a number`;
        if (value === c[k]) continue;
        const err = await run({ type: 'updateCandidate', id, field: k, value }, 'Inputs saved');
        if (err) return err;
      }
      return null;
    },
  });
}

/* 02 Build vs buy */
function pageBuildBuy(): Child[] {
  const v = view!; const bb = v.derived.buildBuy; const crit = v.derived.criteria; const d = v.workspace.decision;
  return [
    ...header('02 · Decide', 'Build, buy, configure or do nothing', 'Weights are fixed up front. Unknown scores count as zero, and no option is recommended while any unknown could still flip the result at its best case.'),
    verdict(bb.recommendationId ? 'RECOMMEND' : 'NO PICK', bb.verdict, bb.recommendationId ? 'ok' : 'hold'),
    h('div', { class: 'card', style: 'margin-top:16px' },
      h('div', { class: 'scroll' }, h('table', null,
        h('caption', { class: 'sr-only' }, 'Weighted build-versus-buy scores, 1 to 5'),
        h('thead', null, h('tr', null, h('th', null, 'Option'), ...crit.map((c) => h('th', { class: 'num', title: c.question }, `${c.label} ×${c.weight}`)), h('th', { class: 'num' }, 'Score'), h('th', { class: 'num' }, 'Best case'), h('th', null, h('span', { class: 'sr-only' }, 'Actions')))),
        h('tbody', null, ...bb.rows.map((r) => h('tr', { class: bb.recommendationId === r.option.id ? 'selected' : '' },
          h('td', null, h('b', null, r.option.label), h('div', { class: 'small muted' }, r.option.summary)),
          ...crit.map((c) => h('td', { class: 'num', title: r.option.notes[c.id] ?? '' }, r.option.scores[c.id] ?? chip('? unknown', 'unknown'))),
          h('td', { class: 'num' }, h('b', null, r.score)),
          h('td', { class: 'num' }, r.upperBound),
          h('td', null, h('button', { class: 'secondary', 'aria-label': `Edit scores for ${r.option.label}`, onclick: () => editOption(r.option.id) }, 'Edit')))))))),
    h('div', { class: 'grid2', style: 'margin-top:16px' },
      h('div', { class: 'card' }, h('h2', null, 'Notes behind the scores'), h('ul', { class: 'gaps' }, ...v.workspace.options.flatMap((o) => Object.entries(o.notes).map(([k, n]) => h('li', null, h('b', null, `${o.label}, ${crit.find((c) => c.id === k)?.label}: `), n))))),
      h('div', { class: 'card' }, h('h2', null, 'Decision'),
        d ? h('p', null, `Recorded `, h('b', null, d.optionId), ` by ${d.by} at ${d.at}. `, v.derived.decisionStale ? chip('△ Stale: scores changed', 'stale') : chip('✓ Current', 'ok')) : h('p', { class: 'muted' }, 'No decision recorded.'),
        h('button', { disabled: !bb.recommendationId || (!!d && !v.derived.decisionStale && d.optionId === bb.recommendationId), onclick: () => openDialog({ title: 'Record the build-vs-buy decision', intro: 'The decision is bound to the current scores. Changing any score later marks it stale.', body: [h('p', null, bb.verdict), h('div', { class: 'formrow' }, h('label', { for: 'dec-by' }, 'Decision owner'), h('input', { id: 'dec-by', name: 'by', autocomplete: 'off', value: 'Business Operations (synthetic)' }))], submitLabel: 'Record decision', onSubmit: (f) => run({ type: 'recordDecision', optionId: bb.recommendationId!, by: String(new FormData(f).get('by') ?? '') }, 'Decision recorded') }) }, 'Record decision'))),
  ];
}

function editOption(id: string) {
  const v = view!; const o = v.workspace.options.find((x) => x.id === id)!;
  const body = v.derived.criteria.map((c) => h('div', { class: 'formrow' }, h('label', { for: `sc-${c.id}` }, `${c.label} (weight ${c.weight})`), h('select', { id: `sc-${c.id}`, name: c.id }, h('option', { value: '', selected: o.scores[c.id] === null }, 'Unknown'), ...[1, 2, 3, 4, 5].map((n) => h('option', { value: String(n), selected: o.scores[c.id] === n }, String(n)))), h('p', { class: 'hint' }, c.question)));
  openDialog({ title: `Scores: ${o.label}`, intro: '1 is worst, 5 is best. Unknown stays unknown.', body, submitLabel: 'Save scores', onSubmit: async (form) => {
    const data = new FormData(form);
    for (const c of v.derived.criteria) {
      const raw = String(data.get(c.id) ?? ''); const score = raw === '' ? null : Number(raw);
      if (score === o.scores[c.id as CriterionId]) continue;
      const err = await run({ type: 'setOptionScore', optionId: o.id, criterion: c.id, score }, 'Scores saved');
      if (err) return err;
    }
    return null;
  } });
}

/* 03 Desk */
function pageDesk(arg: string | null): Child[] {
  const v = view!;
  const packets = v.workspace.packets;
  const current = packets.find((p) => p.id === arg) ?? packets[0];
  const list = h('ul', { class: 'packets', 'aria-label': 'Handoff packets' }, ...packets.map((p) => {
    const e = v.derived.packets.find((x) => x.packetId === p.id)!;
    return h('li', null, h('a', { href: `#/desk/${encodeURIComponent(p.id)}`, 'aria-current': p.id === current?.id ? 'true' : undefined },
      h('div', { class: 'row' }, h('b', { class: 'mono small' }, p.id), p.execution ? chip('✓ RUN', 'ok') : statusChip(e.status)),
      h('div', { class: 'small' }, p.account), h('div', { class: 'small muted' }, `${p.segment} · closed ${p.closeDate}`)));
  }));
  const side = h('div', { class: 'stack' }, list, h('button', { class: 'secondary', onclick: importPackets }, 'Import packets (JSON)'), h('p', { class: 'small muted' }, `${packets.length} of ${v.limits.packets} packets. Imports are all-or-nothing.`));
  return [
    ...header('03 · Execute', 'Sales-to-onboarding handoff desk', 'Every implementation fact must quote an exact source. Missing facts stay unknown, contradictions abstain, stale sources are set aside, and instruction-like text is quarantined as data. Execution is simulated and writes to no external system.'),
    h('div', { class: 'desk' }, side, current ? packetDetail(current, v.derived.packets.find((x) => x.packetId === current.id)!) : h('div', { class: 'card' }, 'No packets.')),
  ];
}

function packetDetail(p: HandoffPacket, e: PacketEvaluation): HTMLElement {
  const v = view!;
  const kind = e.status === 'READY' ? 'ok' : e.status === 'ABSTAIN' ? 'abstain' : 'hold';
  const vText = p.execution ? `Executed as ${p.execution.receiptId}. The plan below was generated; nothing was sent or written outside this workspace.`
    : e.status === 'READY' ? (e.approvalValid ? 'Ready and approved. Execution will generate a simulated onboarding plan.' : e.approvalStale ? 'Ready, but the approval is stale: the packet changed after it was approved. Approve again.' : 'Ready for approval. Every required fact is cited, owned and checkpointed.')
    : e.status === 'ABSTAIN' ? `Abstain: ${e.gaps.filter((g) => g.kind === 'contradiction').length} field(s) have sources that disagree. A person must choose a cited value with a reason.`
    : `Hold: ${e.gaps.length} gap(s) before this can be approved.`;
  const locked = !!p.execution;
  const fieldRows = e.fields.map((f) => fieldRow(p, f, locked));
  const cp = p.checkpoint;
  return h('div', { class: 'stack', 'aria-labelledby': 'pk-title' },
    h('div', { class: 'card' },
      h('div', { class: 'actions', style: 'justify-content:space-between' }, h('div', null, h('p', { class: 'eyebrow' }, `${p.id} · ${p.segment}`), h('h2', { id: 'pk-title' }, p.account)), statusChip(p.execution ? 'READY' : e.status)),
      h('p', { class: 'small muted' }, `Closed ${p.closeDate} · AE ${p.ae} · content fingerprint `, h('span', { class: 'mono' }, e.fingerprint)),
      verdict(p.execution ? 'EXECUTED' : e.status, vText, p.execution ? 'ok' : kind)),
    h('div', { class: 'card' }, h('h3', null, 'Implementation facts'), h('p', { class: 'small muted' }, `${e.fields.filter((f) => f.status === 'RESOLVED').length} of ${e.fields.length} resolved from exact quotes.`), ...fieldRows),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', null, 'Accountability'),
        h('p', null, h('b', null, 'Owner: '), p.owner ?? chip('? unassigned', 'missing')),
        h('p', null, h('b', null, 'Adoption checkpoint: '), cp ? `${cp.date}: ${cp.metric} ≥ ${cp.thresholdPct}%` : chip('? not set', 'missing')),
        e.checkpointProblem && cp ? h('p', { class: 'small', style: 'color:var(--red-ink)' }, e.checkpointProblem) : null,
        h('div', { class: 'actions' }, h('button', { class: 'secondary', disabled: locked, onclick: () => assignOwner(p) }, 'Assign owner'), h('button', { class: 'secondary', disabled: locked, onclick: () => setCheckpoint(p, e) }, 'Set checkpoint'))),
      h('div', { class: 'card' }, h('h3', null, 'Gaps and risks'),
        e.gaps.length ? h('ul', { class: 'gaps' }, ...e.gaps.map((g) => h('li', null, h('b', null, g.message), h('div', { class: 'small muted' }, g.ask)))) : h('p', { class: 'muted' }, 'No open gaps.'),
        e.risks.length ? h('div', null, h('p', { class: 'eyebrow', style: 'margin-top:12px' }, 'Risks'), h('ul', { class: 'gaps' }, ...e.risks.map((r) => h('li', null, r)))) : null)),
    e.quarantined.length ? h('div', { class: 'quarantine', role: 'note' }, h('b', null, `Quarantined: ${e.quarantined.length} instruction-like sentence(s). Shown as inert text; they did not change any status or fact.`), ...e.quarantined.map((q) => h('pre', null, `${q.sourceId}: ${q.text}`))) : null,
    h('div', { class: 'card' }, h('h3', null, 'Approve and execute'),
      p.approval ? h('p', null, `Approved by ${p.approval.by} at ${p.approval.at} for fingerprint `, h('span', { class: 'mono' }, p.approval.fingerprint), ' ', e.approvalStale ? chip('△ Stale approval', 'stale') : chip('✓ Valid', 'ok')) : h('p', { class: 'muted' }, 'Not approved.'),
      h('div', { class: 'actions' },
        h('button', { class: 'secondary', disabled: locked || e.status !== 'READY' || e.approvalValid, onclick: () => approve(p, e) }, 'Approve'),
        h('button', { disabled: locked || !e.approvalValid, onclick: () => execute(p, e) }, 'Run bounded workflow'),
        h('button', { class: 'secondary', disabled: !locked || v.workspace.effort.some((r) => r.id === `V-${p.id}`), onclick: () => logEffort(p) }, 'Log observed minutes')),
      p.execution ? h('div', null, h('p', { class: 'eyebrow', style: 'margin-top:14px' }, `Simulated plan · ${p.execution.receiptId}`), h('ol', { class: 'plan' }, ...p.execution.plan.map((s) => h('li', null, s)))) : null),
    h('div', { class: 'card' }, h('h3', null, 'Sources (synthetic)'), h('p', { class: 'small muted' }, 'Green marks are cited evidence. Red marks are quarantined text. Struck-through sources are stale.'), ...p.sources.map((s) => sourceBlock(s, e))),
  );
}

function fieldRow(p: HandoffPacket, f: FieldResult, locked: boolean) {
  const quotes = [...f.evidence, ...f.staleEvidence].map((m) => h('blockquote', { class: `ev${m.stale ? ' stale' : ''}` }, `“${m.quote}”`, h('cite', null, `${m.sourceId} · ${m.capturedAt}${m.stale ? ' · stale, not used' : ''} · value ${m.value}`)));
  return h('div', { class: 'field' },
    h('div', { class: 'label' }, f.label),
    h('div', null, statusChip(f.status)),
    h('div', { class: 'body' },
      h('div', { class: 'value' }, f.value ?? 'Unknown'),
      h('div', { class: 'small muted' }, f.note),
      ...quotes,
      f.status === 'ABSTAIN' && !locked ? h('button', { class: 'secondary', style: 'margin-top:8px', onclick: () => resolve(p, f) }, `Resolve ${f.label.toLowerCase()}`) : null));
}

function sourceBlock(s: HandoffPacket['sources'][number], e: PacketEvaluation) {
  const marks = [
    ...e.fields.flatMap((f) => f.evidence.concat(f.staleEvidence)).filter((m) => m.sourceId === s.id).map((m) => ({ start: m.start, end: m.end, q: false })),
    ...e.quarantined.filter((q) => q.sourceId === s.id).map((q) => ({ start: q.start, end: q.end, q: true })),
  ].sort((a, b) => a.start - b.start);
  const parts: Child[] = []; let at = 0;
  for (const m of marks) { if (m.start < at) continue; parts.push(s.text.slice(at, m.start), h('mark', { class: m.q ? 'q' : '' }, s.text.slice(m.start, m.end))); at = m.end; }
  parts.push(s.text.slice(at));
  const stale = e.staleSources.includes(s.id);
  return h('div', { class: 'source', style: 'margin-top:10px' }, h('div', { class: 'actions', style: 'justify-content:space-between' }, h('span', { class: 'mono small' }, `${s.id} · ${s.kind.replace('_', ' ')} · ${s.author} · ${s.capturedAt}`), stale ? chip('△ STALE', 'stale') : null), h('pre', null, ...parts));
}

function assignOwner(p: HandoffPacket) {
  openDialog({ title: `Assign owner for ${p.id}`, intro: 'One accountable CS owner from the synthetic roster.', body: [h('div', { class: 'formrow' }, h('label', { for: 'own' }, 'CS owner'), h('select', { id: 'own', name: 'owner' }, ...view!.derived.roster.map((r) => h('option', { value: r, selected: r === p.owner }, r))))], submitLabel: 'Assign owner', onSubmit: (f) => run({ type: 'assignOwner', packetId: p.id, owner: String(new FormData(f).get('owner')) }, 'Owner assigned') });
}

function setCheckpoint(p: HandoffPacket, e: PacketEvaluation) {
  const goLive = e.fields.find((f) => f.field === 'goLive')!.value;
  openDialog({ title: `Adoption checkpoint for ${p.id}`, intro: goLive ? `Go-live is ${goLive}. The checkpoint must fall 14 to 90 days after it.` : 'Go-live is unknown, so no checkpoint can be validated yet.', body: [
    h('div', { class: 'formrow' }, h('label', { for: 'cp-d' }, 'Date (YYYY-MM-DD)'), h('input', { id: 'cp-d', name: 'date', value: p.checkpoint?.date ?? '', placeholder: 'YYYY-MM-DD', autocomplete: 'off' })),
    h('div', { class: 'formrow' }, h('label', { for: 'cp-m' }, 'Metric'), h('select', { id: 'cp-m', name: 'metric' }, ...view!.derived.metrics.map((m) => h('option', { value: m, selected: m === p.checkpoint?.metric }, m)))),
    h('div', { class: 'formrow' }, h('label', { for: 'cp-t' }, 'Threshold (%)'), h('input', { id: 'cp-t', name: 'threshold', inputmode: 'numeric', value: String(p.checkpoint?.thresholdPct ?? 70) })),
  ], submitLabel: 'Save checkpoint', onSubmit: (f) => { const d = new FormData(f); return run({ type: 'setCheckpoint', packetId: p.id, date: String(d.get('date') ?? '').trim(), metric: String(d.get('metric')), thresholdPct: Number(d.get('threshold')) }, 'Checkpoint saved'); } });
}

function resolve(p: HandoffPacket, f: FieldResult) {
  const opts = f.evidence.map((m, i) => h('label', { style: 'display:flex;gap:10px;font-weight:400;align-items:flex-start' }, h('input', { type: 'radio', name: 'pick', value: String(i), style: 'width:auto;min-height:0;margin-top:4px', checked: i === 0 }), h('span', null, h('b', null, m.value), h('span', { class: 'small muted' }, ` from ${m.sourceId}: “${m.quote}”`))));
  openDialog({ title: `Resolve ${f.label.toLowerCase()}`, intro: 'Pick one cited value and say why. The resolution is bound to this exact set of evidence; if the sources change, it no longer applies.', body: [h('fieldset', { style: 'border:0;padding:0;margin:0' }, h('legend', { class: 'sr-only' }, 'Cited values'), ...opts), h('div', { class: 'formrow' }, h('label', { for: 'rs-r' }, 'Reason'), h('input', { id: 'rs-r', name: 'reason', autocomplete: 'off', maxlength: '400' })), h('div', { class: 'formrow' }, h('label', { for: 'rs-b' }, 'Resolved by'), h('input', { id: 'rs-b', name: 'by', autocomplete: 'off', value: 'CS owner (synthetic)' }))], submitLabel: 'Resolve', onSubmit: (form) => { const d = new FormData(form); const m = f.evidence[Number(d.get('pick'))]; return run({ type: 'resolveContradiction', packetId: p.id, field: f.field as FieldId, value: m.value, sourceId: m.sourceId, reason: String(d.get('reason') ?? ''), by: String(d.get('by') ?? '') }, `${f.label} resolved`); } });
}

function approve(p: HandoffPacket, e: PacketEvaluation) {
  openDialog({ title: `Approve ${p.id}`, intro: `Approval binds to fingerprint ${e.fingerprint}. Any later edit makes it stale and blocks execution.`, body: [h('div', { class: 'formrow' }, h('label', { for: 'ap-b' }, 'Approver'), h('input', { id: 'ap-b', name: 'by', autocomplete: 'off', value: p.owner ?? '' }))], submitLabel: 'Approve', onSubmit: (f) => run({ type: 'approve', packetId: p.id, by: String(new FormData(f).get('by') ?? '') }, `${p.id} approved`) });
}

function execute(p: HandoffPacket, e: PacketEvaluation) {
  const key = randomKey('exec');
  openDialog({ title: `Run bounded workflow for ${p.id}`, intro: 'Generates a simulated onboarding plan from the cited facts. Nothing is emailed, posted or written to any CRM. Retrying uses the same idempotency key, so it cannot run twice.', body: [h('p', { class: 'mono small' }, `Idempotency key ${key}`), h('p', { class: 'small' }, `Fingerprint ${e.fingerprint}`)], submitLabel: 'Run simulation', onSubmit: () => run({ type: 'execute', packetId: p.id, idempotencyKey: key }, `${p.id} executed (simulated)`, key) });
}

function logEffort(p: HandoffPacket) {
  openDialog({ title: `Log observed minutes for ${p.id}`, intro: 'Synthetic minutes spent on this handoff with the checker. It joins the assisted arm for its segment. It is not a measurement of any real team.', body: [h('div', { class: 'formrow' }, h('label', { for: 'ef-m' }, 'Minutes (1 to 1000)'), h('input', { id: 'ef-m', name: 'minutes', inputmode: 'numeric', autocomplete: 'off' }))], submitLabel: 'Log minutes', onSubmit: (f) => { const raw = String(new FormData(f).get('minutes') ?? '').trim(); if (!/^\d+$/.test(raw)) return Promise.resolve('Minutes must be a whole number'); return run({ type: 'logEffort', packetId: p.id, minutes: Number(raw) }, 'Minutes logged'); } });
}

function importPackets() {
  const sample = JSON.stringify([{ id: 'HO-2001', account: 'Example Co (synthetic)', segment: 'mid-market', closeDate: '2026-10-08', ae: 'Example AE (synthetic)', sources: [{ id: 'SRC-2001-OF', kind: 'order_form', capturedAt: '2026-10-08', author: 'Order form (synthetic)', text: '25 licensed seats. Go-live date: 2026-10-29.' }] }], null, 2);
  openDialog({ title: 'Import handoff packets', intro: 'Paste a JSON list of synthetic packets. The whole import is rejected if any packet is invalid or duplicates an existing id.', body: [h('div', { class: 'formrow' }, h('label', { for: 'imp' }, 'Packets JSON'), h('textarea', { id: 'imp', name: 'json', spellcheck: 'false' }, sample))], submitLabel: 'Import', onSubmit: (f) => { let packets: unknown; try { packets = JSON.parse(String(new FormData(f).get('json') ?? '')); } catch { return Promise.resolve('Not valid JSON; nothing was imported'); } return run({ type: 'importPackets', packets }, 'Packets imported'); } });
}

/* 04 Effort */
function pageEffort(): Child[] {
  const ef = view!.derived.effort;
  return [
    ...header('04 · Measure', 'Baseline vs observed effort (synthetic)', 'Minutes per handoff, compared within each segment. Rows with missing timing or partial timers are excluded and listed. A segment with no baseline is never counted as impact.'),
    verdict(ef.verdict, ef.verdictText, 'hold'),
    h('div', { class: 'kpis', style: 'margin-top:16px' },
      h('div', { class: 'kpi' }, h('b', null, `${ef.totals.baselineIncluded}/${ef.totals.baselineTotal}`), h('span', null, 'Baseline rows included')),
      h('div', { class: 'kpi' }, h('b', null, `${ef.totals.assistedIncluded}/${ef.totals.assistedTotal}`), h('span', null, 'Assisted rows included')),
      h('div', { class: 'kpi' }, h('b', null, fmt(ef.aggregate.difference, ' min')), h('span', null, 'Aggregate difference (misleading if mix differs)')),
      h('div', { class: 'kpi' }, h('b', null, fmt(ef.mixAdjusted.difference, ' min')), h('span', null, `Within-segment difference, ${ef.mixAdjusted.coveredSegments.join(', ') || 'no'} segment(s)`))),
    ef.misleadingAggregate ? h('p', { class: 'quarantine', style: 'margin-top:16px' }, `The aggregate difference is driven by segment mix: enterprise is ${Math.round((ef.mix.baselineEnterpriseShare ?? 0) * 100)}% of baseline rows but ${Math.round((ef.mix.assistedEnterpriseShare ?? 0) * 100)}% of assisted rows. Read the per-segment table instead.`) : null,
    h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', null, 'By segment'), h('div', { class: 'scroll' }, h('table', null,
      h('caption', { class: 'sr-only' }, 'Mean minutes per handoff by segment and arm'),
      h('thead', null, h('tr', null, h('th', null, 'Segment'), h('th', { class: 'num' }, 'Baseline n'), h('th', { class: 'num' }, 'Baseline mean'), h('th', { class: 'num' }, 'Assisted n'), h('th', { class: 'num' }, 'Assisted mean'), h('th', { class: 'num' }, 'Difference'), h('th', null, 'Status'))),
      h('tbody', null, ...ef.segments.map((s) => h('tr', null, h('td', null, s.segment), h('td', { class: 'num' }, `${s.baseline.n} (+${s.baseline.excluded} excl.)`), h('td', { class: 'num' }, fmt(s.baseline.mean)), h('td', { class: 'num' }, `${s.assisted.n} (+${s.assisted.excluded} excl.)`), h('td', { class: 'num' }, fmt(s.assisted.mean)), h('td', { class: 'num' }, s.difference ?? '–'), h('td', null, statusChip(s.status), h('div', { class: 'small muted' }, s.note)))))))),
    h('div', { class: 'grid2', style: 'margin-top:16px' },
      h('div', { class: 'card' }, h('h2', null, `Exclusions (${ef.exclusions.length})`), ef.exclusions.length ? h('ul', { class: 'gaps' }, ...ef.exclusions.map((x) => h('li', null, h('span', { class: 'mono' }, x.id), ` · ${x.arm} · ${x.segment}: ${x.reason}`))) : h('p', { class: 'muted' }, 'None.')),
      h('div', { class: 'card' }, h('h2', null, 'Add synthetic rows'), h('p', { class: 'small muted' }, 'CSV with header id,arm,segment,minutes,status. Blank minutes means unknown and is excluded. A bad line rejects the whole file.'), h('button', { class: 'secondary', onclick: importCsv }, 'Import effort CSV'))),
  ];
}

function importCsv() {
  openDialog({ title: 'Import effort CSV', intro: 'All-or-nothing. Rows are labelled as visitor-entered synthetic data.', body: [h('div', { class: 'formrow' }, h('label', { for: 'csv' }, 'CSV'), h('textarea', { id: 'csv', name: 'csv', spellcheck: 'false' }, 'id,arm,segment,minutes,status\nX-01,baseline,strategic,92,complete\nX-02,baseline,strategic,,complete'))], submitLabel: 'Import', onSubmit: (f) => run({ type: 'importEffortCsv', csv: String(new FormData(f).get('csv') ?? '') }, 'Effort rows imported') });
}

/* 05 Playbook */
function pagePlaybook(): Child[] {
  const v = view!;
  const pre = h('pre', { class: 'export', 'aria-label': 'Playbook preview', tabindex: '0' }, 'Loading preview…');
  fetch('/api/export/playbook.md', { credentials: 'same-origin' }).then((r) => r.text()).then((t) => (pre.textContent = t)).catch(() => (pre.textContent = 'Preview failed to load.'));
  return [
    ...header('05 · Reuse', 'Operating playbook and audit', 'Export the pattern with the evidence behind every decision. The playbook is DRAFT until at least one packet has been executed.'),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: '/api/export/playbook.md', download: 'operating-playbook.md' }, 'Download playbook (.md)'), h('a', { class: 'btn secondary', href: '/api/export/audit.json', download: 'audit.json' }, 'Download audit (.json)'),
      h('button', { class: 'secondary', onclick: () => openDialog({ title: 'Reset workspace', intro: 'Replaces your workspace with the original synthetic fixtures and clears the audit log. Other visitors are not affected.', body: [h('p', null, 'This cannot be undone. Export the audit first if you want to keep it.')], submitLabel: 'Reset workspace', danger: true, onSubmit: () => run({ type: 'reset' }, 'Workspace reset') }) }, 'Reset workspace')),
    h('div', { class: 'grid2', style: 'margin-top:16px' },
      h('div', { class: 'card' }, h('h2', null, 'Playbook preview'), pre),
      h('div', { class: 'card' }, h('h2', null, `Audit log (${v.eventCount} of ${v.limits.events} events)`), h('ol', { class: 'events', tabindex: '0', 'aria-label': 'Recent audit events' }, ...v.events.slice().reverse().map((e) => h('li', null, `#${e.seq} r${e.revision} ${e.at.slice(0, 19)}Z ${e.type}${e.subject ? ' ' + e.subject : ''}: ${e.detail}`))))),
  ];
}

/* 06 Evals */
function pageEvals(): Child[] {
  const box = h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Running…'));
  const load = async () => {
    const [std, brk] = await Promise.all(['standard', 'broken'].map((x) => fetch(`/api/evals?variant=${x}`).then((r) => r.json())));
    box.replaceChildren(...[std, brk].map((out) => h('div', { class: 'card' },
      h('div', { class: 'actions', style: 'justify-content:space-between' }, h('h2', null, out.variant === 'broken' ? 'Deliberately broken rule: first value wins on contradiction' : 'Standard rules'), chip(`${out.passed} pass · ${out.failed} fail`, out.failed ? 'bad' : 'ok')),
      h('div', { class: 'scroll' }, h('table', null, h('caption', { class: 'sr-only' }, `Expected versus actual, ${out.rules}`), h('thead', null, h('tr', null, h('th', null, 'Case'), h('th', null, 'Expected'), h('th', null, 'Actual'), h('th', null, 'Result'))),
        h('tbody', null, ...out.results.map((r: { id: string; title: string; expected: string; actual: string; pass: boolean }) => h('tr', { class: `evalrow${r.pass ? '' : ' fail'}` }, h('td', null, h('span', { class: 'mono small' }, r.id), ' ', r.title), h('td', { class: 'mono small' }, r.expected), h('td', { class: 'mono small' }, r.actual), h('td', null, statusChip(r.pass ? 'PASS' : 'FAIL'))))))))));
  };
  load().catch(() => box.replaceChildren(h('p', null, 'Evals failed to load.')));
  return [...header('06 · Verify', 'Expected vs actual evaluations', 'The same cases run against the real rules and against a deliberately broken rule that silently takes the first value when sources disagree. The broken run must turn red.'), box];
}

/* 07 About */
function pageAbout(): Child[] {
  const docs = [['PRD', 'prd.md'], ['ELI5', 'eli5.md'], ['Five whys', 'five-whys.md'], ['Jobs to be done', 'jtbd.md'], ['Discovery hypotheses and interview guide', 'discovery.md'], ['Metrics with denominators', 'metrics.md'], ['Assumptions', 'assumptions.md'], ['Trade-offs', 'tradeoffs.md'], ['Risk register', 'risks.md'], ['Build-vs-buy memo', 'build-vs-buy.md'], ['Role viability', 'role-viability.md'], ['V2 roadmap', 'roadmap-v2.md'], ['Test results', 'test-results.md'], ['Decision log', 'decision-log.md'], ['Claims and caveats', 'claims.md'], ['Research and sources', 'research.md'], ['Design', 'design.md']];
  return [
    ...header('07 · Context', 'What this is, and what it is not', 'An independent concept by Ayo Ahmed for a Business Operations role. It shows how I would choose, scope and ship one commercial workflow. It is not a company product and makes no claim about any company\'s internal problems.'),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', null, 'Claims and caveats'), h('ul', { class: 'gaps' },
        h('li', null, 'All companies, people, deals, minutes and scores are synthetic.'),
        h('li', null, 'Workflow sizing is a hypothesis to test in discovery, not a measurement.'),
        h('li', null, 'No interviews were run. The interview guide is a plan.'),
        h('li', null, 'No lift is claimed. The effort page holds by design on this data.'),
        h('li', null, 'Execution is simulated. Nothing is emailed, posted or written to a CRM.'),
        h('li', null, 'Not affiliated with, endorsed by or built for Metaview. Its name and wordmark appear only to say who this concept is addressed to.'),
        h('li', null, 'Your workspace is private to this browser (a random cookie) and bounded in size.'))),
      h('div', { class: 'card' }, h('h2', null, 'PM documents'), h('ul', { class: 'gaps' }, ...docs.map(([label, file]) => h('li', null, h('a', { href: `${REPO}/blob/main/docs/${file}`, target: '_blank', rel: 'noopener noreferrer' }, label)))))),
  ];
}

window.addEventListener('hashchange', () => { render(); document.getElementById('page-title')?.focus(); });
if (!location.hash) history.replaceState(null, '', '#/choose');
refresh();
