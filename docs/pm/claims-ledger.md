# Claims and caveats ledger

| Claim made in this repo | Basis | Caveat |
|---|---|---|
| Metaview's Business Operations role emphasises leverage, cross-functional workflows and build vs buy | public job posting, quoted in `docs/research.md` | posting may change |
| Recruiter search and interview notes are part of Metaview's public product | public website | my reading of public pages |
| The handoff is the highest-leverage workflow | synthetic inputs in the ranking | hypothesis only; no internal data |
| Build scores 4.15 vs 3.95 for configure | synthetic scores | change the scores and the answer changes |
| Assisted minutes are lower than baseline in some segments | synthetic timer rows | not a measurement; never lift |
| No external system is written | code: `onboardingPlan` only builds text; Worker has no outbound fetch | checked by reading code and tests |
| Visitor data is isolated | one Durable Object per random visitor id; `test/api.test.ts` | local Workers runtime, not production |
| Tests and evals pass | `docs/pm/test-results.md`, actual command output | rerun to confirm |
| Demo video | local recording only, see `video/README.md` | not public footage until deployed (historical, pre-release; see [LIVE_RELEASE.md](../LIVE_RELEASE.md) for the published walkthrough) |

No interviews were run. No customer, employee or candidate data was used. No lift was measured.
