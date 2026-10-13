import type { EffortRow, Segment } from './types.ts';
import { round } from './util.ts';

export const MIN_ARM_N = 5;
export const MIN_CELL_N = 3;
export const SEGMENTS: Segment[] = ['enterprise', 'mid-market', 'strategic'];

export interface Cell { n: number; excluded: number; mean: number | null }
export interface SegmentRow {
  segment: Segment;
  baseline: Cell;
  assisted: Cell;
  difference: number | null;
  status: 'COMPARABLE' | 'INSUFFICIENT' | 'NO_BASELINE' | 'NO_ASSISTED' | 'EMPTY';
  note: string;
}
export interface Exclusion { id: string; arm: string; segment: Segment; reason: string }
export interface EffortResult {
  segments: SegmentRow[];
  exclusions: Exclusion[];
  totals: { baselineIncluded: number; baselineTotal: number; assistedIncluded: number; assistedTotal: number };
  aggregate: { baselineMean: number | null; assistedMean: number | null; difference: number | null };
  mixAdjusted: { difference: number | null; coveredSegments: Segment[]; baselineShareCovered: number };
  mix: { baselineEnterpriseShare: number | null; assistedEnterpriseShare: number | null };
  misleadingAggregate: boolean;
  verdict: 'HOLD' | 'NO DECISION';
  verdictText: string;
}

function exclusionReason(r: EffortRow): string | null {
  if (r.minutes === null) return 'Missing timing: no minutes recorded';
  if (r.status === 'partial') return 'Timer incomplete: partial handoff';
  return null;
}
const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 1) : null);

export function measureEffort(rows: EffortRow[]): EffortResult {
  const exclusions: Exclusion[] = [];
  const included: EffortRow[] = [];
  for (const r of rows) {
    const why = exclusionReason(r);
    if (why) exclusions.push({ id: r.id, arm: r.arm, segment: r.segment, reason: why });
    else included.push(r);
  }
  const cell = (arm: string, seg: Segment): Cell => {
    const inc = included.filter((r) => r.arm === arm && r.segment === seg).map((r) => r.minutes!);
    return { n: inc.length, excluded: exclusions.filter((e) => e.arm === arm && e.segment === seg).length, mean: mean(inc) };
  };
  const segments: SegmentRow[] = SEGMENTS.map((segment) => {
    const baseline = cell('baseline', segment), assisted = cell('assisted', segment);
    if (baseline.n === 0 && assisted.n === 0) return { segment, baseline, assisted, difference: null, status: 'EMPTY' as const, note: 'No included rows' };
    if (baseline.n === 0) return { segment, baseline, assisted, difference: null, status: 'NO_BASELINE' as const, note: 'No baseline: nothing to compare against, not counted as impact' };
    if (assisted.n === 0) return { segment, baseline, assisted, difference: null, status: 'NO_ASSISTED' as const, note: 'No assisted rows yet' };
    if (baseline.n < MIN_CELL_N || assisted.n < MIN_CELL_N) return { segment, baseline, assisted, difference: null, status: 'INSUFFICIENT' as const, note: `Fewer than ${MIN_CELL_N} included rows in an arm` };
    return { segment, baseline, assisted, difference: round(assisted.mean! - baseline.mean!, 1), status: 'COMPARABLE' as const, note: 'Both arms have enough rows' };
  });
  const arm = (a: string) => included.filter((r) => r.arm === a);
  const b = arm('baseline'), s = arm('assisted');
  const bMean = mean(b.map((r) => r.minutes!)), sMean = mean(s.map((r) => r.minutes!));
  const comparable = segments.filter((x) => x.status === 'COMPARABLE');
  const coveredBase = comparable.reduce((n, x) => n + x.baseline.n, 0);
  const mixDiff = comparable.length && coveredBase ? round(comparable.reduce((acc, x) => acc + x.difference! * x.baseline.n, 0) / coveredBase, 1) : null;
  const share = (xs: EffortRow[]) => (xs.length ? round(xs.filter((r) => r.segment === 'enterprise').length / xs.length, 2) : null);
  const aggDiff = bMean !== null && sMean !== null ? round(sMean - bMean, 1) : null;
  const bShare = share(b), sShare = share(s);
  const misleading = aggDiff !== null && (mixDiff === null || Math.sign(aggDiff) !== Math.sign(mixDiff) || Math.abs(mixDiff) < Math.abs(aggDiff) / 2) && bShare !== sShare;
  const reasons: string[] = [];
  if (b.length < MIN_ARM_N || s.length < MIN_ARM_N) reasons.push(`an arm has fewer than ${MIN_ARM_N} included rows (baseline ${b.length}, assisted ${s.length})`);
  const thin = segments.filter((x) => x.status === 'INSUFFICIENT' || x.status === 'NO_BASELINE').map((x) => x.segment);
  if (thin.length) reasons.push(`${thin.join(', ')} cannot be compared`);
  if (misleading) reasons.push(`the aggregate (${aggDiff} min) is driven by segment mix (enterprise ${pct(bShare)} of baseline vs ${pct(sShare)} of assisted)`);
  const verdict = reasons.length ? 'HOLD' : 'NO DECISION';
  const verdictText = reasons.length
    ? `Hold: ${reasons.join('; ')}. These are synthetic rows, so nothing here is a measured result.`
    : `No decision: a mix-adjusted synthetic difference of ${mixDiff} min per handoff is shown for method only. Synthetic rows are not evidence of impact.`;
  return {
    segments, exclusions,
    totals: { baselineIncluded: b.length, baselineTotal: rows.filter((r) => r.arm === 'baseline').length, assistedIncluded: s.length, assistedTotal: rows.filter((r) => r.arm === 'assisted').length },
    aggregate: { baselineMean: bMean, assistedMean: sMean, difference: aggDiff },
    mixAdjusted: { difference: mixDiff, coveredSegments: comparable.map((x) => x.segment), baselineShareCovered: b.length ? round(coveredBase / b.length, 2) : 0 },
    mix: { baselineEnterpriseShare: bShare, assistedEnterpriseShare: sShare },
    misleadingAggregate: misleading,
    verdict, verdictText,
  };
}
const pct = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
