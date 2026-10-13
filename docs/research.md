# Research notes: role, business and constraints

Independent concept by Ayo Ahmed. Not affiliated with, endorsed by or built for Metaview. Everything below about Metaview comes from public pages read on 13 October 2026. Anything about how Metaview works internally is a **hypothesis**, not a finding.

## Sources read

| # | Source | What I took from it |
|---|---|---|
| S1 | Metaview Business Operations job post, `jobs.ashbyhq.com/metaview/f69ac278-53ba-4644-9181-93bade4678b3` (London) | The role's scope (quoted below) |
| S2 | `metaview.ai` home page | Product positioning: "the Agentic Recruiting Platform"; agents for sourcing, application review, screening, notes and reports |
| S3 | `metaview.ai` pricing page (read only; not linked from the app, see Publication restrictions) | Free, Pro, Max per-user plans; Enterprise "Tailored pricing", "Dedicated support & training", "Enterprise security features" |
| S4 | `metaview.ai` integrations page (read only) | ATS, video conferencing, calendar and SSO integrations; FAQ: "Metaview is ready to use instantly. No setup or training required." |
| S5 | `metaview.ai` security page (read only) | Candidate recording consent, audio-only capture, on-demand deletion, GDPR/CCPA |
| S6 | `metaview.ai` website terms of use (read only) | Linking and framing restrictions (see below) |

## The role, in its own words (S1)

- "our biggest constraint on output is no longer headcount. It's leverage."
- "Every team at Metaview (Sales, CS, Marketing, Ops, Talent) hits bottlenecks and runs workflows that should be 10x faster with AI in the loop."
- "This is a builder role reporting to co-founder/CEO, deployed wherever the work is hardest and the commercial leverage is highest."
- Ownership areas: "Identify the highest-leverage workflows that drive commercial outcomes within non-engineering teams ... diagnose the constraints, and ship AI-native solutions"; "Set the bar for AI-native operating across the company"; "turn any learnings into reusable patterns"; "Decide what to build in-house vs. what to buy."
- Principles: Velocity, Hospitality, Transparency ("Public unless private"), End-to-end.

## What this concept takes from the role

1. **Pick one workflow, on purpose.** The role is about choosing where leverage is highest, not about rebuilding Metaview's product. So the Lab ranks internal commercial workflows and leaves recruiting search out on purpose: Metaview already sells sourcing agents (S2).
2. **Sales to onboarding handoff** was picked as the bounded workflow. It is commercial, it involves two teams (Sales and CS), and the public pages list the facts an enterprise rollout depends on: ATS, video conferencing, calendar, SSO (S4), and recording consent posture (S5). The Enterprise tier promises "Dedicated support & training" (S3).
3. **Respect what the product already does.** S4 says self-serve use needs "No setup or training". The Lab limits the handoff to sales-led Enterprise deals, where S3 describes tailored pricing and dedicated support. It makes no claim about how Metaview hands off deals today.
4. **Build vs buy** is an explicit ownership area, so it is a first-class step with its own memo.

## What I do not know (and the Lab does not pretend to)

- How Metaview's Sales and CS teams hand off deals today, what tools they use, or how long it takes.
- Any internal volume, deal count, onboarding time or adoption rate. Every number in the Lab is a synthetic fixture and says so.
- Whether this workflow is actually Metaview's highest-leverage one. The ranking is a hypothesis to test in discovery.

## Publication restrictions found (S6)

- "The Metaview Website must not be framed on any other site, nor may you create a link to any part of the Metaview Website other than the home page."
- "You must not establish a link in such a way as to suggest any form of association with or approval or endorsement by Metaview where none exists."
- "When using the Metaview Website you must not: aggregate, copy, reproduce, distribute or re-sell any content on the Metaview Website".

How the repo complies:
- The app and docs link only to `https://www.metaview.ai/` (home page). Other Metaview pages are cited by name and path as plain text, not links.
- The job post is hosted on `jobs.ashbyhq.com` and linked there.
- No Metaview page is framed or embedded. No screenshots of Metaview's site or product are committed. Reference screenshots were inspected locally for the design and are not in the repo.
- Short quotes are used for commentary and attribution only. No product screens, imagery, customer logos or testimonials are reproduced.
- The Metaview wordmark is shown small, in a contextual "Concept for" label, with a non-affiliation notice beside it. See `design.md`.
