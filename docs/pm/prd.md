# PRD: Commercial Workflow Leverage Lab

Independent concept by Ayo Ahmed. Not affiliated with, endorsed by or built for Metaview. Every company, person, deal and number in the product is synthetic.

## Problem I am testing

A Business Operations hire is asked to find leverage, not to add headcount. The trap is building whatever is loudest, or rebuilding something the company already sells. I want a repeatable way to pick one commercial workflow, prove it on a bounded slice, and leave behind a playbook other teams can reuse.

I do not know Metaview's internal workflows, volumes, owners or tools. Every number below is a hypothesis to check in discovery, not a finding.

## Who it is for

- Me, as a Business Operations owner deciding what to build first.
- A Sales or CS lead who has to trust the output before acting on it.
- Whoever inherits the workflow after me and needs the rules written down.

## Scope (v1)

1. **Choose.** Rank eight candidate workflows across Sales, CS, Marketing, Ops and Talent with one stated formula: `occurrences/month × minutes × share saved ÷ 60 × commercial weight ÷ build days`. Missing inputs leave a workflow unranked. Workflows the company already sells (recruiter search, interview scheduling and notes) are excluded rather than rebuilt. A winner is only named with a margin of at least 10% over second place.
2. **Build vs buy.** Score build, buy, configure-the-CRM and do-nothing on six weighted criteria. Unknown scores produce an upper bound; if the upper bound of an unknown option could beat the leader, there is no recommendation.
3. **Run the handoff.** A synthetic sales-to-onboarding desk. Each of eight implementation facts (ATS, seats, go-live, SSO, video tool, recording consent, executive sponsor, success criterion) must quote an exact source sentence. Missing facts stay unknown. Sources that disagree abstain until a person picks a cited value and gives a reason. Evidence more than 45 days older than close is set aside. Instruction-like text is quarantined as data.
4. **Approve and execute.** A packet needs an accountable CS owner and an adoption checkpoint (14 to 90 days, named metric, threshold) before approval. Approval is bound to a content fingerprint; any edit makes it stale. Execution is idempotent and produces a simulated onboarding plan. Nothing external is written.
5. **Effort.** Compare synthetic baseline and assisted minutes per segment. Partial timers and missing minutes are excluded and listed. Segments with no baseline are not compared. The aggregate is mix-adjusted and the screen warns when the raw aggregate would mislead. The output is never called lift or impact.
6. **Export.** A Markdown operating playbook and a JSON audit with fingerprints, events, approvals and field provenance.

## Out of scope

Real customer data, CRM or billing writes, email or chat messages, recruiter search, candidate evaluation, paid services, production integration.

## Requirements

| ID | Requirement | Where it is checked |
|---|---|---|
| R1 | Unknown ranking inputs never rank | `test/engine.test.ts`, eval E09 |
| R2 | Product-overlap workflows excluded | eval E08 |
| R3 | Every resolved fact cites a source id and exact quote | eval E01, UI desk |
| R4 | Contradictions abstain until resolved with a cited value and reason | evals E02 to E04 |
| R5 | Stale evidence excluded | eval E06 |
| R6 | Hostile text quarantined, cannot set facts | eval E07, tests |
| R7 | Approval bound to fingerprint, stale on edit | eval E14, tests |
| R8 | Execution idempotent, no external writes | eval E16, API tests |
| R9 | Effort excludes partial or missing rows, no baseline means no comparison | eval E13, tests |
| R10 | Per-visitor isolation, revision checks, atomic imports, bounded state, recovery | `test/api.test.ts` |

## Success for this concept

The concept is useful if a reviewer can follow one packet from ranking to export and see, at every step, which claim came from where and what is still unknown. It is not evidence that the workflow would save time at Metaview.
