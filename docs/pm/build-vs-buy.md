# Build vs buy memo

**Decision in the lab:** build a thin evidence checker (weighted score 4.15), with CRM configuration close behind (3.95). The recommendation stands because the buy option's upper bound (3.85, with running cost and security unknown) can't beat the leader. All scores are my synthetic hypotheses.

| Criterion | Weight | Build thin checker | Configure CRM | Buy onboarding platform (category) | Do nothing |
|---|---|---|---|---|---|
| Time to value | 0.20 | 4 | 5 | 3 | 1 |
| Evidence fit | 0.30 | 5 | 2 | 4 | 1 |
| Running cost | 0.15 | 4 | 5 | unknown | 5 |
| Maintenance | 0.15 | 3 | 4 | 4 | 5 |
| Security | 0.10 | 4 | 5 | unknown | 5 |
| Reversibility | 0.10 | 4 | 5 | 2 | 5 |
| **Weighted** | | **4.15** | 3.95 | 2.60 known, upper bound 3.85 | 3.00 |

Scores are 1 to 5, higher is better. Current values live in `src/engine/fixtures.ts` (`seedOptions`) and on the Build vs buy screen. Anyone can change a score and watch the recommendation move or withdraw.

## Why build wins here

- The value is in the evidence rule (cite or unknown, abstain on conflict), which neither CRM fields nor a generic onboarding tool enforce.
- It's small: one extractor, one rule set, one export. Easy to delete if it fails.

## When I would switch

- **Configure** if discovery shows facts are mostly captured in structured fields already (H5).
- **Buy** if a vendor quote and security review come back and the tool enforces cited facts. Until those are known, buy stays unranked above its upper bound.
- **Do nothing** if H2 and H3 fail: few contradictions and little time spent.
