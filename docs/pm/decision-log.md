# Decision log

| Date | Decision | Why | Alternatives |
|---|---|---|---|
| 2026-10-13 | Sales-to-onboarding handoff as the bounded workflow | crosses Sales and CS, commercial, has checkable facts | inbound routing (likely covered by CRM), renewal brief (needs usage data) |
| 2026-10-13 | Exclude recruiter search and interview scheduling | public product overlap | rebuild as a demo |
| 2026-10-13 | Deterministic extraction with exact quotes | reproducible, free, auditable | model extraction |
| 2026-10-13 | Abstain on contradictions; keep a broken first-wins rule as a red eval | makes the failure mode visible | silent precedence rules |
| 2026-10-13 | 45-day staleness window | demo default, documented as an assumption | none, or per-field windows |
| 2026-10-13 | Approval bound to a content fingerprint | stops stale approvals | timestamp-only approval |
| 2026-10-13 | One SQLite Durable Object per visitor on Workers Free | isolation, revision checks, no paid services | KV, D1 shared database |
| 2026-10-13 | Mix-adjusted effort comparison, HOLD below 5 rows per arm per segment | avoids segment-mix artefacts and small samples | raw aggregate |
| 2026-10-13 | Open fonts (Figtree, IBM Plex Mono) instead of the company's fonts | no copying proprietary assets | system fonts |
| 2026-10-13 | No deploy; Wrangler dry-run only | brief says deploy later after independent audit | deploy now |
