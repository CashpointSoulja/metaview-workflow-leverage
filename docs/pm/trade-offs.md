# Trade-offs

- **Abstain vs guess.** Abstaining on contradictions creates visible work for a person. Guessing would look faster and hide errors. I chose abstain because a wrong ATS is more expensive than a question. The deliberately broken rule (`BROKEN_FIRST_WINS`) shows what guessing looks like: three evals go red.
- **Regex extraction vs a model.** The extractor is deterministic patterns with exact quotes. It misses phrasings a model would catch, but every result is reproducible, auditable and free to run. A model could be a v2 candidate generator, still gated by the same cite-or-unknown rule.
- **Strict staleness.** A fixed 45-day window will occasionally drop a still-true fact. The cost is one confirmation question; the benefit is not building an onboarding plan on an old note.
- **Fingerprint-bound approval.** Any edit after approval forces re-approval. That's friction, but approval of content that later changed is worse.
- **Per-visitor Durable Object.** One SQLite-backed object per visitor gives strong isolation and simple revision checks, at the cost of no shared team view in v1.
- **Simulated execution.** No CRM or email writes keeps the concept safe and free, but means the lab can't show real downstream effects.
- **Ranking formula.** One explicit formula is easy to argue with and easy to get wrong. I show the formula and every input so a reviewer can change them.
