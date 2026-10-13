# Deployment checklist (not yet deployed)

> **Historical, pre-release record.** This file describes the state before the 13 October 2026 release. Its statements that the app is not deployed or the video is not public are superseded; the current publication record is [LIVE_RELEASE.md](LIVE_RELEASE.md).

Target: Cloudflare Workers Free. Deploy only to the destination approved separately.

1. `npm ci`
2. `npm run typecheck && npm test && npm run evals`
3. `npm run dryrun`: builds assets and bundles the Worker without uploading.
4. Check that the worker name `metaview-workflow-leverage` doesn't collide with an existing Worker on the account. Change `name` in `wrangler.jsonc` if it does. Never overwrite an unrelated Worker.
5. `npx wrangler deploy` (only once approved).
6. After deploy: open `/api/health`, confirm `{"ok":true,"synthetic":true,"externalWrites":"none"}`, then walk one packet end to end.

Free-tier fit: one Worker, static assets, one Durable Object class on the SQLite backend (available on the Free plan), no KV, D1, R2, Queues or secrets. State per visitor is bounded (`LIMITS` in `src/engine/types.ts`).
