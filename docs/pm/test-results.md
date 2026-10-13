# Test results

These are the actual outputs from the last run, on 2026-10-13, on a local machine (Node 24.19, workerd via `@cloudflare/vitest-pool-workers` 0.23). I edited out nothing except the local checkout path. Nothing here was run against a deployed URL, because nothing is deployed.

## Summary

| Check | Command | Result |
|---|---|---|
| Type check (backend, tests, web) | `npm run typecheck` | exit 0 |
| Unit and Worker API tests | `npm test` | 2 files, 55 of 55 passed, exit 0 |
| Standard evaluations | `npm run evals` | 16 passed, 0 failed, exit 0 |
| Deliberately broken rule | `npm run evals:broken` | 13 passed, 3 failed (E02, E03, E04), exit 1, as intended |
| Production build | `npm run build` | exit 0 |
| Workers Free dry run | `npm run dryrun` | exit 0, no upload |
| Accessibility (axe-core, WCAG 2.1 A/AA rules) | Playwright plus axe-core, 7 pages at 1366 and 390 px | 0 violations |
| Keyboard and dialog | same script | skip link, modal focus trap, Escape, focus return all behaved as below |
| Narrow viewport overflow | screenshot script at 390 px | 0 px horizontal overflow on all 7 pages, 0 console or page errors |

## Broken rule

`BROKEN_FIRST_WINS` replaces contradiction abstention with "take the first source". The suite must turn red, and it does: the three contradiction cases fail and the process exits 1. If this suite ever goes green, the evals have stopped testing what they claim to.

```
PASS E01 Clean packet with owner and checkpoint is READY
FAIL E02 Two sources disagree on ATS: abstain, do not pick
FAIL E03 Two sources disagree on seats: abstain, do not pick
FAIL E04 Packet with contradictions is ABSTAIN overall
PASS E05 SSO never mentioned stays unknown
PASS E06 Consent only in a 91-day-old security review is stale, not used
PASS E07 Injected instruction is quarantined; its go-live date is ignored
PASS E08 Recruiter-search clone and product overlaps are excluded from ranking
PASS E09 Workflow with an unknown input is not ranked
PASS E10 Top-ranked workflow is the sales-to-onboarding handoff
PASS E11 Build vs buy recommends build at full coverage
PASS E12 Unknown evidence-fit on build withholds any recommendation
PASS E13 Effort comparison holds; no-baseline segment is not counted
PASS E14 Edit after approval makes approval stale and blocks execution
PASS E15 Checkpoint before go-live is rejected
PASS E16 Same idempotency key replays the same receipt
13 passed, 3 failed of 16
```

## Standard evaluations

```
PASS E01 Clean packet with owner and checkpoint is READY
PASS E02 Two sources disagree on ATS: abstain, do not pick
PASS E03 Two sources disagree on seats: abstain, do not pick
PASS E04 Packet with contradictions is ABSTAIN overall
PASS E05 SSO never mentioned stays unknown
PASS E06 Consent only in a 91-day-old security review is stale, not used
PASS E07 Injected instruction is quarantined; its go-live date is ignored
PASS E08 Recruiter-search clone and product overlaps are excluded from ranking
PASS E09 Workflow with an unknown input is not ranked
PASS E10 Top-ranked workflow is the sales-to-onboarding handoff
PASS E11 Build vs buy recommends build at full coverage
PASS E12 Unknown evidence-fit on build withholds any recommendation
PASS E13 Effort comparison holds; no-baseline segment is not counted
PASS E14 Edit after approval makes approval stale and blocks execution
PASS E15 Checkpoint before go-live is rejected
PASS E16 Same idempotency key replays the same receipt
16 passed, 0 failed of 16
```

## Tests (`npm test`, verbose)

```
✓ test/engine.test.ts > happy path > ranks, decides, approves, executes, logs effort and exports a non-draft playbook 8ms
✓ test/engine.test.ts > happy path > playbook is DRAFT before any execution 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"selectWorkflow","workflowId":"candidate-search"} -> not_rankable 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"selectWorkflow","workflowId":"discount-approval"} -> not_rankable 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"updateCandidate","id":"sales-cs-handoff","field":"savedShare","value":1.5} -> invalid_number 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"updateCandidate","id":"sales-cs-handoff","field":"occurrencesPerMonth","value":null} -> invalid_number 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"setOptionScore","optionId":"build","criterion":"security","score":6} -> invalid_number 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"recordDecision","optionId":"buy","by":"x"} -> not_recommended 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"assignOwner","packetId":"HO-1001","owner":"Someone Else"} -> invalid_owner 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"setCheckpoint","packetId":"HO-1001","date":"2026-02-30","metric":"Share of licensed interviewers with notes enabled","thresholdPct":70} -> invalid_date 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"setCheckpoint","packetId":"HO-1001","date":"2026-11-03","metric":"Revenue","thresholdPct":70} -> invalid_field 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"setCheckpoint","packetId":"HO-1001","date":"2026-11-03","metric":"Share of licensed interviewers with notes enabled","thresholdPct":0} -> invalid_number 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"setCheckpoint","packetId":"HO-1001","date":"2027-03-01","metric":"Share of licensed interviewers with notes enabled","thresholdPct":70} -> invalid_checkpoint 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"approve","packetId":"HO-1002","by":"x"} -> not_ready 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"execute","packetId":"HO-1001","idempotencyKey":"k"} -> not_approved 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"logEffort","packetId":"HO-1001","minutes":10} -> not_executed 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"approve","packetId":"HO-9999","by":"x"} -> not_found 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"drop_tables"} -> unknown_command 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importEffortCsv","csv":"id,arm,segment,minutes,status\nX1,baseline,enterprise,\"12,complete"} -> invalid_csv 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importEffortCsv","csv":"id,arm,segment,minutes\nX1,baseline,enterprise,12"} -> invalid_csv 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importEffortCsv","csv":"id,arm,segment,minutes,status\nX1,baseline,enterprise,-4,complete"} -> invalid_csv 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"importEffortCsv","csv":"id,arm,segment,minutes,status\nB-01,baseline,enterprise,12,complete"} -> duplicate_id 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importPackets","packets":[]} -> invalid_import 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importPackets","packets":[{"id":"HO-1001","account":"a","segment":"enterprise","closeDate":"2026-10-01","ae":"a","sources":[{"id":"SRC-X","kind":"call_note","capturedAt":"2026-10-01","author":"a","text":"t"}]}]} -> duplicate_id 0ms
✓ test/engine.test.ts > rejected inputs > a bad packet anywhere in an import rejects the whole import (atomic) 1ms
✓ test/engine.test.ts > rejected inputs > limits are enforced 0ms
✓ test/engine.test.ts > rejected inputs > strict dates 1ms
✓ test/engine.test.ts > unknowns stay unknown > a missing input removes a workflow from the ranking, never fills it 0ms
✓ test/engine.test.ts > unknowns stay unknown > near-tie gives no winner 0ms
✓ test/engine.test.ts > unknowns stay unknown > an unknown score that could flip the result withholds the recommendation 0ms
✓ test/engine.test.ts > unknowns stay unknown > a missing baseline is not turned into impact 0ms
✓ test/engine.test.ts > hostile content > instruction-like text is quarantined and cannot set a fact or status 0ms
✓ test/engine.test.ts > hostile content > markup in sources is escaped in markdown exports 1ms
✓ test/engine.test.ts > hostile content > table-breaking characters are escaped 1ms
✓ test/engine.test.ts > hostile content > control characters in names are rejected 0ms
✓ test/engine.test.ts > staleness > evidence older than 45 days before close is not used 0ms
✓ test/engine.test.ts > staleness > editing after approval invalidates it 1ms
✓ test/engine.test.ts > staleness > a resolution stops applying when the evidence changes 1ms
✓ test/engine.test.ts > staleness > selection and decision go stale when their inputs change 1ms
✓ test/engine.test.ts > idempotent execution > same key replays without a new revision; a different key is refused 1ms
✓ test/engine.test.ts > evaluations > standard rules pass every case 3ms
✓ test/engine.test.ts > evaluations > the deliberately broken rule turns red on the contradiction cases 3ms
✓ test/api.test.ts > worker API > health is up and says no external writes 4ms
✓ test/api.test.ts > worker API > issues an HttpOnly visitor cookie and seeds revision 1 16ms
✓ test/api.test.ts > worker API > rejects requests without the CSRF header, wrong type, bad JSON or oversized bodies 17ms
✓ test/api.test.ts > worker API > visitor isolation: one visitor cannot see or change another 25ms
✓ test/api.test.ts > worker API > a forged or malformed cookie gets a fresh workspace, not someone else's 8ms
✓ test/api.test.ts > worker API > concurrent commands at the same revision: exactly one wins, the other gets 409 20ms
✓ test/api.test.ts > worker API > idempotency keys replay the stored response and refuse reuse for a different body 20ms
✓ test/api.test.ts > worker API > full bounded workflow through the API with simulated execution and exports 38ms
✓ test/api.test.ts > worker API > rejected commands leave state unchanged 13ms
✓ test/api.test.ts > worker API > recovery: corrupt stored state is backed up, reseeded and reported once 25ms
✓ test/api.test.ts > worker API > reset restores fixtures and clears the event log for that visitor only 29ms
✓ test/api.test.ts > worker API > evals endpoint: standard is green, broken is red 9ms
✓ test/api.test.ts > worker API > unknown routes 404 as JSON 6ms
```

Coverage by brief requirement:

- Happy path: the full select, decide, resolve, own, checkpoint, approve, execute and log flow, end to end over HTTP.
- Rejected inputs: wrong content type, missing CSRF header, bad JSON, oversized body, bad dates, out-of-range numbers, unknown commands, control characters, non-atomic imports.
- Hostile content: instruction-like text quarantined; HTML/script escaped in playbook Markdown.
- Staleness: sources more than 45 days before close set aside; approval goes stale after edits; selection and decision go stale when inputs change.
- Concurrent actions: parallel commands at the same revision, where exactly one wins and the rest get 409.
- Visitor isolation: two cookies see independent state; forged cookies get a fresh workspace; reset touches only one visitor.
- Recovery: corrupt stored state is backed up and reseeded.
- Idempotency: replaying an `Idempotency-Key` returns the same receipt without a second execution.

## Workers Free dry run

```
 ⛅️ wrangler 4.150.0
────────────────────
✨ Read 43 files from the assets directory ./dist
Total Upload: 75.12 KiB / gzip: 22.23 KiB
Your Worker has access to the following bindings:
Binding                               Resource            
env.WORKSPACE (VisitorWorkspace)      Durable Object      
env.ASSETS                            Assets              
--dry-run: exiting now.
```

## Accessibility and keyboard

Screenshots are in [../screenshots/](../screenshots/) (`d-` 1366 px desktop, `m-` 390 px mobile, plus the owner dialog at both widths).

```
axe violations: {}
desktop: first Tab focuses "Skip to content"
desktop: after Enter on skip link, focus is <H1#page-title>
desktop: dialog after Enter on "Assign owner": {"modal":true,"label":"Assign owner for HO-1001","focusInside":true,"focused":"SELECT owner"}
desktop: 10 Tabs in dialog -> inside:Cancel, inside:Assign owner, browser-chrome, inside:✕, inside:owner, inside:Cancel, inside:Assign owner, browser-chrome, inside:✕, inside:owner; page content reachable: false
desktop: after Escape dialog open=false, focus returned to "Assign owner"
mobile: first Tab focuses "Skip to content"
mobile: after Enter on skip link, focus is <H1#page-title>
mobile: dialog after Enter on "Assign owner": {"modal":true,"label":"Assign owner for HO-1001","focusInside":true,"focused":"SELECT owner"}
mobile: 10 Tabs in dialog -> inside:Cancel, inside:Assign owner, browser-chrome, inside:✕, inside:owner, inside:Cancel, inside:Assign owner, browser-chrome, inside:✕, inside:owner; page content reachable: false
mobile: after Escape dialog open=false, focus returned to "Assign owner"
```

Contrast pairs are listed in [../design.md](../design.md). The lowest body-text pair is muted text `#4A4D5E` on cream `#FBF8F4`, which passes AA.

## What these results do not show

- No deployed or public URL was tested. Nothing is deployed.
- No real customer, deal, employee or candidate data was used. Every fixture is synthetic.
- The effort numbers are synthetic fixtures. They are not measured time savings, lift or impact.
- No screen-reader session with real assistive technology was run. Only automated axe rules and the keyboard script.
- The walkthrough video is a local draft against `wrangler dev`, not public footage. See [../../video/README.md](../../video/README.md).
