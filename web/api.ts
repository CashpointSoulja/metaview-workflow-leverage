import type { Workspace, EventRecord, Criterion } from '../src/engine/types.ts';
import type { RankingResult } from '../src/engine/ranking.ts';
import type { BuildBuyResult } from '../src/engine/buildBuy.ts';
import type { PacketEvaluation } from '../src/engine/handoff.ts';
import type { EffortResult } from '../src/engine/effort.ts';
import type { Command } from '../src/engine/commands.ts';
import { randomKey } from './dom.ts';

export interface View {
  revision: number;
  workspace: Workspace;
  derived: { ranking: RankingResult; buildBuy: BuildBuyResult; criteria: Criterion[]; packets: PacketEvaluation[]; effort: EffortResult; selectionStale: boolean; decisionStale: boolean; roster: string[]; metrics: string[] };
  events: EventRecord[];
  eventCount: number;
  limits: Record<string, number>;
  recovered: string | null;
}

export async function getView(): Promise<View> {
  const r = await fetch('/api/state', { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`State request failed (${r.status})`);
  return r.json();
}

export interface SendResult { ok: boolean; status: number; error?: string; message?: string; result?: unknown; replayed?: boolean }

export async function send(revision: number, command: Command, key = randomKey('req')): Promise<SendResult> {
  try {
    const r = await fetch('/api/commands', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'cwl', 'idempotency-key': key },
      body: JSON.stringify({ expectedRevision: revision, command }),
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, error: body.error, message: body.message, result: body.result, replayed: r.headers.get('idempotent-replay') === 'true' };
  } catch {
    return { ok: false, status: 0, error: 'network', message: 'Network error: nothing was confirmed. Retry is safe; the same request key is reused.' };
  }
}
