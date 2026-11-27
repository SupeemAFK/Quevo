# Lab 7 — Change request CR-L7-01: operator ticket handoff

**Report status:** NOT READY for submission. PR #94's CI passed and change request #95 is open; teammate review, staging deployment, and deployed smoke evidence are still outstanding.
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
| Lab 7 release candidate | `6132d3e` (`fix(operator): satisfy staticcheck handoff response mapping`) atop `eb1929c` | Pushed to PR #94 against `staging`; the latest CI run passed. It has not been approved, merged, tagged, or deployed. |

The staging history after the accepted Sprint 1 baseline includes PRs #85 and #87–#92. PR #88 was the Lab 6 intentional validation exercise, #89 adjusted its E2E expectation, and #92 fixed the required email validation. These are intervening changes; this Lab 7 change is isolated from PR #86.

## Part A — Change impact and contract

### CR-L7-01: revise the existing operator-assignment rule

**Reason:** If an operator must hand a called customer to an available colleague, the current flow offers no safe way to change responsibility. Rejoining would lose the customer's queue position and ticket history. A constrained handoff preserves the existing ticket and its place in service.

**Existing Sprint 1 behavior (old rule):** Calling next assigns a WAITING ticket to the operator. Only that assigned operator can start, complete, or skip it. Each operator may hold at most one active ticket. This behavior is present in Sprint 1 requirements FR-009–FR-014 / BR-006–BR-009 and features F-005–F-009.

**Changed behavior (new rule):** The current assignee may transfer a `PENDING` or `OPERATING` ticket to a different operator authorized for the same service, only when the recipient has no `PENDING` or `OPERATING` ticket. Assignment and an audit row commit atomically. Ticket owner, service, number, status, queue position, and lifecycle timestamps remain unchanged. After transfer, only the new assignee may act on it.

**Scope and boundaries:** No transfer for `WAITING`, `COMPLETED`, or `SKIPPED` tickets; no self-transfer; no customer transfer; no cross-service transfer; no transfer to a busy or unauthorized operator. No transition, customer workflow, FIFO rule, or service configuration changes. The current Sprint 1 assignment rule is the thing being amended; this report does not claim that handoff existed in the accepted baseline.

**Approval and review:** The professor's announcement supplied by the team says instructor/TA approval is not required for the Sprint 1 change. A teammate's substantive review of the revised contract before implementation is required by Lab 7, but no such review evidence has been captured. Implementation began before that review was recorded, so the required contract-before-code sequence is currently unmet. Do not represent this report as reviewed or approved.

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
| Browser E2E | Local `bun run test` from `tests` failed during Vite startup because the local dependency tree is incomplete; no local browser cases ran. GitHub Actions clean install on PR #94 ran the existing Chromium suite. | Local run: **failed before test execution**. CI run `46080085875`: **9 Chromium tests passed** (`9 passed (28.4s)`). The suite does not yet exercise the new dialog submit flow. |

Go tests after the final code change passed on `6132d3e`; web checks were run on the same web source committed in `eb1929c`. PR #94's first CI run failed Go staticcheck S1016 on response mapping. Commit `6132d3e` changes the mapping to a direct conversion; CI run `46080085875` passed. The Go OpenAPI annotation generator was not available because the environment could not reach `proxy.golang.org`; the JSON contract was updated, and `check:api` verified the generated client against it.

### Review, CI, deployment, and post-deployment checks

| Required evidence | Status |
| --- | --- |
| GitHub change-request Issue linked to contract/test/code | Issue #95 was created after local implementation began and is linked from PR #94. It does not establish the required issue-before-code sequence. |
| Teammate contract review before code | Not recorded; sequence requirement is currently unmet. |
| Teammate code/PR review | Not available; no PR has been created. |
| CI on the Lab 7 commits | PR #94 run `46079877876` failed Go staticcheck S1016; fix `6132d3e` was pushed. Runs `46080085875` and `46081073959` passed Lint Web, Lint Go, all tests, Chromium E2E, and production image builds. |
| Merge into staging and identify accepted main release | Not done. |
| Cloud Run UAT deployment/revision | Not verified. |
| Deployed handoff and preserved Sprint 1 smoke tests | Not run. |

## Part C — Engineering metrics

Snapshot time: 2026-11-28 06:15 Thailand time. Scope is PR #94 and its Lab 7 commits; run counts include events observed by this timestamp and exclude later runs.

| ID | Metric definition and window | Value | Source |
| --- | --- | --- | --- |
| M1 | Go unit tests; one snapshot run on the Lab 7 candidate. | 4 test-bearing packages passed; 0 failures. | `GOCACHE=/tmp/quevo-go-build go test ./...` output. |
| M2 | Go/PostgreSQL integration tests; one snapshot run. | 6 test-bearing packages passed; 0 failures, including handoff and migration tests. | `GOCACHE=/tmp/quevo-go-build go test -tags=integration ./...` output. |
| M3 | Web unit/component tests; PR #94 CI run `46080085875`. | 14/14 files and 60/60 tests passed. | Embedded Vitest summary in CI log. |
| M4 | Chromium E2E suite; PR #94 CI run `46080085875`. | 9/9 tests passed in 28.4 seconds. | Embedded Playwright summary in CI log. |
| M5 | PR CI run outcomes for branch `maintenance/lab7-ticket-handoff` through 2026-11-28 06:15 Thailand time. | 3 runs: 1 failed (S1016), 2 passed after fix. The latest run passed. | Actions run `46079877876` failed; `46080085875` and `46081073959` passed. |

**Readable result excerpts:**

```text
RED on 675df626: handoff options status = 404, want 200: 404 page not found
GREEN on local implementation: ok example.com/quevo/apps/api/internal/queue
Go unit: app/auth/health/config passed; 0 failed
Go integration: app/auth/health/config/database/queue passed; 0 failed
Vitest: Test Files 14 passed (14); Tests 60 passed (60)
Playwright Chromium: 9 passed (28.4s)
CI run 46079877876: failed Go staticcheck S1016
CI runs 46080085875 and 46081073959: passed Lint Web, Lint Go, all tests, and production image builds
Biome: Checked 63 files; No fixes applied
```

**Evidence-based action (under 100 words):** The first CI run caught a staticcheck issue that local `go vet` did not catch; the follow-up run passed after commit `6132d3e`. Before the final release, Peemmapat should run the repository-pinned `golangci-lint` version locally before each push, while Peeranat reviews the authorization and race tests. The next milestone is a passing reviewed PR followed by UAT deployment and smoke checks against its merged SHA.

## Part D — Readiness and retrospective

### Readiness checklist

| Item | State / evidence | Owner and next action |
| --- | --- | --- |
| Submitted/deployed version | Candidate commit `6132d3e`; UAT revision unknown. | Peemmapat: complete GitHub review/push flow, then record merge and Cloud Run revision. |
| Defects | GitHub issue searches for “bug”, “defect”, and “uat” returned no issues as of 2026-11-28; open #95 is a change request and #56 is a chore. This does not prove that no user-found defects exist. The first CI staticcheck failure was corrected in `6132d3e`; final CI passed. | Team: reconcile the Lab 6 UAT team's actual findings and status before PDF. |
| Automated checks | Go unit/integration, web tests, typecheck, lint, and API schema check passed locally. CI runs `46080085875` and `46081073959` passed lint, all tests including 9 Chromium tests, and production image builds. | Team: retain the CI URL and commit SHA in the final PDF. |
| User checks | No independent post-deployment check of handoff or preserved customer ownership path. | Peeranat: perform UAT smoke after deployment and record expected/actual result and time. |
| Technical debt | No browser E2E covers the new handoff dialog submission; current UI test checks that transfer is offered only for the current active ticket. The API integration test covers the full authorization and persistence flow. | Priority P1 before final release: add a browser handoff path or record a justified fixture limitation; regenerate OpenAPI annotations in a network-enabled environment. |
| Configuration/secrets | No new secrets or environment variables. Migration must be applied before API use. | Deployment owner: confirm the normal migration job completed before service rollout. |
| Documentation/run instructions | SRS, SDS, traceability, and this change record updated locally. No reviewed PR or published doc yet. | Team: peer-review and include selected excerpts in PDF. |
| CI/deployment/smoke | Not performed for this commit. | Team: make PR, pass CI, merge through staging/main workflow, deploy, and smoke-test. |

**Readiness decision: NOT READY** for the maintained Sprint 1 scope. CI passes, but automated checks do not replace the required peer review, staging/main integration, UAT deployment, and selected deployed smoke tests. No assertion is made that the whole three-sprint product is complete.

### Retrospective

- **What helped:** The Sprint 1 PostgreSQL tests exercise role, assignment, and active-ticket invariants, so the maintenance change could reuse real authorization and transaction boundaries.
- **What hurt:** GitHub credentials expired, blocking PR work; the contract review was not captured before implementation. Both reduced the evidence chain even though local checks passed.
- **What changes for Final Delivery:** Peemmapat will publish a short contract-only review before the next implementation starts, then connect its review, test, PR, CI, deploy, and smoke evidence to one commit SHA.

### Contributions, AI use, and limitations

| Contributor | Work recorded for this change |
| --- | --- |
| Peemmapat Sripongsai (67070503436) | Selected the maintenance scope and requested implementation; final review/acceptance is not yet recorded. |
| Peeranat Ngamkiatkajorn (67070503429) | Required teammate contract/code review has not yet been recorded. Do not claim a contribution until completed. |
| Codex AI assistant | Assisted with implementation, tests, and draft documentation. Generated changes and results require team review; AI output is not teammate approval. |

**Known limitations:** Issue #95 was created after implementation started; PR #94 has no independent review; no browser test covers the handoff dialog; local browser dependencies were incomplete (CI's clean-install existing browser suite passed); no Cloud Run revision/smoke evidence or complete GitHub defect/metrics snapshot exists. Do not submit this draft as a complete Lab 7 report.
