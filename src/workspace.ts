import { DurableObject } from 'cloudflare:workers';
import type { EventRecord, Workspace } from './engine/types.ts';
import { LIMITS } from './engine/types.ts';
import { seedWorkspace } from './engine/fixtures.ts';
import { applyCommand, decisionStale, selectionStale, type Command } from './engine/commands.ts';
import { isWorkspace, Rejection } from './engine/validate.ts';
import { rankWorkflows } from './engine/ranking.ts';
import { CRITERIA, scoreOptions } from './engine/buildBuy.ts';
import { CHECKPOINT_METRICS, OWNER_ROSTER, evaluatePacket } from './engine/handoff.ts';
import { measureEffort } from './engine/effort.ts';
import { buildAudit, buildPlaybook } from './engine/playbook.ts';
import { fingerprint } from './engine/util.ts';

export interface Env { WORKSPACE: DurableObjectNamespace<VisitorWorkspace>; ASSETS: Fetcher }

const REQUEST_KEYS_KEPT = 200;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

/** One instance per visitor. SQLite storage; every write is a single transaction. */
export class VisitorWorkspace extends DurableObject<Env> {
  private sql: SqlStorage;
  private recovered: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, type TEXT NOT NULL, revision INTEGER NOT NULL, subject TEXT, detail TEXT NOT NULL)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS requests (k TEXT PRIMARY KEY, fp TEXT NOT NULL, status INTEGER NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL)`);
    });
  }

  private now() { return new Date().toISOString(); }

  private load(): Workspace {
    const row = this.sql.exec<{ v: string }>(`SELECT v FROM kv WHERE k = 'workspace'`).toArray()[0];
    if (!row) {
      const ws = seedWorkspace();
      this.ctx.storage.transactionSync(() => {
        this.sql.exec(`INSERT INTO kv (k, v) VALUES ('workspace', ?)`, JSON.stringify(ws));
        this.addEvents(ws.revision, [{ type: 'workspace.created', subject: null, detail: 'Seeded with synthetic fixtures' }]);
      });
      return ws;
    }
    let parsed: unknown = null;
    try { parsed = JSON.parse(row.v); } catch { parsed = null; }
    if (isWorkspace(parsed)) return parsed;
    const prior = parsed && typeof parsed === 'object' && Number.isInteger((parsed as Workspace).revision) ? (parsed as Workspace).revision : 0;
    const ws = seedWorkspace();
    ws.revision = Math.max(1, prior + 1);
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(`INSERT OR REPLACE INTO kv (k, v) VALUES ('corrupt_backup', ?)`, row.v.slice(0, 512 * 1024));
      this.sql.exec(`UPDATE kv SET v = ? WHERE k = 'workspace'`, JSON.stringify(ws));
      this.addEvents(ws.revision, [{ type: 'workspace.recovered', subject: null, detail: 'Stored state failed validation; backed up and reseeded from synthetic fixtures' }]);
    });
    this.recovered = 'Your stored workspace failed validation, so it was backed up and reset to the synthetic fixtures.';
    return ws;
  }

  private addEvents(revision: number, events: { type: string; subject: string | null; detail: string }[]) {
    const at = this.now();
    for (const e of events) this.sql.exec(`INSERT INTO events (at, type, revision, subject, detail) VALUES (?, ?, ?, ?, ?)`, at, e.type, revision, e.subject, e.detail.slice(0, 1000));
  }

  private eventCount(): number {
    return this.sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM events`).one().n;
  }

  events(limit: number = LIMITS.events): EventRecord[] {
    return this.sql.exec(`SELECT seq, at, type, revision, subject, detail FROM events ORDER BY seq DESC LIMIT ?`, limit).toArray().reverse() as unknown as EventRecord[];
  }

  async view() {
    const ws = this.load();
    const notice = this.recovered;
    this.recovered = null;
    return {
      revision: ws.revision,
      workspace: ws,
      derived: {
        ranking: rankWorkflows(ws.candidates),
        buildBuy: scoreOptions(ws.options),
        criteria: CRITERIA,
        packets: ws.packets.map((p) => evaluatePacket(p)),
        effort: measureEffort(ws.effort),
        selectionStale: selectionStale(ws),
        decisionStale: decisionStale(ws),
        roster: OWNER_ROSTER,
        metrics: CHECKPOINT_METRICS,
      },
      events: this.events(60),
      eventCount: this.eventCount(),
      limits: LIMITS,
      recovered: notice,
    };
  }

  async command(input: { expectedRevision?: unknown; command?: unknown; requestKey?: unknown }): Promise<{ status: number; body: unknown; replay: boolean }> {
    const key = typeof input.requestKey === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(input.requestKey) ? input.requestKey : null;
    if (input.requestKey !== undefined && !key) return { status: 400, body: { error: 'invalid_request_key', message: 'Idempotency-Key must be 8-80 letters, digits, dashes or underscores' }, replay: false };
    const reqFp = fingerprint({ e: input.expectedRevision, c: input.command });
    if (key) {
      const prev = this.sql.exec<{ fp: string; status: number; body: string }>(`SELECT fp, status, body FROM requests WHERE k = ?`, key).toArray()[0];
      if (prev) {
        if (prev.fp !== reqFp) return { status: 422, body: { error: 'key_reused', message: 'This Idempotency-Key was already used for a different request' }, replay: false };
        return { status: prev.status, body: JSON.parse(prev.body), replay: true };
      }
    }
    const ws = this.load();
    let status = 200, body: unknown;
    if (!Number.isInteger(input.expectedRevision)) {
      status = 400; body = { error: 'missing_revision', message: 'expectedRevision is required' };
    } else if (input.expectedRevision !== ws.revision) {
      status = 409; body = { error: 'revision_conflict', message: `Workspace is at revision ${ws.revision}, you sent ${input.expectedRevision}. Reload and retry.`, revision: ws.revision };
    } else {
      try {
        const out = applyCommand(ws, input.command as Command, this.now());
        const isReset = (input.command as Command).type === 'reset';
        if (out.changed && !isReset && this.eventCount() + out.events.length > LIMITS.events) {
          throw new Rejection(409, 'audit_full', `The audit log holds ${LIMITS.events} events. Export it, then reset.`);
        }
        this.ctx.storage.transactionSync(() => {
          if (out.changed) {
            if (isReset) this.sql.exec(`DELETE FROM events`);
            this.sql.exec(`UPDATE kv SET v = ? WHERE k = 'workspace'`, JSON.stringify(out.ws));
            this.addEvents(out.ws.revision, out.events);
          }
          body = { ok: true, revision: out.ws.revision, result: out.result };
          if (key) this.saveRequest(key, reqFp, 200, body);
        });
        return { status: 200, body, replay: false };
      } catch (e) {
        if (!(e instanceof Rejection)) throw e;
        status = e.status; body = { error: e.code, message: e.message };
      }
    }
    if (key && status !== 409) this.ctx.storage.transactionSync(() => this.saveRequest(key, reqFp, status, body));
    return { status, body, replay: false };
  }

  private saveRequest(key: string, fp: string, status: number, body: unknown) {
    this.sql.exec(`INSERT INTO requests (k, fp, status, body, at) VALUES (?, ?, ?, ?, ?)`, key, fp, status, JSON.stringify(body), this.now());
    this.sql.exec(`DELETE FROM requests WHERE k NOT IN (SELECT k FROM requests ORDER BY at DESC, rowid DESC LIMIT ?)`, REQUEST_KEYS_KEPT);
  }

  async playbook(): Promise<string> { return buildPlaybook(this.load(), this.now()); }
  async audit(): Promise<unknown> { return buildAudit(this.load(), this.events(), this.now()); }

  /** Test hook only, reachable through runInDurableObject, never routed. */
  corruptForTest(raw: string) { this.sql.exec(`UPDATE kv SET v = ? WHERE k = 'workspace'`, raw); }
}

export { json };
