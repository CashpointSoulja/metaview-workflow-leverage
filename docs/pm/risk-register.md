# Risk register

| ID | Risk | Likelihood | Impact | Mitigation in the lab | Owner (role) |
|---|---|---|---|---|---|
| K1 | Picking a workflow on made-up numbers | High | High | Every input labelled hypothesis; unknowns don't rank; 10% margin rule | Business Operations |
| K2 | Rebuilding the company's own product | Medium | High | Product-overlap workflows excluded with reason | Business Operations |
| K3 | Silent wrong fact (first source wins) | Medium | High | Contradictions abstain; broken rule kept as a red eval | CS lead |
| K4 | Prompt-like or markup text in notes changes output | Medium | Medium | Quarantine as inert data; DOM built with textContent; Markdown escaped; CSP | Engineering |
| K5 | Approval of content that later changed | Medium | Medium | Approval bound to fingerprint; stale on edit | CS manager |
| K6 | Double execution from retries or double clicks | Medium | Medium | Idempotency keys at command and HTTP level; revision checks | Engineering |
| K7 | Synthetic difference read as savings | High | High | No "lift" wording; HOLD below sample size; no-baseline segments not compared; mix warning | Business Operations |
| K8 | Recording consent missed | Low | High | Consent is a required fact; stale consent excluded; listed as a risk on packets | Legal / security |
| K9 | Visitor sees another visitor's data | Low | High | Random 128-bit visitor id, HttpOnly cookie, one Durable Object per visitor; isolation test | Engineering |
| K10 | Corrupt stored state breaks a session | Low | Medium | Validation on load, backup, reseed, recovery event | Engineering |
| K11 | Concept read as an official Metaview product | Medium | Medium | Persistent non-affiliation notice; small contextual wordmark linked to the home page only | Ayo Ahmed |
