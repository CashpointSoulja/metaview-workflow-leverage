import type { BuildBuyOption, Criterion } from './types.ts';
import { isFiniteNumber, round } from './util.ts';

export const CRITERIA: Criterion[] = [
  { id: 'timeToValue', label: 'Time to first value', weight: 0.2, question: 'How fast does a CS owner get a usable handoff?' },
  { id: 'evidenceFit', label: 'Evidence rules fit', weight: 0.3, question: 'Can it cite exact sources, hold on missing facts and abstain on contradictions?' },
  { id: 'runningCost', label: 'Running cost', weight: 0.15, question: 'Recurring spend (5 = none)' },
  { id: 'maintenance', label: 'Maintenance burden', weight: 0.15, question: 'Who keeps it working (5 = nobody needs to)' },
  { id: 'security', label: 'Data and security posture', weight: 0.1, question: 'New data processors or access needed (5 = none)' },
  { id: 'reversibility', label: 'Reversibility', weight: 0.1, question: 'How cheaply can we undo it?' },
];

export const MIN_MARGIN = 0.15;

export interface OptionScore {
  option: BuildBuyOption;
  score: number;
  upperBound: number;
  coverage: number;
  unknown: string[];
}

export interface BuildBuyResult {
  rows: OptionScore[];
  recommendationId: BuildBuyOption['id'] | null;
  verdict: string;
}

export function scoreOptions(options: BuildBuyOption[]): BuildBuyResult {
  const rows = options.map((o) => {
    let score = 0, unknownWeight = 0;
    const unknown: string[] = [];
    for (const c of CRITERIA) {
      const s = o.scores[c.id];
      if (isFiniteNumber(s)) score += c.weight * s;
      else { unknownWeight += c.weight; unknown.push(c.label); }
    }
    return { option: o, score: round(score, 2), upperBound: round(score + unknownWeight * 5, 2), coverage: round(1 - unknownWeight, 2), unknown };
  }).sort((a, b) => b.score - a.score || a.option.id.localeCompare(b.option.id));
  if (rows.length < 2) return { rows, recommendationId: null, verdict: 'No recommendation: need at least two options to compare.' };
  const [top, ...rest] = rows;
  if (top.unknown.length > 0) {
    return { rows, recommendationId: null, verdict: `No recommendation: the leading option (${top.option.label}) still has unknown ${top.unknown.join(', ')}.` };
  }
  const threat = rest.find((r) => r.upperBound >= top.score);
  if (threat) {
    return { rows, recommendationId: null, verdict: `No recommendation: ${threat.option.label} could still reach ${threat.upperBound} if its unknown ${threat.unknown.join(', ') || 'criteria'} come back at best case, against ${top.score} for ${top.option.label}.` };
  }
  const margin = round(top.score - rest[0].score, 2);
  if (margin < MIN_MARGIN) {
    return { rows, recommendationId: null, verdict: `No recommendation: ${top.option.label} leads ${rest[0].option.label} by only ${margin} (needs ${MIN_MARGIN}).` };
  }
  return { rows, recommendationId: top.option.id, verdict: `${top.option.label}: ${top.score} / 5 with full coverage, ahead by ${margin}. No other option can catch it even at best case on its unknowns.` };
}

export function validScore(v: unknown): v is number | null {
  return v === null || (isFiniteNumber(v) && Number.isInteger(v) && v >= 1 && v <= 5);
}
