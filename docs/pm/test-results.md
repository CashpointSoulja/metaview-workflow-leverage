# Test results

> **Historical, pre-release record.** This file describes the state before the 13 October 2026 release. Its statements that the app is not deployed or the video is not public are superseded; the current publication record is [LIVE_RELEASE.md](../LIVE_RELEASE.md).

These are the actual outputs from the last run, on 2026-10-13, on a local machine (Node 24.19, workerd via `@cloudflare/vitest-pool-workers` 0.23). I edited out nothing except the local checkout path. Nothing here was run against a deployed URL, because nothing is deployed.

## Summary

| Check | Command | Result |
|---|---|---|
| Type check (backend, tests, web) | `npm run typecheck` | exit 0 |
| Unit and Worker API tests | `npm test` | 2 files, 69 of 69 passed, exit 0 (14 new API boundary tests) |
| Standard evaluations | `npm run evals` | 16 passed, 0 failed, exit 0 |
| Deliberately broken rule | `npm run evals:broken` | 13 passed, 3 failed (E02, E03, E04), exit 1, as intended |
| Production build | `npm run build` | exit 0 |
| Workers Free dry run | `npm run dryrun` | exit 0, no upload |
| Browser boundary and accessibility | `npm run check:browser` against `wrangler dev` | 7 of 7 checks passed, exit 0; axe 0 violations on 7 pages at 1366 and 390 px |
| Keyboard and dialog | same script | skip link, modal focus trap, Escape, focus return all behaved as below |
| Narrow viewport overflow | screenshot script at 390 px | 0 px horizontal overflow on all 7 pages, 0 console or page errors |

## API write boundary

Every `POST /api/commands` must pass these checks, in this order, before the visitor's workspace sees it. Reads (`GET /api/state`, exports, evals) are unchanged.

1. `X-Requested-With: cwl` is present (kept from the first version). Missing: 403 `missing_header`.
2. `Origin` is present and equals the Worker's own origin. Missing: 403 `origin_required`. Different: 403 `cross_origin`.
3. If `Sec-Fetch-Site` is present, it is `same-origin`. `cross-site`, `same-site` or `none`: 403 `cross_site`. Browsers that don't send it are judged on `Origin` alone.
4. `Content-Type` is `application/json`, otherwise 415.
5. The body is read by `readBody` in `src/body.ts`. A non-numeric `Content-Length` gets 400 `bad_length`. A declared length over `LIMITS.bodyBytes` (262,144 bytes) gets 413 before anything is read. Otherwise the stream is read chunk by chunk, counting bytes rather than characters. Once the running total passes the limit, the reader cancels the stream and returns 413, so no more than one chunk past the limit is ever held. The bytes are then decoded with a fatal UTF-8 decoder: malformed input gets 400 `invalid_utf8` instead of being repaired with replacement characters and parsed.
6. JSON parsing, command validation, revision checks, idempotency keys and visitor isolation run as before.

What the tests in `API boundary: origin` and `API boundary: body size and encoding` (in the list below) prove:

- A cross-origin request carrying the custom header, the visitor's cookie and a valid body is refused, and the revision doesn't move.
- A write with no `Origin` is refused, with or without the custom header.
- A matching `Origin` paired with `Sec-Fetch-Site: cross-site`, `same-site` or `none` is refused.
- A normal browser write (same `Origin`, `Sec-Fetch-Site: same-origin`, custom header, JSON) is accepted and advances the revision. So is a same-origin write from a browser that sends no `Sec-Fetch-*` headers.
- A declared over-limit body is refused, and `readBody` returns without reading the stream at all.
- An endless stream is cut off just past the limit: with 1,000-byte chunks and a 10,000-byte limit, it stops after 11 or 12 pulls.
- Bodies whose character count is under the limit but whose UTF-8 byte count is over it are refused, both declared and chunked with no `Content-Length`.
- A multibyte body under the limit is accepted even when a character is split across two chunks.
- Malformed UTF-8 inside an otherwise valid command is refused with `invalid_utf8`, and the revision doesn't move. Four cases: a 0xFF byte, a lead byte followed by a non-continuation byte, a truncated three-byte sequence, and an encoded UTF-16 surrogate.

## Browser check (`npm run check:browser`)

This is real Chromium (Playwright) with axe-core against `wrangler dev` at `http://127.0.0.1:8787`. The "attacker" is a plain page with no CSP, served by the script from another port on the same host. Same host means same site, so the `SameSite=Lax` visitor cookie is still attached and only the server's checks stand in the way. The app's own CSP (`script-src 'self'`) blocks axe's injected script, so the axe contexts alone run with Playwright's `bypassCSP`; the boundary and keyboard checks run with the CSP in force.

```
PASS ranking table scrolls inside its card at 390 px, and says so
     {"regionName": "Workflow ranking table, scrolls sideways", "hint": "On narrow screens this table scrolls sideways; not every column is visible at once. Tab reaches every button. When the table itself has focus, the arrow keys, Home and End scroll it.", "clientWidth": 316, "scrollWidth": 893}
PASS arrow keys scroll the focused region
     {"scrollLeftBefore": 0, "scrollLeftAfter": 480}
PASS Tab reaches the offscreen Select button and scrolls it into view
     {"tabsFromRegion": 2, "focused": "Select Closed-won to onboarding handoff (Enterprise)", "button": [263, 343], "region": [37, 353], "scrollLeft": 577, "inside": true, "screenshot": "docs/screenshots/m-choose-keyboard-select.png"}
PASS normal same-origin browser write succeeds
     {"origin": "http://127.0.0.1:8787", "secFetchSite": "same-origin", "xRequestedWith": "cwl", "status": 200, "revisionBefore": 1, "revisionAfter": 2}
PASS cross-origin page cannot write, even with the visitor cookie attached
     {"attackerOrigin": "http://127.0.0.1:41175", "attempts": {"fetchWithCustomHeader": "blocked by the browser: TypeError", "simpleNoCorsPost": "sent; response opaque to the page", "formPost": "status 403"}, "serverResponsesSeen": [{"method": "POST", "status": 403, "error": null, "origin": null, "cookieSent": false}, {"method": "POST", "status": 403, "error": "missing_header", "origin": "http://127.0.0.1:41175", "cookieSent": true}], "revisionBefore": 2, "revisionAfter": 2}
PASS axe: no violations on 7 pages at 390 and 1366 px
     {"axe": {"390 choose": [], "390 build-buy": [], "390 desk": [], "390 effort": [], "390 playbook": [], "390 evals": [], "390 about": [], "1366 choose": [], "1366 build-buy": [], "1366 desk": [], "1366 effort": [], "1366 playbook": [], "1366 evals": [], "1366 about": []}}
PASS no console or page errors
     {"errors": []}
```

How to read the cross-origin result:

- `fetchWithCustomHeader`: the browser sends a CORS preflight, the Worker doesn't approve it, and the request never goes out.
- `simpleNoCorsPost`: the request goes out, but Playwright couldn't read its headers (`origin: null`, `cookieSent: false` there means "not visible to the script", not "absent"). The server answered 403 and the page got an opaque response.
- `formPost`: a `text/plain` form submission arrived with the attacker's `Origin` and the visitor cookie, and was refused with 403 `missing_header`.

Browsers can't attach the custom header cross-origin without a preflight, so the `Origin` and `Sec-Fetch-Site` checks behind it are proven by the Workers tests above rather than here. The revision stayed at 2 throughout.

Mobile ranking table: at 390 px the table is 893 px wide inside a 316 px card, so it scrolls sideways and the whole table is not visible at once. On narrow screens the wrapper is a focusable region labelled "Workflow ranking table, scrolls sideways", and a visible hint underneath says not every column shows at once. Tab moves from the region to the Edit and Select buttons in the offscreen Actions column, and the focused button is scrolled into view. When the region itself has focus, the arrow keys, Home and End scroll it. The build-versus-buy, effort and eval tables use the same wrapper, each with its own label. Screenshot: [../screenshots/m-choose-keyboard-select.png](../screenshots/m-choose-keyboard-select.png).

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
✓ test/engine.test.ts > rejected inputs > {"type":"selectWorkflow","workflowId":"candidate-search"} -> not_rankable 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"selectWorkflow","workflowId":"discount-approval"} -> not_rankable 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"updateCandidate","id":"sales-cs-handoff","field":"savedShare","value":1.5} -> invalid_number 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"updateCandidate","id":"sales-cs-handoff","field":"occurrencesPerMonth","value":null} -> invalid_number 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"setOptionScore","optionId":"build","criterion":"security","score":6} -> invalid_number 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"recordDecision","optionId":"buy","by":"x"} -> not_recommended 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"assignOwner","packetId":"HO-1001","owner":"Someone Else"} -> invalid_owner 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"setCheckpoint","packetId":"HO-1001","date":"2026-02-30","metric":"Share of licensed interviewers with notes enabled","thresholdPct":70} -> invalid_date 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"setCheckpoint","packetId":"HO-1001","date":"2026-11-03","metric":"Revenue","thresholdPct":70} -> invalid_field 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"setCheckpoint","packetId":"HO-1001","date":"2026-11-03","metric":"Share of licensed interviewers with notes enabled","thresholdPct":0} -> invalid_number 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"setCheckpoint","packetId":"HO-1001","date":"2027-03-01","metric":"Share of licensed interviewers with notes enabled","thresholdPct":70} -> invalid_checkpoint 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"approve","packetId":"HO-1002","by":"x"} -> not_ready 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"execute","packetId":"HO-1001","idempotencyKey":"k"} -> not_approved 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"logEffort","packetId":"HO-1001","minutes":10} -> not_executed 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"approve","packetId":"HO-9999","by":"x"} -> not_found 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"drop_tables"} -> unknown_command 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importEffortCsv","csv":"id,arm,segment,minutes,status\nX1,baseline,enterprise,\"12,complete"} -> invalid_csv 1ms
✓ test/engine.test.ts > rejected inputs > {"type":"importEffortCsv","csv":"id,arm,segment,minutes\nX1,baseline,enterprise,12"} -> invalid_csv 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importEffortCsv","csv":"id,arm,segment,minutes,status\nX1,baseline,enterprise,-4,complete"} -> invalid_csv 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importEffortCsv","csv":"id,arm,segment,minutes,status\nB-01,baseline,enterprise,12,complete"} -> duplicate_id 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importPackets","packets":[]} -> invalid_import 0ms
✓ test/engine.test.ts > rejected inputs > {"type":"importPackets","packets":[{"id":"HO-1001","account":"a","segment":"enterprise","closeDate":"2026-10-01","ae":"a","sources":[{"id":"SRC-X","kind":"call_note","capturedAt":"2026-10-01","author":"a","text":"t"}]}]} -> duplicate_id 1ms
✓ test/engine.test.ts > rejected inputs > a bad packet anywhere in an import rejects the whole import (atomic) 1ms
✓ test/engine.test.ts > rejected inputs > limits are enforced 0ms
✓ test/engine.test.ts > rejected inputs > strict dates 0ms
✓ test/engine.test.ts > unknowns stay unknown > a missing input removes a workflow from the ranking, never fills it 0ms
✓ test/engine.test.ts > unknowns stay unknown > near-tie gives no winner 0ms
✓ test/engine.test.ts > unknowns stay unknown > an unknown score that could flip the result withholds the recommendation 1ms
✓ test/engine.test.ts > unknowns stay unknown > a missing baseline is not turned into impact 0ms
✓ test/engine.test.ts > hostile content > instruction-like text is quarantined and cannot set a fact or status 0ms
✓ test/engine.test.ts > hostile content > markup in sources is escaped in markdown exports 1ms
✓ test/engine.test.ts > hostile content > table-breaking characters are escaped 1ms
✓ test/engine.test.ts > hostile content > control characters in names are rejected 1ms
✓ test/engine.test.ts > staleness > evidence older than 45 days before close is not used 0ms
✓ test/engine.test.ts > staleness > editing after approval invalidates it 1ms
✓ test/engine.test.ts > staleness > a resolution stops applying when the evidence changes 1ms
✓ test/engine.test.ts > staleness > selection and decision go stale when their inputs change 1ms
✓ test/engine.test.ts > idempotent execution > same key replays without a new revision; a different key is refused 1ms
✓ test/engine.test.ts > evaluations > standard rules pass every case 4ms
✓ test/engine.test.ts > evaluations > the deliberately broken rule turns red on the contradiction cases 2ms
✓ test/api.test.ts > worker API > health is up and says no external writes 4ms
✓ test/api.test.ts > worker API > issues an HttpOnly visitor cookie and seeds revision 1 13ms
✓ test/api.test.ts > worker API > rejects requests without the CSRF header, wrong type, bad JSON or oversized bodies 20ms
✓ test/api.test.ts > worker API > visitor isolation: one visitor cannot see or change another 25ms
✓ test/api.test.ts > worker API > a forged or malformed cookie gets a fresh workspace, not someone else's 8ms
✓ test/api.test.ts > worker API > concurrent commands at the same revision: exactly one wins, the other gets 409 17ms
✓ test/api.test.ts > worker API > idempotency keys replay the stored response and refuse reuse for a different body 22ms
✓ test/api.test.ts > worker API > full bounded workflow through the API with simulated execution and exports 32ms
✓ test/api.test.ts > worker API > rejected commands leave state unchanged 15ms
✓ test/api.test.ts > worker API > recovery: corrupt stored state is backed up, reseeded and reported once 33ms
✓ test/api.test.ts > worker API > reset restores fixtures and clears the event log for that visitor only 46ms
✓ test/api.test.ts > worker API > evals endpoint: standard is green, broken is red 9ms
✓ test/api.test.ts > worker API > unknown routes 404 as JSON 2ms
✓ test/api.test.ts > API boundary: origin > a normal same-origin browser write is accepted 23ms
✓ test/api.test.ts > API boundary: origin > a same-origin write from a browser that sends no Sec-Fetch-Site is accepted 12ms
✓ test/api.test.ts > API boundary: origin > a cross-origin write is refused even with the custom header and a valid body 19ms
✓ test/api.test.ts > API boundary: origin > a matching Origin with a cross-site or same-site Sec-Fetch-Site is refused 18ms
✓ test/api.test.ts > API boundary: origin > a write with no Origin is refused, custom header or not 16ms
✓ test/api.test.ts > API boundary: origin > reads stay open: GET state and exports need no Origin 16ms
✓ test/api.test.ts > API boundary: body size and encoding > a declared Content-Length over the limit is refused before the body is read 16ms
✓ test/api.test.ts > API boundary: body size and encoding > the reader stops pulling an endless stream just past the limit 0ms
✓ test/api.test.ts > API boundary: body size and encoding > a declared multibyte body over the limit is refused although its character count is under it 19ms
✓ test/api.test.ts > API boundary: body size and encoding > a chunked body with no Content-Length is cut off once it passes the limit 17ms
✓ test/api.test.ts > API boundary: body size and encoding > a chunked multibyte body over the limit is refused 15ms
✓ test/api.test.ts > API boundary: body size and encoding > a multibyte body under the limit is accepted, even when a character is split across chunks 26ms
✓ test/api.test.ts > API boundary: body size and encoding > malformed UTF-8 is refused instead of being replaced and parsed 23ms
✓ test/api.test.ts > API boundary: body size and encoding > a non-numeric Content-Length is refused 12ms
```

Coverage by brief requirement:

- Happy path: the full select, decide, resolve, own, checkpoint, approve, execute and log flow, end to end over HTTP.
- Rejected inputs: wrong content type, missing `X-Requested-With` header, missing or foreign `Origin`, cross-site `Sec-Fetch-Site`, oversized or malformed UTF-8 bodies, bad JSON, bad dates, out-of-range numbers, unknown commands, control characters, non-atomic imports.
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
Total Upload: 76.44 KiB / gzip: 22.66 KiB
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

- No deployed or public URL was tested. Nothing is deployed. The browser check ran against `wrangler dev` over plain HTTP on 127.0.0.1, not behind Cloudflare's edge.
- No real customer, deal, employee or candidate data was used. Every fixture is synthetic.
- The effort numbers are synthetic fixtures. They are not measured time savings, lift or impact.
- No screen-reader session with real assistive technology was run. Only automated axe rules and the keyboard script.
- The walkthrough video is a local draft against `wrangler dev`, not public footage. See [../../video/README.md](../../video/README.md).
