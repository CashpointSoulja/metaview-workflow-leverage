# Commercial Workflow Leverage Lab

Independent concept and code by Ayo Ahmed. Not affiliated with, endorsed by or built for Metaview. Metaview is named only as the company this concept is addressed to. Every company, person, deal and number in the app is synthetic.

The lab shows how I would pick one high-leverage commercial workflow for a Business Operations role, prove it on a bounded slice, and leave a reusable playbook behind. It deliberately does not rebuild recruiter search or interview scheduling, because those are the company's own public product.

## Live release

- Live demo: https://metaview-workflow-leverage.ayoahmed-49d.workers.dev
- Voiced public walkthrough: https://drive.google.com/file/d/1rWTOKwmyELOlZ1igR3-dXH_5BrAdUEBN/view?usp=drivesdk&authuser=ayomideahmedcp%40gmail.com
- Release record: [docs/LIVE_RELEASE.md](docs/LIVE_RELEASE.md)

## What it does

1. **Choose a workflow.** Eight candidates across Sales, CS, Marketing, Ops and Talent, ranked by one visible formula: `occurrences/month × minutes × share saved ÷ 60 × commercial weight ÷ build days`. Missing inputs leave a workflow unranked. Product-overlap workflows are excluded. A winner needs a 10% margin.
2. **Build vs buy.** Build, configure the CRM, buy a category tool, or do nothing, on six weighted criteria. Unknown scores give an upper bound and can withhold the recommendation.
3. **Handoff desk.** Five synthetic sales-to-onboarding packets. Each implementation fact cites a source id and the exact quote. Missing facts stay unknown, conflicting sources abstain until a person picks a cited value and gives a reason, evidence more than 45 days old at close is set aside, and instruction-like text is quarantined as data.
4. **Approve and execute.** A packet needs an accountable CS owner and an adoption checkpoint. Approval is bound to a content fingerprint. Execution is idempotent and produces a simulated plan. Nothing external is written.
5. **Effort.** Synthetic baseline vs assisted minutes per segment, with partial and missing rows excluded and listed, no comparison where there's no baseline, and a mix-adjusted aggregate. Never described as lift.
6. **Export.** Markdown operating playbook and JSON audit.

## Architecture

- `src/engine/`: pure TypeScript rules (ranking, build vs buy, evidence extraction, effort, commands, playbook).
- `src/worker.ts`: Cloudflare Worker API with security headers, visitor cookie and write checks: same-origin `Origin`, no cross-site `Sec-Fetch-Site`, the `X-Requested-With: cwl` header and JSON only.
- `src/body.ts`: reads request bodies as a stream, counting bytes and stopping at the 256 KiB limit before anything is buffered, then decodes strict UTF-8.
- `src/workspace.ts`: one SQLite-backed Durable Object per visitor. Revision checks, idempotency keys, atomic imports, bounded event log, validation on load with backup and reseed.
- `web/`: responsive UI (Vite, no framework), safe DOM construction, native dialogs.
- `eval/`: 16 expected/actual evaluation cases, plus a deliberately broken rule.

## Run it

```bash
npm install
npm run dev            # vite build + wrangler dev on http://localhost:8787
npm run typecheck
npm test               # vite build + vitest in the Workers runtime
npm run check:browser  # Playwright + axe against a running `npm run dev` (APP_URL, default http://127.0.0.1:8787)
npm run evals          # standard rules: all cases pass
npm run evals:broken   # first-source-wins rule: contradiction cases fail, exit code 1
npm run dryrun         # wrangler deploy --dry-run, no deploy
```

Node 22+ is needed for `--experimental-strip-types`.

## Deployment

Historical, pre-release note (superseded by the [live release record](docs/LIVE_RELEASE.md)): not deployed. `wrangler.jsonc` targets Workers Free: one Worker, static assets, and a SQLite Durable Object class (`new_sqlite_classes`). No paid bindings, no secrets, no outbound requests. See [docs/deploy.md](docs/deploy.md).

## Documents

- Research and sources: [docs/research.md](docs/research.md)
- Design system: [docs/design.md](docs/design.md), [visual guide](docs/visual-guide.html)
- PM package: [PRD](docs/pm/prd.md), [ELI5](docs/pm/eli5.md), [five whys](docs/pm/five-whys.md), [JTBD](docs/pm/jtbd.md), [discovery and interview guide](docs/pm/discovery.md), [metrics](docs/pm/metrics.md), [assumptions](docs/pm/assumptions.md), [trade-offs](docs/pm/trade-offs.md), [risk register](docs/pm/risk-register.md), [build vs buy](docs/pm/build-vs-buy.md), [role viability](docs/pm/role-viability.md), [v2 roadmap](docs/pm/roadmap-v2.md), [decision log](docs/pm/decision-log.md), [claims ledger](docs/pm/claims-ledger.md)
- Actual test results: [docs/pm/test-results.md](docs/pm/test-results.md)
- Screenshots: [docs/screenshots/](docs/screenshots/)
- Demo video source: [video/README.md](video/README.md)

## Publication notes

The Metaview wordmark appears small, once, linked only to https://www.metaview.ai/. No product screens, fonts, photography, customer logos or customer data are copied. Fonts are Figtree and IBM Plex Mono (SIL Open Font License). No interviews were run and no impact was measured.

## Licence

Code: MIT, © 2026 Ayo Ahmed. The Metaview name and wordmark belong to their owner and are not covered by this licence.
