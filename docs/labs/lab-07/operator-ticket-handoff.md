# Lab 7 — Change request CR-L7-01: operator ticket handoff

**Report status:** FINAL — the maintained Sprint 1 scope is reviewed, merged to main, deployed to production, and verified. UAT behavior smoke and production deployment evidence are recorded below.
**Report date:** 2026-11-28 (Thailand time)
**Project/team:** Quevo · EN-046 · 2 Boys 1 Repo
**Members:** Peeranat Ngamkiatkajorn (67070503429); Peemmapat Sripongsai (67070503436)
**Repository:** https://github.com/SupeemAFK/Quevo
**Change branch:** `maintenance/lab7-ticket-handoff`, created from the pre-change staging revision. PR #86 and unrelated Sprint 2/3 work are excluded.

## Version and scope record

| Version | Revision | Meaning |
| --- | --- | --- |
| Accepted Sprint 1 baseline | `82cd9c9693ea4e73f514929a09960647d56ef0ca` | Lab 6 reference release; contains the original assigned-operator and one-active-ticket rules. |
| Pre-change staging candidate | `675df626b77d048c5e1dcc20577907d7b9995d43` | Actual pre-change implementation on staging before CR-L7-01. |
| Reviewed Lab 7 code | `803262b` with review fixes; report head `9f1642f` | PR #94 received final teammate approval, then merged to staging as `172729ff7b66874cfe8755dca7478a49061158e8` at 2026-11-28 15:17 ICT. |
| UAT behavior-tested release | staging commit `172729ff7b66874cfe8755dca7478a49061158e8` | UAT workflow `46125113341` passed; API `quevo-uat-api-sha-172729ff7b66-a1`; web `quevo-uat-web-sha-172729ff7b66-a1`. UAT-01 smoke ran against this behavior-tested revision. |
| Latest UAT deployment | staging commit `8132eded6f2f91a9a7a24a7bece7ecae56a33658` (report-only commit after the behavior smoke) | UAT workflow `46134789501` passed; API `quevo-uat-api-sha-8132eded6f2f-a1`; web `quevo-uat-web-sha-8132eded6f2f-a1`. No application code changed after UAT-01. |
| Production release | [PR #96](https://github.com/SupeemAFK/Quevo/pull/96) merged to `main` as `9e50d82f5b11ad5dae03090f4100b83468bc906f` | [CD run `46137488769`](https://github.com/SupeemAFK/Quevo/actions/runs/46137488769) passed. API `quevo-api-sha-9e50d82f5b11-a1`; web `quevo-web-sha-9e50d82f5b11-a1`. Both services route 100% traffic to these revisions. PR #86 remains open and excluded. |

The release history includes earlier changes that established the accepted Sprint 1 release path. PR #86 remains open and is excluded from staging and the production promotion; it contains later-sprint service workflows.

## Part A — Change impact and contract

### CR-L7-01: revise the existing operator-assignment rule

**Reason:** If an operator must hand a called customer to an available colleague, the current flow offers no safe way to change responsibility. Rejoining would lose the customer's queue position and ticket history. A constrained handoff preserves the existing ticket and its place in service.

**Existing Sprint 1 behavior (old rule):** Calling next assigns a WAITING ticket to the operator. Only that assigned operator can start, complete, or skip it. Each operator may hold at most one active ticket. This behavior is present in Sprint 1 requirements FR-009–FR-014 / BR-006–BR-009 and features F-005–F-009.

**Changed behavior (new rule):** The current assignee may transfer a `PENDING` or `OPERATING` ticket to a different operator authorized for the same service, only when the recipient has no `PENDING` or `OPERATING` ticket. Assignment and an audit row commit atomically. Ticket owner, service, number, status, queue position, and lifecycle timestamps remain unchanged. After transfer, only the new assignee may act on it.

**Scope and boundaries:** No transfer for `WAITING`, `COMPLETED`, or `SKIPPED` tickets; no self-transfer; no customer transfer; no cross-service transfer; no transfer to a busy or unauthorized operator. No transition, customer workflow, FIFO rule, or service configuration changes. The current Sprint 1 assignment rule is the thing being amended; this report does not claim that handoff existed in the accepted baseline.

**Approval and review:** The professor announced that instructor/TA approval is not required for the Sprint 1 change. Teammate `jarbbie` approved the contract-only PR #91 at 2026-11-27 23:54 ICT; it merged at 23:56. The first implementation commit followed at 2026-11-28 00:03 ICT. Issue #95 itself was created after implementation had begun and explicitly records that timing gap; the pre-code review evidence is PR #91, not issue #95. After three requested fixes, the code PR #94 received final approval at 2026-11-28 15:16 ICT and merged to staging one minute later.

### Revised contract excerpts

| Version | Requirement / rule | Contract text |
| --- | --- | --- |
| Sprint 1 baseline | FR-009 / BR-007 | Calling next assigns the waiting ticket to that operator; only the assignee may start, complete, or skip it. |
| Sprint 1 baseline | BR-008 | An operator may have at most one active ticket. |
| Lab 7 amendment | FR-025 | The current assignee may transfer an active ticket to an idle operator authorized for the same service; status and lifecycle timestamps are preserved and the transfer is recorded. |
| Lab 7 amendment | BR-015 | Only the current assignee may transfer `PENDING` or `OPERATING`; assignment and audit commit atomically; status and lifecycle timestamps do not change. |

The course announcement supplied by the team states that instructor/TA approval is not required for this change. Peer contract approval in PR #91 occurred before the first implementation commit.

### Impact and traceability

| Existing contract / feature | Impact | Acceptance criteria and tests | Code/design locations |
| --- | --- | --- | --- |
| FR-009, BR-001, BR-005 / F-006 Call next | Call-next FIFO assignment stays unchanged. A call-next race with handoff must still respect the operator active-ticket limit. | AC-HO-07; STS-HO-05; existing call-next PostgreSQL tests. | `apps/api/internal/queue/repository.go`; SDS §§10.3, 10.5. |
| FR-010–FR-012, BR-007 / F-007–F-008 Start, complete, skip | The new assignee inherits authority; the former assignee loses it. Existing transitions and timestamps are unchanged. | AC-HO-01–04; STS-HO-01–03; existing operator API tests. | `operator_repository.go`, `operator_handler.go`; SDS §§4.2, 7–8, 10.4. |
| FR-008, FR-013, BR-006 / F-005 Operator queue | Only the current assignee sees transfer options. Candidate list includes same-service, idle operators only. | AC-HO-03, 05–06; `TestLab7HandoffOptionsAvailableToAssignedOperator`; role/ownership cases. | `operator_handler.go`, `operator_repository.go`, `routes/operator.tsx`; SDS §§4.2, 7. |
| FR-014, BR-008 / F-009 Queue integrity | Keep the database's one-active-ticket-per-operator unique index. Concurrent assignment attempts allow at most one winner. | AC-HO-05, 07; `TestOperatorTicketHandoffWithPostgres`. | `000001_sprint1_queue.up.sql`, `operator_repository.go`; SDS §§10.3, 10.5. |
| FR-015–FR-016, BR-011–BR-012 / F-009 persistence | Preserve all existing lifecycle fields; append a handoff audit row only for a successful transfer. Existing tickets need no backfill. | AC-HO-01–02; migration/idempotency and audit assertions. | `000003_sprint1_ticket_handoffs.up.sql`; SDS §§9, 10.5–10.6. |
| New FR-025 / BR-015, Lab 7 overlay on F-005–F-009 | Add the handoff endpoints and operator dialog without a new subsystem or later-sprint feature. | AC-HO-01–07; STS-HO-01–05. | OpenAPI contract, API, operator route/component, PostgreSQL migration, and tests listed above. |

**Not applicable:** Customer-facing API and customer UI are unchanged; ticket ownership remains the same. No payment, file, notification, external service, or historical ticket migration is involved. No new role or service-assignment administration is introduced. The audit table stores only future handoff events; previous tickets remain readable without synthesized events.

**Regression behavior that must remain unchanged:** FIFO call-next; authenticated role and same-service authorization; customer-only ticket ownership; current-assignee start/complete/skip; valid state transitions; one active ticket per operator; existing customer join/read/recovery; ticket number and all lifecycle timestamps.

### Revised contract and acceptance criteria

| ID | Preconditions/input | Expected result |
| --- | --- | --- |
| AC-HO-01 | Current assignee transfers a `PENDING` ticket to an idle same-service operator. | Assignment changes; state, called timestamp, customer, service, and number remain unchanged; one audit row is recorded. |
| AC-HO-02 | Current assignee transfers an `OPERATING` ticket to an idle same-service operator. | Assignment changes; state and `started_at` remain unchanged; one audit row is recorded. |
| AC-HO-03 | Former assignee attempts an operator action after a successful transfer. | Server denies the action; ticket remains unchanged. |
| AC-HO-04 | New assignee performs the valid next transition. | Existing start/complete rule succeeds. |
| AC-HO-05 | Recipient is busy, not an operator, or lacks same-service authorization. | Server rejects transfer; no assignment or audit row changes. |
| AC-HO-06 | Customer, non-assignee, self, or current assignee attempts transfer of a terminal ticket. | Server rejects; no partial write. `WAITING` has no assignee under the existing schema and cannot be transferred. |
| AC-HO-07 | Handoff and call-next concurrently target the same idle recipient. | At most one active ticket is assigned; the losing transaction is rejected and rolled back. |

The SRS amendments are FR-013, FR-025, BR-007, and BR-015. The SDS amendments are API shapes (§4.2), role permissions (§7), assignment semantics (§8), the conceptual audit entity (§9), and the atomic transaction (§10.5). STS-HO-01–05 below map to the changed rule; the existing Sprint 1 suites cover the preserved behaviors.

| STS ID | Test setup/action | Expected result | Implemented evidence |
| --- | --- | --- | --- |
| STS-HO-01 | Assigned operator requests options and transfers a pending ticket to an eligible operator. | Eligible list excludes self, busy, and wrong-service operators; assignment/audit update atomically. | `TestLab7HandoffOptionsAvailableToAssignedOperator`; `TestOperatorTicketHandoffWithPostgres`. |
| STS-HO-02 | Transfer an operating ticket after service start. | Assignment changes, `started_at` is preserved, and new assignee may complete it. | `TestOperatorTicketHandoffWithPostgres`. |
| STS-HO-03 | Former assignee attempts start/complete; new assignee acts. | Former assignee is denied; recipient succeeds. | `TestOperatorTicketHandoffWithPostgres`. |
| STS-HO-04 | Try busy, wrong-service, self, non-assignee, customer, and terminal cases. | Correct conflict/authorization response and no partial update. | `TestOperatorTicketHandoffWithPostgres`. |
| STS-HO-05 | Race handoff with call-next for the same operator. | Exactly one active ticket remains assigned to the recipient; one operation gets the active-ticket conflict. | Concurrent case in `TestOperatorTicketHandoffWithPostgres`. |
| STS-REG-01 | Run existing API/database and web regression suites. | Sprint 1 join/read/call/start/complete/skip, ownership, authorization, FIFO, and persistence behavior remains healthy. | Go unit/integration and web test results in Part B. |

## Part B — Implementation and regression-safe delivery

### Test-first evidence

| Evidence | Command and version | Tested revision | Result |
| --- | --- | --- | --- |
| RED | `GOCACHE=/tmp/quevo-go-build /usr/local/go/bin/go test -tags=integration ./internal/queue -run '^TestLab7HandoffOptionsAvailableToAssignedOperator$' -count=1` (Go 1.26.5) | Pre-change `675df626b77d048c5e1dcc20577907d7b9995d43` | **Failed as expected:** `handoff options status = 404, want 200: 404 page not found`; failure is the missing handoff behavior, not a compile or fixture failure. |
| GREEN | Same command and test | Implementation commit `6132d3e` | **Passed:** `ok example.com/quevo/apps/api/internal/queue`; the full PostgreSQL integration suite also passed on this commit. |

The RED fixture creates a synthetic customer ticket, has the seeded operator call it, logs in through the real API router, and requests handoff options as that current assignee. The same assertion fails on the pre-change code and passes with the implementation.

### Implementation

- API: add authenticated handoff-options and handoff endpoints; validate UUID input; enforce current assignment, operator role, service authorization, ticket state, and recipient workload in PostgreSQL.
- Data: add versioned `ticket_handoffs` audit table and index. The up migration runs with the existing explicit migration runner; the down migration is supplied for rollback. No existing ticket rows are altered.
- Concurrency: lock the current ticket and recipient operator; retain the existing unique active-ticket index; assignment and audit insertion share one transaction.
- Web: add “Transfer ticket” to the current active ticket only, with an accessible dialog, eligible-recipient selection, loading/empty/error feedback, and queue refresh after success.
- OpenAPI/client: expose both endpoints and regenerate the TypeScript API schema from the checked OpenAPI document.

### Verification results on the local candidate

| Suite | Command / version | Result |
| --- | --- | --- |
| Go unit tests | `go test ./...` (Go 1.26.5) | 4 test-bearing packages passed; 0 failed. Other packages had no test files. |
| Go/PostgreSQL integration | `go test -tags=integration ./...` (Go 1.26.5; PostgreSQL 17 Testcontainers in CI) | 6 test-bearing packages passed; 0 failed, including queue, authorization, migration, and concurrency coverage. |
| Web unit/component tests | `bun run test -- --maxWorkers=1 --no-file-parallelism` (Bun 1.3.13, Node 24.15.0) | 14 files / 60 tests passed. |
| Web checks | `bun run typecheck`, `bun run lint`, `bun run check:api` | All passed; lint checked 63 files. |
| Browser E2E | Playwright Chromium, CI | 9/9 passed, including customer join/recovery, operator actions, handoff dialog, focus return, recipient sign-in, and completion. |

The local environment could run Go unit/vet and web tests, but cannot start Testcontainers because Docker access is unavailable. CI executed the PostgreSQL integration suite and browser suite on the reviewed commits.

### Review, CI, deployment, and post-deployment checks

| Required evidence | Result |
| --- | --- |
| Pre-code contract review | Complete: PR #91 approved by `jarbbie` at 2026-11-27 23:54 ICT, before the first implementation commit at 2026-11-28 00:03 ICT. |
| Code review | Complete: PR #94 reviewer requested browser handoff coverage, focus restoration, and migration-ledger assertion. All three were fixed; final approval was submitted at 15:16 ICT on 2026-11-28. |
| Lab 7 branch CI | 11 runs: 8 passed, 3 failed before correction (one staticcheck issue, two E2E navigation assertions). Full run list is in Part C. |
| Staging merge | Complete: PR #94 merged as `172729ff7b66874cfe8755dca7478a49061158e8` at 15:17 ICT on 2026-11-28. |
| UAT deployment | Complete: run `46125113341` passed CI, migration, Cloud Run deployment, health checks, and deployed image verification. API and web revisions are listed in the version table. |
| Post-deployment behavior smoke | Complete: 11/11 authenticated API checks passed against UAT at 15:49 ICT. See evidence UAT-01 below. Temporary synthetic data was cleaned up. |
| Main release and production deployment | Complete: PR #96 was approved and merged to `main` at 17:56 ICT as `9e50d82f5b11ad5dae03090f4100b83468bc906f`; CD run `46137488769` passed deployment and production verification. |

**UAT-01 — authenticated API smoke (2026-11-28 15:49 ICT; staging SHA `172729f`; UAT API revision `quevo-uat-api-sha-172729ff7b66-a1`):**

```text
PASS Customer joined General Service and received ticket 2 (HTTP 201)
PASS Ticket owner read succeeded (HTTP 200); another customer was denied (HTTP 404)
PASS Operator A called the waiting ticket: WAITING → PENDING
PASS Before transfer, DB showed PENDING, Operator A, called_at set, zero handoffs
PASS Handoff to same-service idle Operator B succeeded and status remained PENDING
PASS called_at was identical before/after; one audit row recorded Operator A → B
PASS Former assignee start request was denied (HTTP 404)
PASS Recipient Operator B started and completed the ticket
PASS Customer could still read the completed ticket
PASS 11/11 smoke assertions passed; synthetic test accounts and records were removed
```

**Review evidence:** Peeranat's detailed PR #94 review confirmed the transaction preserved ticket state and timestamps, checked recipient eligibility, wrote the audit row atomically, and retained the active-ticket uniqueness guard. The three merge-gating requests (Playwright flow, focus restoration, migration-ledger assertion) were fixed in `6126d1e`, `05c2b13`, and `803262b`; the reviewer approved the updated PR at 15:16 ICT.

**PROD-01 — production deployment and endpoint verification (2026-11-28):** [PR #96](https://github.com/SupeemAFK/Quevo/pull/96) was approved and merged to `main` as `9e50d82f5b11ad5dae03090f4100b83468bc906f`. [Main CD run `46137488769`](https://github.com/SupeemAFK/Quevo/actions/runs/46137488769) completed successfully. It ran the database migration job, deployed the API and web images, verified their digests (`quevo-api`: `sha256:06f7e7bd258ea246b208c2856905d0f3a26bfcea6b5ee0855aeb036bf7203b62`; `quevo-web`: `sha256:32d405f5dff920e0194154baf4e3421e72a491471d241406aeaeb1e9d4338921`), and confirmed 100% traffic to API revision `quevo-api-sha-9e50d82f5b11-a1` and web revision `quevo-web-sha-9e50d82f5b11-a1`. The live API health URL (`https://quevo-api-5unjfhgfwa-as.a.run.app/api/v1/health`) and web root (`https://quevo-web-5unjfhgfwa-as.a.run.app/`) both returned HTTP 200. Production ticket state was not mutated.

## Part C — Engineering metrics

Final snapshot: 2026-11-28, after the successful production release. Metrics are scoped to CR-L7-01 and its release path; issue #95 is a change request, not a defect.

| ID | Metric definition and window | Value | Source / evidence |
| --- | --- | --- | --- |
| M1 | Pull requests merged for the Lab 7 contract, implementation, report evidence, and production promotion. | 4 merged: #91 (contract), #94 (implementation to staging), #97 (UAT evidence report), #96 (staging to main). | GitHub pull-request records; PR #96 merge commit `9e50d82f5b11ad5dae03090f4100b83468bc906f`. |
| M2 | PR #94 CI runs from first run `46079877876` through latest run `46124024679`. | 11 runs: 8 pass, 3 fail (1 staticcheck issue; 2 E2E navigation assertions), all three corrected before merge. | Run IDs: `46079877876`, `46080085875`, `46081073959`, `46081524297`, `46082115861`, `46121740761`, `46122126910`, `46122420288`, `46123022741`, `46123593995`, `46124024679`. |
| M3 | Automated suite results on the final reviewed implementation and release checks. | Go unit: 4 packages pass; Go integration: 6 packages pass; web: 14 files / 60 tests pass; Chromium E2E: 9 tests pass. Production CD also passed migration, image digest, health, and traffic checks. | PR #94 run `46124024679`; UAT runs `46125113341` and `46134789501`; production CD `46137488769`. |
| M4 | Authenticated post-deployment UAT handoff smoke, 2026-11-28 15:49 ICT. | 11/11 checks pass, including owner access, non-owner denial, transfer, preserved timestamp/audit, former-assignee denial, recipient start/complete. | Evidence UAT-01; synthetic ticket 2 and associated data were removed afterward. |
| M5 | Lab 7 handoff defects filed in GitHub as of the final report snapshot on 2026-11-28. | 0 handoff defects. Issue #95 is the CR-L7-01 change request, not a defect. This makes no claim about unrelated product areas. | GitHub issue list and PR #94 review history; scope limited to ticket handoff. |

**Embedded source details:** PR #91 was approved before implementation; PR #94 merged to staging at 15:17 ICT on 28 Nov. PR #97 was approved and merged at 17:21 ICT; its UAT deploy completed successfully. PR #96 was approved and merged to main at 17:56 ICT; production CD run `46137488769` completed successfully. The PR #94 CI failures were `46079877876` (staticcheck), `46121740761`, and `46122126910` (E2E assertions); all were corrected before merge.

**Evidence-based action (under 100 words):** Three of eleven Lab 7 CI attempts failed before the final green run. Keep the two-operator handoff browser journey and PostgreSQL concurrency test as required CI gates, and repeat the authenticated UAT smoke on each release promotion. Peeranat owns confirming both checks remain required before the next production promotion.



## Part D — Readiness and retrospective

### Readiness checklist

| Item | State / evidence | Owner / next action |
| --- | --- | --- |
| Submitted/deployed version | Main release SHA `9e50d82f5b11ad5dae03090f4100b83468bc906f`; production API `quevo-api-sha-9e50d82f5b11-a1`; production web `quevo-web-sha-9e50d82f5b11-a1`. Latest UAT revisions are `quevo-uat-api-sha-8132eded6f2f-a1` and `quevo-uat-web-sha-8132eded6f2f-a1`. | Deployment and revision verification complete. |
| Defects | No handoff defect is open. The three code-review blockers and three early CI failures were corrected. Issue #95 is CR-L7-01, not a defect. | No unresolved Lab 7 defect. |
| Automated checks | PR #94 full CI passed unit, PostgreSQL integration, web, Playwright, lint, and image builds. PR #96 CI `46134793586` and production CD `46137488769` passed. | All required release checks passed. |
| User / deployed checks | UAT-01: 11/11 authenticated smoke assertions passed. Production API health and web root both returned HTTP 200; CD verified image digests and 100% traffic to released revisions. | No production ticket mutation was performed. |
| Technical debt | P2: document the lock-order invariant between call-next and handoff before adding another ticket-reassignment path. P3: consider making candidate lookup a plain read instead of taking a row lock. Both were non-blocking reviewer observations; current concurrency tests pass. | Team: address before adding another assignment workflow; keep the concurrency test as a regression gate. |
| Configuration / secrets | No new secret or runtime setting. UAT and production deployment workflows applied migration `000003_sprint1_ticket_handoffs` and verified deployed images. | No additional configuration is needed for this change. |
| Documentation / run instructions | SRS, traceability, and SDS were amended; PR #91 is the reviewed pre-code contract; the final report includes UAT and production evidence. | Include this report as the single self-contained PDF submission. |
| CI / deployment / smoke | UAT deploy/smoke and production migration/deploy/verification are complete. PR #96 merged after teammate approval; production CD run `46137488769` passed. | Release complete; retain the E2E, concurrency, UAT smoke, and production digest checks for future changes. |

**Readiness decision: READY for Lab 7 submission.** The handoff change was reviewed, merged to staging, verified by CI and 11/11 authenticated UAT smoke checks, then promoted through reviewed PR #96. Production CD run `46137488769` passed migration, deployment, image digest, health, and 100% traffic verification. The live production API health endpoint and web root returned HTTP 200. This decision covers the maintained Sprint 1 scope, not the full three-sprint product.

### Retrospective

- **What helped:** The contract was approved in PR #91 before implementation; the PostgreSQL test asserted state/timestamp preservation, authorization, audit insertion, and the call-next race. Peer review caught missing browser, focus, and migration-ledger evidence before merge.
- **What hurt:** The issue tracker entry #95 was created after implementation started, even though PR #91 carried the contract first. Early CI also caught a staticcheck issue and two brittle E2E navigation expectations.
- **What to keep:** Keep the handoff E2E and database concurrency checks mandatory. Repeat the authenticated UAT smoke before future promotions and retain the exact source SHA, workflow run, image digest, and Cloud Run revisions.

### Contributions, AI use, and limitations

| Contributor | Work recorded for this change |
| --- | --- |
| Peemmapat Sripongsai (67070503436) | Authored the implementation, integration/E2E tests, review fixes, deployment evidence, and report updates in PR #94. |
| Peeranat Ngamkiatkajorn (67070503429) | Reviewed and approved the contract in PR #91 before implementation; required and approved three corrections in PR #94; approved the updated report in PR #97 and the production promotion in PR #96. |
| Codex AI assistant | Assisted with implementation, tests, evidence collection, and report drafting. The student team reviewed and accepted changes; AI output is not a substitute for teammate approval. |

**Known limitations:** Issue #95 was created after implementation work started; PR #91 is the actual pre-code contract review and the timing gap is disclosed. Local PostgreSQL-container execution was unavailable, but CI ran the full integration suite. UAT smoke was authenticated API-level verification; CI separately passed the Chromium handoff journey. Production verification consisted of the reviewed CD workflow, image digest and 100% traffic checks, plus live HTTP 200 checks for API health and the web root; no production ticket was mutated.
