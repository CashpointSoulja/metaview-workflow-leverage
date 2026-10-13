# Walkthrough script and flow

Grounded first-person narration for a 90 to 120 second walkthrough. Every line describes something the viewer sees happen in the real app at that moment; nothing is claimed that the app does not do. Timings come from the last local run of `video/record.mjs` against `wrangler dev` (local draft, not public footage).

The flow is deterministic: a fresh visitor gets the same synthetic fixtures, and `record.mjs` performs the same clicks and inputs in the same order. To produce the public version, deploy, then run it with `APP_URL` set to the public URL.

| # | Start (s) | Screen | On-screen action | Narration |
|---|---|---|---|---|
| 1 | 0.0 | Choose a workflow (#/choose) | Pointer to page title | This is the Commercial Workflow Leverage Lab, an independent concept by Ayo Ahmed. |
| 2 | 5.2 | Choose a workflow (#/choose) | Pointer to SYNTHETIC DATA notice | Every company, person and number in it is synthetic. |
| 3 | 8.7 | Choose a workflow (#/choose) | Pointer to the leverage formula | I rank eight commercial workflows with one formula you can see and argue with. |
| 4 | 12.8 | Choose a workflow (#/choose) | Scroll to the excluded "Candidate search" row | Missing inputs stay unranked. Recruiter search is excluded, because that is the company's own product. |
| 5 | 19.3 | Select the top-ranked workflow | Scroll up; pointer to the verdict band | The sales to onboarding handoff leads on leverage per build day, by a clear margin. |
| 6 | 24.2 | Select the top-ranked workflow | Click "Select" on Closed-won to onboarding handoff; confirm "Select workflow" | I select it, and the choice is bound to these exact inputs. |
| 7 | 28.2 | Build vs buy (#/build-buy) | Click nav "Build vs buy" | Next, build versus buy. |
| 8 | 30.2 | Build vs buy (#/build-buy) | Pointer to "Buy an onboarding platform (category)" row | Buying stays partly unscored, because cost and security are unknown. Even its upper bound can't beat a thin checker. |
| 9 | 36.9 | Build vs buy (#/build-buy) | Click "Record decision"; type owner "Business Operations (synthetic)"; submit | So I record the decision to build, owned by Business Operations. |
| 10 | 40.9 | Handoff desk, HO-1002 contradiction | Nav "Handoff desk"; open HO-1002; pointer to first quote | On the handoff desk, every fact quotes its exact source. |
| 11 | 44.3 | Handoff desk, HO-1002 contradiction | Pointer to the ATS ABSTAIN chip | Here, two sources disagree on the hiring system, so the packet abstains instead of guessing. |
| 12 | 49.9 | Handoff desk, HO-1002 contradiction | "Resolve applicant tracking system"; pick Greenhouse; type reason and name; submit "Resolve" | A person picks one of the cited values, and records the reason, so the choice can be audited. |
| 13 | 55.4 | HO-1004 quarantined text | Open HO-1004; scroll to the quarantine box | This packet hides an instruction inside a synthetic call note. |
| 14 | 59.3 | HO-1004 quarantined text | Pointer to the quarantined sentence | It is quarantined as plain data, and it changes nothing. |
| 15 | 62.7 | HO-1001 owner, checkpoint, approve, run | Open HO-1001; "Assign owner"; submit default roster owner | Before approval, a packet needs one accountable owner from the CS roster, |
| 16 | 68.1 | HO-1001 owner, checkpoint, approve, run | "Set checkpoint"; date 2026-11-03; submit | and a dated adoption checkpoint, with a named metric and a threshold. |
| 17 | 71.9 | HO-1001 owner, checkpoint, approve, run | "Approve"; submit | Approval is bound to a content fingerprint. Any later edit makes it stale. |
| 18 | 76.8 | HO-1001 owner, checkpoint, approve, run | "Run bounded workflow"; submit "Run simulation"; scroll to the simulated plan | Running it builds a simulated onboarding plan. Nothing is emailed, or written to a CRM. |
| 19 | 82.5 | Effort (#/effort) | Nav "Effort"; pointer to the segment table | The effort view compares synthetic baseline and assisted minutes, segment by segment. |
| 20 | 87.6 | Effort (#/effort) | Scroll to the exclusions | Partial timers are excluded. A segment with no baseline is not compared, and none of it is called lift. |
| 21 | 94.1 | Playbook and audit (#/playbook) | Nav "Playbook & audit"; pointer to the preview | The rules export as a reusable operating playbook, with a full audit trail. |
| 22 | 98.7 | Evals (#/evals) | Nav "Evals"; pointer to the "16 pass" chip | Finally, the evaluations. Sixteen expected and actual cases pass on the real rules. |
| 23 | 105.0 | Evals (#/evals) | Scroll to the first red row of the broken rule | Swap in a rule where the first source wins, and the contradiction cases turn red. |

Local run length: 110.6 s. Narration: Piper `en_GB-alba-medium`, 99.7 s of speech.

Measured on that local run (`silencedetect=noise=-40dB:d=0.6`): four pauses between 0.6 s and 1.6 s, where a click or dialog outlasts its sentence. Trim them or add words when recording the public version.

Claims this script must not make: measured savings or lift, real customers, real interviews, an official Metaview product, any external write.
