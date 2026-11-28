# Lab 7 — Change request CR-L7-01: operator ticket handoff

**Report status:** NOT READY for submission. The contract was reviewed before implementation in PR #91; the three implementation review requests are fixed and the final CI run passed. Teammate re-review, staging deployment, and deployed smoke evidence are still outstanding.
**Report date:** 2026-11-28 (Thailand time)
**Project/team:** Quevo · EN-046 · 2 Boys 1 Repo
**Members:** Peeranat Ngamkiatkajorn (67070503429); Peemmapat Sripongsai (67070503436)
**Repository:** https://github.com/SupeemAFK/Quevo
**Change branch:** `maintenance/lab7-ticket-handoff`, created from the pre-change staging revision. PR #86 and unrelated Sprint 2/3 work are excluded.

## Version and scope record

| Version | Revision | Meaning |
| --- | --- | --- |
| Accepted Sprint 1 baseline | `82cd9c9693ea4e73f514929a09960647d56ef0ca` | Lab 6 reference release; contains the original assigned-operator and one-active-ticket rules. |
| Pre-change staging candidate | `675df626b77d048c5e1dcc20577907d7b9995d43` (`origin/staging`) | Source commit for this maintenance change. The Cloud Run revision deployed from this commit has not been independently verified. |
| Lab 7 release candidate | Code candidate `803262b` with subsequent review/evidence updates | PR #94 targets `staging`; CI runs `46123022741` and `46123593995` passed. Teammate re-review, merge, and deployment remain outstanding. |

The staging history after the accepted Sprint 1 baseline includes PRs #85 and #87–#92. PR #88 was the Lab 6 intentional validation exercise, #89 adjusted its E2E expectation, and #92 fixed the required email validation. These are intervening changes; this Lab 7 change is isolated from PR #86.

## Part A — Change impact and contract

### CR-L7-01: revise the existing operator-assignment rule

**Reason:** If an operator must hand a called customer to an available colleague, the current flow offers no safe way to change responsibility. Rejoining would lose the customer's queue position and ticket history. A constrained handoff preserves the existing ticket and its place in service.

**Existing Sprint 1 behavior (old rule):** Calling next assigns a WAITING ticket to the operator. Only that assigned operator can start, complete, or skip it. Each operator may hold at most one active ticket. This behavior is present in Sprint 1 requirements FR-009–FR-014 / BR-006–BR-009 and features F-005–F-009.

**Changed behavior (new rule):** The current assignee may transfer a `PENDING` or `OPERATING` ticket to a different operator authorized for the same service, only when the recipient has no `PENDING` or `OPERATING` ticket. Assignment and an audit row commit atomically. Ticket owner, service, number, status, queue position, and lifecycle timestamps remain unchanged. After transfer, only the new assignee may act on it.

**Scope and boundaries:** No transfer for `WAITING`, `COMPLETED`, or `SKIPPED` tickets; no self-transfer; no customer transfer; no cross-service transfer; no transfer to a busy or unauthorized operator. No transition, customer workflow, FIFO rule, or service configuration changes. The current Sprint 1 assignment rule is the thing being amended; this report does not claim that handoff existed in the accepted baseline.

**Approval and review:** The professor's announcement supplied by the team says instructor/TA approval is not required for the Sprint 1 change. Teammate `jarbbie` approved the revised contract in [PR #91](https://github.com/SupeemAFK/Quevo/pull/91) at 2026-11-27 23:54 Thailand time; that contract-only PR merged at 23:56. The first implementation commit was at 2026-11-28 00:03 Thailand time, so the required teammate contract review happened before implementation. Issue #95 was added later as an implementation tracker; it is not the evidence for the pre-code review. The three requested PR #94 fixes are now committed, and teammate re-review is pending.

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

| Suite | Command | Result |
| --- | --- | --- |
| Go unit suite | `GOCACHE=/tmp/quevo-go-build /usr/local/go/bin/go test ./...` from `apps/api` (Go 1.26.5) | 4 test-bearing packages passed; 0 failed. Other packages reported `[no test files]`. |
| Go PostgreSQL integration suite | `GOCACHE=/tmp/quevo-go-build /usr/local/go/bin/go test -tags=integration ./...` from `apps/api` (Go 1.26.5) | 6 test-bearing packages passed; 0 failed. Includes migration/seed, queue API, authorization, concurrency, and handoff cases using disposable PostgreSQL 17 via Testcontainers. |
| Web tests | `PATH=/home/supeem/.bun/bin:/home/supeem/.nvm/versions/node/v24.15.0/bin:$PATH bun run test -- --maxWorkers=1 --no-file-parallelism` from `apps/web` (Bun 1.3.13, Node 24.15.0) | 14 test files passed; 60 tests passed. |
| Web typecheck | `bun run typecheck` from `apps/web` (Bun 1.3.13) | Passed (`tsc --noEmit`). |
| Web lint | `bun run lint` from `apps/web` (Bun 1.3.13) | Passed; 63 files checked, no fixes required. |
| OpenAPI TypeScript consistency | `bun run check:api` from `apps/web` | Passed. |
| Browser E2E | Local Playwright `--list` parsed all 9 Chromium tests. The full local run could not start because Docker access is unavailable. CI run `46123593995` passed the updated suite, including transfer, focus restoration, former-assignee removal, recipient sign-in, and completion. | CI: **9 Chromium tests passed**. The two preceding CI attempts exposed test navigation assumptions; those were fixed before the passing run. |

After the review fixes, local Go unit tests, `go vet ./...`, web lint/typecheck/API consistency, and all 60 web tests passed. The modified PostgreSQL integration test compiled locally; its container execution could not start because this environment cannot access Docker. CI runs `46123022741` and `46123593995` executed the full PostgreSQL integration suite, all 9 Chromium tests, and production image builds successfully. Earlier CI caught one Go staticcheck issue and two E2E navigation assertions; the code/test corrections passed in runs `46122420288`, `46123022741`, and `46123593995`. The Go OpenAPI annotation generator was unavailable because the environment could not reach `proxy.golang.org`; the JSON contract was updated, and `check:api` verified the generated client against it.

### Review, CI, deployment, and post-deployment checks

| Required evidence | Status |
| --- | --- |
| Change request and reviewed contract | Complete: contract-only PR #91 documents CR-L7-01, was approved before the first code commit, and is linked as the pre-implementation change request. Issue #95 was created later as an implementation tracker. |
| Teammate contract review before code | Complete: `jarbbie` approved contract-only PR #91 at 2026-11-27 23:54 Thailand time; it merged before the first implementation commit at 2026-11-28 00:03. |
| Teammate code/PR review | `jarbbie` requested browser handoff coverage, focus restoration, and a migration-ledger assertion that does not hard-code the total count. All three are fixed through code commit `803262b`; evidence/report head is `44edbed`; re-review is still required. |
| CI on the Lab 7 commits | Runs `46079877876` (staticcheck failure), `46080085875`, `46081073959`, `46081524297`, and `46082115861` (pass), `46121740761` and `46122126910` (E2E test assertion failures), and `46122420288`, `46123022741`, and `46123593995` (pass after corrections). The latest run passed Lint Web, Lint Go, all tests including PostgreSQL integration and 9 Chromium tests, and production image builds. |
| Merge into staging and identify accepted main release | Not done. |
| Cloud Run UAT deployment/revision | Not verified. |
| Deployed handoff and preserved Sprint 1 smoke tests | Not run. |

## Part C — Engineering metrics

Snapshot time: 2026-11-28 14:54 Thailand time. Scope is PR #94 and its Lab 7 commits; run counts include events observed by this timestamp.

| ID | Metric definition and window | Value | Source |
| --- | --- | --- | --- |
| M1 | Go unit tests; one snapshot run on the Lab 7 candidate. | 4 test-bearing packages passed; 0 failures. | `GOCACHE=/tmp/quevo-go-build go test ./...` output. |
| M2 | Go/PostgreSQL integration tests; one snapshot run. | 6 test-bearing packages passed; 0 failures, including handoff and migration tests. | `GOCACHE=/tmp/quevo-go-build go test -tags=integration ./...` output. |
| M3 | Web unit/component tests; PR #94 CI run `46123022741`. | 14/14 files and 60/60 tests passed. | Embedded Vitest summary in CI log. |
| M4 | Chromium E2E suite; PR #94 CI run `46123022741`. | 9/9 tests passed, including the handoff flow. | Embedded Playwright summary in CI log. |
| M5 | PR CI run outcomes for branch `maintenance/lab7-ticket-handoff` through 2026-11-28 14:54 Thailand time. | 9 runs: 3 failed (one staticcheck issue and two E2E assertion issues); 6 passed. The latest run passed. | Actions runs `46079877876`, `46080085875`, `46081073959`, `46081524297`, `46082115861`, `46121740761`, `46122126910`, `46122420288`, and `46123022741`. |

**Readable result excerpts:**

```text
RED on 675df626: handoff options status = 404, want 200: 404 page not found
GREEN on local implementation: ok example.com/quevo/apps/api/internal/queue
Go unit: app/auth/health/config passed; 0 failed
Go integration: app/auth/health/config/database/queue passed; 0 failed
Vitest: Test Files 14 passed (14); Tests 60 passed (60)
Playwright Chromium on 46123022741: 9 passed
CI failures 46079877876 (staticcheck), 46121740761 and 46122126910 (E2E navigation assertions) were corrected
CI runs 46080085875, 46081073959, 46081524297, 46082115861, 46122420288, 46123022741, and 46123593995: passed Lint Web, Lint Go, all tests, and production image builds
Biome: Checked 63 files; No fixes applied
```

**Evidence-based action (under 100 words):** CI first caught a staticcheck issue and, after adding the handoff browser journey, two incorrect navigation expectations. The team corrected these and the full test/build workflow passed on run `46122420288`. Before release, Peeranat must re-review the fixes; the team must then merge through staging, deploy to UAT, and record smoke checks against the deployed SHA.

## Part D — Readiness and retrospective

### Readiness checklist

| Item | State / evidence | Owner and next action |
| --- | --- | --- |
| Submitted/deployed version | Code candidate `803262b` / report head `44edbed` in PR #94; UAT revision unknown. | Peemmapat: complete teammate re-review/merge flow, then record merge and Cloud Run revision. |
| Defects | GitHub issue searches for “bug”, “defect”, and “uat” returned no issues as of 2026-11-28; open #95 is a change request and #56 is a chore. This does not prove that no user-found defects exist. The first CI staticcheck failure was corrected in `6132d3e`; final CI passed. | Team: reconcile the Lab 6 UAT team's actual findings and status before PDF. |
| Automated checks | Local Go unit/vet, web tests/typecheck/lint/API schema check passed. CI run `46123593995` passed all tests including PostgreSQL integration and 9 Chromium tests, lint, and production image builds on the reviewed code. | Team: retain the CI URL and commit SHA in the final PDF. |
| User checks | No independent post-deployment check of handoff or preserved customer ownership path. | Peeranat: perform UAT smoke after deployment and record expected/actual result and time. |
| Technical debt | The requested browser handoff path, keyboard focus restoration, and specific migration-ledger assertion are implemented and passed CI. | Obtain reviewer confirmation. Regenerate OpenAPI annotations in a network-enabled environment if the checked JSON contract changes. |
| Configuration/secrets | No new secrets or environment variables. Migration must be applied before API use. | Deployment owner: confirm the normal migration job completed before service rollout. |
| Documentation/run instructions | SRS, SDS, traceability, and this change record are included in PR #94; pre-code contract review is complete, implementation re-review is pending. | Team: complete the implementation review and include selected excerpts in the PDF. |
| CI/deployment/smoke | CI passed; no staging/main merge, Cloud Run deploy, or deployed smoke test yet. | Team: merge through staging/main after review, deploy, and smoke-test. |

**Readiness decision: NOT READY** for the maintained Sprint 1 scope. The pre-implementation contract review is evidenced by PR #91 and the fixed implementation passed CI. PR #94 still needs teammate re-review, then staging/main integration, UAT deployment, and selected deployed smoke tests. No assertion is made that the whole three-sprint product is complete.

### Retrospective

- **What helped:** The team reviewed and merged the contract in PR #91 before implementation. The Sprint 1 PostgreSQL tests also exercise role, assignment, and active-ticket invariants, so the maintenance change could reuse real authorization and transaction boundaries.
- **What hurt:** The initial evidence draft omitted PR #91 and incorrectly described the contract review as missing; the report is corrected to cite the approval and its timing. The local GitHub CLI token initially blocked remote work.
- **What changes for Final Delivery:** The team will link the reviewed #91 contract from the implementation record, then connect review, test, PR, CI, deploy, and smoke evidence to one release SHA.

### Contributions, AI use, and limitations

| Contributor | Work recorded for this change |
| --- | --- |
| Peemmapat Sripongsai (67070503436) | Selected the maintenance scope and requested implementation; final review/acceptance is not yet recorded. |
| Peeranat Ngamkiatkajorn (67070503429) | Reviewed and approved the contract in PR #91 before implementation; reviewed PR #94 and requested three implementation fixes. |
| Codex AI assistant | Assisted with implementation, tests, and draft documentation. Generated changes and results require team review; AI output is not teammate approval. |

**Known limitations:** Issue #95 was created after implementation started, but the pre-code change contract and its teammate review are documented in PR #91. PR #94's latest fixes are awaiting teammate re-review. Local browser/database execution is unavailable without Docker; the clean CI run passed. No Cloud Run revision/smoke evidence or complete GitHub defect/UAT snapshot exists. Do not submit this draft as a complete Lab 7 report.
