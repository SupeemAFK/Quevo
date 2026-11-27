# Lab 7 maintenance change: operator ticket handoff

**Status:** Change selected; revised contract requires teammate review before implementation.
**Prepared:** 2026-11-27
**Instructor/TA approval:** Not required, per the Lab 7 spec-sheet announcement.
**Accepted Sprint 1 baseline:** `82cd9c9693ea4e73f514929a09960647d56ef0ca`
**Implementation pre-change revision:** `18d5298` (`feat(forms): support text and long-answer fields`)

## Change request CR-L7-01

### Existing behavior

The operator who calls a waiting ticket becomes its assigned operator. Only that assigned operator can start, complete, or skip the ticket. An operator may hold at most one active ticket.

### Requested behavior

The currently assigned operator may explicitly hand an active `PENDING` or `OPERATING` ticket to another operator who is authorized for the same queue and has no active ticket. The ticket remains in the same state and queue. Its customer, ticket number, request details, and lifecycle timestamps remain unchanged. The assignment changes atomically and the handoff is recorded in the ticket history. After the handoff, only the new assigned operator may perform ticket actions.

### Rationale and bounds

Branch staff need a controlled handoff when an operator's shift ends or the operator becomes unavailable while serving a customer. The API must enforce the handoff; hiding or showing a UI control is not an authorization boundary.

The change does not transfer waiting tickets, allow managers or customers to transfer tickets, relax queue authorization, permit an operator to hold multiple active tickets, or change the ticket lifecycle states. Notification delivery to the customer is out of scope.

### Acceptance criteria

| ID | Given / when | Expected result |
| --- | --- | --- |
| AC-HO-01 | The assigned operator hands off a `PENDING` ticket to an authorized operator with no active ticket. | Assignment changes to the recipient; status remains `PENDING`; one handoff audit event records actor, previous operator, recipient, and time. |
| AC-HO-02 | The assigned operator hands off an `OPERATING` ticket to an authorized operator with no active ticket. | Assignment changes to the recipient; status and service start timestamp remain unchanged; one handoff audit event is recorded. |
| AC-HO-03 | The old operator tries to act after a successful handoff. | The API denies the action and leaves the ticket unchanged. |
| AC-HO-04 | The receiving operator acts after a successful handoff. | The normal allowed transition succeeds. |
| AC-HO-05 | The recipient is not assigned to the ticket's queue, is not an operator, or already owns an active ticket. | The handoff is rejected with a safe error; ticket assignment and history remain unchanged. |
| AC-HO-06 | A customer, another operator, or a manager attempts to hand off the ticket; or the ticket is not active. | The API rejects the request; no state or assignment changes. |
| AC-HO-07 | Handoff races with the recipient calling another ticket or accepting another handoff. | At most one active ticket is assigned to the recipient; one conflicting operation fails without partial changes. |
| AC-HO-08 | An eligible operator loads the operator workspace. | A clear handoff action lists only currently eligible operators for the ticket's queue; loading, empty, and error states are explained. |

## Impact and contract update

| Area | Impact | Planned update / evidence |
| --- | --- | --- |
| Requirements | Sprint 1 `FR-010`–`FR-013`, `BR-006`–`BR-009` define assigned-operator actions, queue authorization, and the one-active-ticket rule. | Add `FR-025` and `BR-015`; retain the existing restrictions and define the explicit handoff exception. |
| API | Operator start/complete/skip commands enforce assignee and queue authorization. | Add an eligible-recipient read and a handoff command. Validate role, same-queue assignment, state, current assignee, and recipient workload on the server. |
| Persistence | `tickets.assigned_operator_id` is the authoritative assignment. Ticket history currently records status events. | Update assignment transactionally and add durable handoff event details through a versioned migration. No customer/ticket lifecycle fields change. |
| Web | The operator workspace displays the current ticket and its actions. | Add an accessible recipient picker and handoff action for active tickets; refresh the sender's queue after success. |
| Authorization | Wrong-role, wrong-queue, and wrong-assignee requests are rejected. | Add negative tests for every handoff boundary and verify the old operator loses action access while the new operator gains it. |
| Regression | Customer joining/status, queue ordering, ordinary call/start/complete/skip/no-show/cancel, and existing role checks must remain unchanged. | Run the relevant Go unit/integration/contract tests, web tests, E2E flow, and CI checks. |
| Deployment/configuration | Existing migration and deployment pipeline are used. | No new secret or environment variable. Apply the versioned database migration before serving the new API version. Smoke-test a handoff and the normal completion flow. |

## Test-first plan (STS additions)

The revised contract and this test plan must receive teammate review before implementation. Add tests before production code and preserve the failing output and commit as RED evidence.

| Test ID | Type | Scenario and expected result |
| --- | --- | --- |
| STS-HO-01 | PostgreSQL/API integration | Authorized assigned operator transfers a `PENDING` ticket; response and database show the new assignee, unchanged status, and one complete audit event. |
| STS-HO-02 | PostgreSQL/API integration | Repeat for an `OPERATING` ticket and verify `started_at` is unchanged. |
| STS-HO-03 | PostgreSQL/API integration | Old assignee cannot start/complete/skip after handoff; new assignee can perform the valid next action. |
| STS-HO-04 | PostgreSQL/API integration | Reject an unassigned recipient, customer/manager recipient, and recipient with another active ticket; assert assignment and event count are unchanged. |
| STS-HO-05 | PostgreSQL/API integration | Reject wrong actor, self-handoff, waiting ticket, and terminal ticket. |
| STS-HO-06 | PostgreSQL concurrency | Race recipient call-next against handoff; assert the unique active-ticket invariant and complete rollback for the losing operation. |
| STS-HO-07 | Web component | Handoff picker only shows API-provided eligible operators, communicates loading/empty/error states, and submits the selected recipient. |
| STS-HO-08 | Browser E2E | Handoff an active ticket from one authorized operator to another; verify old/new control access and successful completion. |
| STS-REG-01 | Regression | Existing customer/operator queue journey, role/ownership denials, ticket state transitions, cancellation, no-show, and queue refresh continue to pass. |

## Review and implementation record

| Milestone | Evidence to record |
| --- | --- |
| Contract review before implementation | Teammate review, review date, and any requested changes. |
| RED | Test commit, tested pre-change SHA, command, and failure output showing the missing handoff behavior. |
| GREEN and regression | Implementation commit, passing commands/counts, affected regression results, and any failures/skips. |
| Delivery | Reviewed PR, CI run, merged release commit, deployed revision, and post-deploy smoke test. |
