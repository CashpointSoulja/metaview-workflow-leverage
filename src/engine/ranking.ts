import type { WorkflowCandidate } from './types.ts';
import { isFiniteNumber, round } from './util.ts';

export type RankStatus = 'RANKED' | 'UNKNOWN' | 'EXCLUDED';

export interface RankedCandidate {
  candidate: WorkflowCandidate;
  status: RankStatus;
  valueHoursPerMonth: number | null;
  leverage: number | null;
  rank: number | null;
  known: number;
  of: number;
  missing: string[];
  reason: string;
}

export interface RankingResult {
  rows: RankedCandidate[];
  recommendationId: string | null;
  verdict: string;
  rankedCount: number;
  total: number;
}

const INPUTS: [keyof WorkflowCandidate, string][] = [
  ['occurrencesPerMonth', 'occurrences per month'],
  ['minutesPerOccurrence', 'minutes per occurrence'],
  ['savedShare', 'share of time saved'],
  ['commercialWeight', 'commercial weight'],
  ['buildDays', 'build effort (days)'],
];

export const CLEAR_MARGIN = 0.1;

export function rankWorkflows(candidates: WorkflowCandidate[]): RankingResult {
  const rows: RankedCandidate[] = candidates.map((c) => {
    const missing = INPUTS.filter(([k]) => !isFiniteNumber(c[k])).map(([, label]) => label);
    const known = INPUTS.length - missing.length;
    if (c.overlapsProduct) {
      return { candidate: c, status: 'EXCLUDED', valueHoursPerMonth: null, leverage: null, rank: null, known, of: INPUTS.length, missing, reason: c.overlapsProduct };
    }
    if (missing.length > 0) {
      return { candidate: c, status: 'UNKNOWN', valueHoursPerMonth: null, leverage: null, rank: null, known, of: INPUTS.length, missing, reason: `Not ranked: missing ${missing.join(', ')}` };
    }
    const value = (c.occurrencesPerMonth! * c.minutesPerOccurrence! * c.savedShare! / 60) * c.commercialWeight!;
    const leverage = value / c.buildDays!;
    return { candidate: c, status: 'RANKED', valueHoursPerMonth: round(value, 2), leverage: round(leverage, 2), rank: null, known, of: INPUTS.length, missing, reason: 'All five inputs present' };
  });
  const ranked = rows.filter((r) => r.status === 'RANKED').sort((a, b) => (b.leverage! - a.leverage!) || a.candidate.id.localeCompare(b.candidate.id));
  ranked.forEach((r, i) => (r.rank = i + 1));
  const order = [...ranked, ...rows.filter((r) => r.status === 'UNKNOWN'), ...rows.filter((r) => r.status === 'EXCLUDED')];
  let recommendationId: string | null = null;
  let verdict: string;
  if (ranked.length === 0) verdict = 'No recommendation: no workflow has all five inputs.';
  else if (ranked.length === 1) {
    recommendationId = ranked[0].candidate.id;
    verdict = `Only one workflow is fully specified (${ranked[0].candidate.name}). Treat it as a candidate, not a winner, until others are sized.`;
  } else {
    const [a, b] = ranked;
    const margin = (a.leverage! - b.leverage!) / a.leverage!;
    if (margin >= CLEAR_MARGIN) {
      recommendationId = a.candidate.id;
      verdict = `${a.candidate.name} leads on the hypothesis: ${a.leverage} weighted hours/month per build day vs ${b.leverage} for the next (${Math.round(margin * 100)}% margin).`;
    } else {
      verdict = `Too close to call: ${a.candidate.name} and ${b.candidate.name} are within ${Math.round(margin * 100)}%. Run discovery on both before building.`;
    }
  }
  return { rows: order, recommendationId, verdict, rankedCount: ranked.length, total: rows.length };
}
