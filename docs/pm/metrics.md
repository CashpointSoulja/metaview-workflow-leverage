# Metrics with denominators

Every metric names its numerator, its denominator and what's excluded. In the lab all values are synthetic. None of them is a measured result.

| Metric | Numerator | Denominator | Exclusions | Why it matters |
|---|---|---|---|---|
| Fact coverage | facts resolved with a cited quote | 8 facts × packets in scope | quarantined and stale sources | shows what still has to be asked |
| Contradiction rate | packets with 1+ abstained field | packets reviewed | none | if low, the abstain rule costs little |
| Owner coverage | packets with an accountable CS owner | packets READY or HOLD | ABSTAIN packets | gaps without owners do not close |
| Checkpoint follow-through | checkpoints met by their date | checkpoints set and due | checkpoints not yet due | the adoption signal |
| Assisted minutes per packet (by segment) | sum of complete assisted timer minutes | complete assisted rows in that segment | partial timers, missing minutes | effort on the new path |
| Baseline minutes per packet (by segment) | sum of complete baseline minutes | complete baseline rows in that segment | partial timers, missing minutes | comparison point |
| Mix-adjusted difference | Σ segment difference × assisted share | segments that have both arms | segments with no baseline | stops a segment mix shift looking like savings |
| Playbook adoption | packets executed with the playbook | packets closed in the period | packets before rollout | shows whether the pattern is reused |

Minimum sample before any comparison: 5 complete rows per arm per segment (`MIN_ROWS` in `src/engine/effort.ts`). Below that the verdict is HOLD.

Guardrail metrics: kickoff date slip (days), re-asked facts per kickoff, AE minutes at handoff. If AE minutes go up, the workflow has moved work around rather than removed it.
