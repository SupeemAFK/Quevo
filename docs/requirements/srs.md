# Quevo Software Requirements Specification

**Status:** Draft baseline — reconciled against the supplied course specifications; team decisions remain open
**Product:** Quevo, a walk-in bank branch queue management platform
**Project milestone:** CPE334 Project Deliverable 1, due November 8, 2026 at 23:59 Asia/Bangkok
**Baseline date:** November 6, 2026
**Repository baseline inspected:** origin/main after PR #3, e2eb489

> Sources reviewed: the supplied group_work_specs_v1.pdf (§§5–8; marked “Draft for instructor review,” issued October 6, 2026) and project_deliverable_1_v1.pdf (§§2–3). The crosswalk in docs/requirements/traceability.md separates direct source clauses from Quevo interpretations and proposals. Proposed policies and targets remain marked; this SRS covers only the requirements portion of Deliverable 1, not the full submission.

## 1. Purpose and product vision

Quevo helps a bank branch organize walk-in customers into service-specific queues. Customers can join a queue, receive a ticket, and check its status. Operators can work tickets from queues they are authorized to serve.

Quevo coordinates queue service only. It does not hold customer financial accounts, move money, approve banking transactions, or schedule appointments.

This SRS records the desired product behavior and does not imply that every requirement is implemented. The current repository includes sign-in, customer service selection, queue join, active-ticket recovery, and own-ticket status. Operator queue processing and later-sprint features remain planned work.

## 2. Stakeholders and actors

| Stakeholder or actor | Interest and responsibility |
| --- | --- |
| Customer | Authenticates, selects a service, joins its queue, and views their own ticket. |
| Operator | Authenticates, views authorized queues, and processes assigned tickets. |
| Project team | Defines, implements, tests, and maintains the product. |
| Course evaluators | Assess the deliverable against the supplied course specifications and submitted evidence. |
| Branch | Provides the operating context and the services and queue authorizations. Branch administration workflows are outside the first-sprint baseline. |

Only Customer and Operator are confirmed product actors. Administrative identities and workflows are unresolved.

## 3. System boundary

### 3.1 In scope

- Customer and operator authentication, logout, current identity, and role-based access.
- Customer service selection, queue joining, ticket issuance, and ticket status lookup.
- Operator dashboard views for authorized queues, waiting tickets, and completed/skipped history, plus call, start, complete, and skip workflows.
- Server-side authorization, ticket ownership checks, validation, and persistence.
- PostgreSQL-backed queue ordering and state changes, including safe concurrent joins and claims.
- Recording lifecycle timestamps for join, call, service start, and completion or skip.

### 3.2 Out of scope for the initial baseline

- Core banking, accounts, balances, payments, deposits, withdrawals, or transaction execution.
- Appointment booking.
- The official Theme 9 brief places cancellation/no-show handling, multiple queues/counters, priority policy if applicable, and service summaries in later-sprint scope. Quevo has allocated those items in the feature inventory; exact policies and selected management workflows remain open.
- Service catalog administration, extended audit history, service-specific request forms, and real-time updates are product proposals, not explicit Theme 9 requirements. Keep their proposal status visible during sprint planning.
- Message brokers such as Kafka or RabbitMQ.

## 4. Operating context and constraints

- The repository is a monorepo with a React/TypeScript web application in apps/web and a Go API in apps/api.
- The web stack uses TanStack Start, TanStack Query, and Bun. The API uses Go, Gin, GORM, PostgreSQL, and Zap.
- PostgreSQL is the source of truth for queue and ticket state.
- Queue join and ticket claim must be implemented as PostgreSQL transactions with pessimistic locking.
- The codebase uses a feature-first modular monolith. This SRS does not require new infrastructure or a change of framework.
- The implementation is incremental. Existing health, test, OpenAPI, container, and development tooling do not by themselves indicate that a product requirement is complete; use the feature acceptance criteria and tests as evidence.

## 5. Functional requirements

These are Quevo requirement statements, not verbatim rubric clauses. Their source basis is recorded in traceability.md; proposed product policies and optional features are identified there.

| ID | Requirement |
| --- | --- |
| FR-001 | The system shall authenticate customers and operators before allowing access to their protected workflows. |
| FR-002 | The system shall let an authenticated user log out and invalidate the associated authenticated session. |
| FR-003 | The system shall expose the authenticated user's identity and role to the web application through a protected current-user operation. |
| FR-004 | The system shall let a customer view and select an available banking service for a branch. |
| FR-005 | The system shall let an authenticated customer join the selected service queue and receive a ticket. |
| FR-006 | The system shall issue ticket numbers unique within the agreed branch, service, and business-date scope. |
| FR-007 | The system shall let a customer view the status of a ticket that belongs to that customer. |
| FR-008 | The system shall let an operator list only queues the operator is authorized to serve. |
| FR-009 | The system shall let an operator call the next eligible waiting ticket in FIFO order, assign it to that operator, and move it to PENDING atomically. |
| FR-010 | The system shall let only the operator assigned to a PENDING ticket start service and move it to OPERATING. |
| FR-011 | The system shall let only the operator assigned to an OPERATING ticket complete service and move it to COMPLETED. |
| FR-012 | The system shall let only the operator assigned to a PENDING ticket skip it and move it to SKIPPED. |
| FR-013 | The system shall enforce authentication, role, queue authorization, ticket assignment, and customer ownership checks on the server. |
| FR-014 | The system shall reject invalid ticket state transitions, a customer's duplicate active ticket for the same service queue, and an operator action that would give that operator more than one active ticket. |
| FR-015 | The system shall persist the timestamps for queue join, ticket call, service start, and completion or skip. |
| FR-016 | The system shall persist queue and ticket state in PostgreSQL and return committed state on subsequent reads. |
| FR-017 | The system shall provide operators an overview of their authorized queues and a view of WAITING tickets in those queues. A separate COMPLETED/SKIPPED history view is deferred by the scope of issue #12. |
| FR-018 | Authorized branch staff shall be able to create, update, enable, and disable services offered by a branch. |
| FR-019 | Authorized branch staff shall be able to manage service queues, counters, and operator-to-service assignments. |
| FR-020 | A customer shall be able to cancel their own ticket while it is WAITING; the ticket shall then be CANCELLED. |
| FR-021 | An authorized operator shall be able to record that a called customer did not arrive, under an approved no-show policy. The proposed state transition is PENDING → NO_SHOW. |
| FR-022 | Authorized staff shall be able to view service summaries for a selected branch, service, and date range, including ticket counts and agreed waiting/service-duration measures. |
| FR-023 | When a service requires additional information, a customer shall be able to submit its service-specific request fields while joining the queue; the service defines the fields and validation. |
| FR-024 | Authorized staff shall be able to review ticket state-change history, including the acting user and event time. |

## 6. Business rules

| ID | Rule |
| --- | --- |
| BR-001 | Waiting tickets are served FIFO, ordered by their join time. A deterministic tie-breaker for equal timestamps must be chosen in the feature contract. |
| BR-002 | Ticket-number uniqueness is scoped by branch, service, and business date. The business timezone and exact numbering/reset policy are unresolved. |
| BR-003 | Quevo proposes WAITING, PENDING, and OPERATING as active ticket states for duplicate-ticket and operator workload rules. |
| BR-004 | A customer may not hold duplicate active tickets in the same service queue. |
| BR-005 | Queue joining and claiming a ticket are atomic PostgreSQL transactions protected against concurrent requests. |
| BR-006 | An operator may act only on queues to which that operator is authorized. |
| BR-007 | Only the operator assigned to a ticket may start, complete, or skip it. |
| BR-008 | An operator may have at most one active ticket at a time. |
| BR-009 | The allowed ticket transitions are WAITING → PENDING → OPERATING → COMPLETED and PENDING → SKIPPED. Other transitions are rejected. |
| BR-010 | A customer may read only their own ticket; ticket ownership is checked by the server on every applicable request. |
| BR-011 | Join, call, start, and completion-or-skip timestamps are persisted with the corresponding ticket lifecycle event. |
| BR-012 | PostgreSQL is the authoritative source for queue ordering, ticket state, and persisted lifecycle data. |
| BR-013 | Customer cancellation is excluded from Sprint 1. In a later sprint, cancellation is allowed only from WAITING and transitions the customer's own ticket to CANCELLED. |
| BR-014 | No-show handling is excluded from Sprint 1. The proposed transition is PENDING → NO_SHOW; the timeout/arrival policy, notification, and rejoin rules must be approved before implementation. |

## 7. Non-functional requirements

These are proposed product targets to make the baseline measurable. They are not confirmed course-rubric requirements. Targets that depend on workload, deployment, or accessibility scope must be agreed by the team and checked against the official specifications before they become commitments.

| ID | Proposed requirement and measure |
| --- | --- |
| NFR-001 | **Concurrency integrity:** In PostgreSQL integration tests, 20 simultaneous attempts to claim one waiting ticket shall produce at most one successful claim; 20 simultaneous duplicate join attempts by the same customer for the same queue shall leave at most one active ticket. |
| NFR-002 | **Access control:** Every protected endpoint shall have automated tests for unauthenticated access and the relevant wrong-role, wrong-queue, wrong-assignee, or wrong-owner case. All such requests shall be denied and shall not mutate protected data. |
| NFR-003 | **Responsiveness (proposed):** Under a repeatable test with 50 concurrent clients and 1,000 tickets in the target queue, p95 read latency shall be at most 1 second and p95 state-changing request latency at most 2 seconds. Confirm test hardware and dataset before accepting this target. |
| NFR-004 | **Usability (proposed):** A customer shall be able to select a service, submit one queue-join action, and reach their ticket-status view without using more than three primary actions after authentication. Confirm the counting method during UI design. |
| NFR-005 | **Accessibility (proposed):** All core customer and operator flows shall be completable with keyboard-only input; all interactive controls shall have programmatic names; automated accessibility checks shall report no critical or serious violations on core workflow screens. Confirm the final standard and manual review method against the course spec. |
| NFR-006 | **Data consistency:** A successful state-changing response shall be visible on a subsequent read; a rejected or rolled-back operation shall leave no partial ticket or state change. Verify using PostgreSQL integration tests. |
| NFR-007 | **Build and verification repeatability:** A clean checkout shall be able to run the documented format, lint, unit, contract, integration, and E2E commands using the repository's pinned tools and documented prerequisites. Record actual outcomes; do not infer success from configuration alone. |

## 8. User-visible workflows

### 8.1 Customer

1. Authenticate.
2. View and select an available banking service.
3. Join its queue; the system creates a WAITING ticket.
4. Receive the ticket number and view the ticket's current status.
5. Be denied access if attempting to view another customer's ticket.

Cancellation is deferred.

### 8.2 Operator

1. Authenticate.
2. Open the operator dashboard: overview of authorized queues, WAITING queue tickets, and the operator's current ticket.
3. Call the next eligible waiting ticket. The system assigns it to the operator and moves it to PENDING atomically. The customer is notified after the call; whether this is a staff action or automated delivery, and via which channel, is undecided.
4. When the customer arrives, start service; the ticket becomes OPERATING.
5. Complete service; the ticket becomes COMPLETED. Alternatively, skip a called customer while the ticket is PENDING; the ticket becomes SKIPPED.

An operator must not process another operator's assigned ticket or hold two active tickets. The detailed workflow and lifecycle diagrams are in [workflows.md](workflows.md).

## 9. Proposed release boundary

### Sprint 1 baseline (proposed from the supplied Theme 9 example)

The vertical slice covers authentication, logout, current identity and RBAC; customer service selection, queue join, and ticket view; operator overview, authorized waiting-ticket and current-ticket views, call-next, customer-notification step, start, complete, and skip; validation and PostgreSQL persistence; duplicate prevention, safe concurrent joins and claims; and lifecycle timestamps. A separate completed/skipped history report is deferred.

### Future sprints

Theme 9 identifies cancellation/no-show handling, multiple queues/counters, priority policy if applicable, and service summaries as later-sprint work. The current proposal allocates cancellation/no-show and queue/counter scope to Sprint 2, with summaries in Sprint 3. Service catalog administration, operator assignment management, extended audit history, service-specific request forms, and real-time updates are Quevo proposals or implementation choices; they are not stated as rubric requirements. FIFO is the current proposed ordering policy, so no priority policy is planned unless the team changes that decision. Step 3 will confirm the backlog and dependencies.

## 10. Assumptions and decision log

| ID | Assumption or unresolved decision | Current treatment | Owner or resolution point |
| --- | --- | --- | --- |
| D-001 | The supplied group_work_specs_v1.pdf is marked “Draft for instructor review,” issued October 6, 2026; project_deliverable_1_v1.pdf is supplied as the Deliverable 1 v1 source. | Use both as the course sources for this baseline and retain the draft label when citing the group specification. Theme 9 coverage is cross-referenced in traceability.md. | Requirements review. |
| D-002 | Authentication/session mechanism, credential lifecycle, account provisioning, and password recovery are unspecified. | Require authentication/session behavior but do not select a mechanism here. | Feature-level authentication contract and team decision. |
| D-003 | Customer/operator account creation and branch onboarding are unspecified. | Treat identities and branch/service authorizations as provisioned outside the Sprint 1 user workflows unless the rubric says otherwise. | Product/course review. |
| D-004 | Branch service hours, queue opening/closing, and business-date timezone are unspecified. | Do not invent queue schedule behavior; confirm branch-local business-date rule. | Product/course review. |
| D-005 | Ticket format is described as an example such as A-001, but prefix, padding, reset, uniqueness enforcement, and display rules are unspecified. | Preserve uniqueness scope; define formatting before implementation. | Feature-level design. |
| D-006 | Equal join timestamps need a stable FIFO tie-breaker. | Proposed tie-breaker is database creation sequence or immutable ticket ID; confirm with the schema design. | Feature-level design. |
| D-007 | Whether SKIPPED customers can rejoin, and how repeated skips are handled, is unspecified. | Do not automatically requeue skipped tickets. | Product/course review. |
| D-008 | “Queue” scope for duplicate customer tickets needs exact branch/service/date interpretation. | Use the proposed key in BR-002; confirm its branch/service/date scope in the queue data-model review. | Product/course review. |
| D-009 | Service catalog seed data and operator-to-queue authorization data have no management workflow in the first-sprint scope. | A controlled fixture or seed process may be needed for a demonstrable vertical slice; specify it in Step 4 without adding admin features. | Sprint 1 contracts. |
| D-010 | Performance, usability, and accessibility targets in NFR-003–005 are proposed. | Validate targets, test conditions, and any required standard with the team and official spec. | Requirements review. |
| D-011 | Data retention, personal data fields, audit access, and deployment security policy are unspecified. | Minimize collected customer data and avoid claiming a compliance posture until requirements are known. | System design and team review. |
| D-012 | The supplied journey diagram includes “Notify customer” after Call next but does not define whether this is a staff action or an automated message, nor a delivery channel. | Document it as a workflow step; do not assume a staff announcement or automated delivery channel. | Product/course review before feature contracts. |
| D-013 | The supplied operator dashboard diagram includes a History view for COMPLETED and SKIPPED tickets. Its retention, filters, and pagination are unspecified; issue #12 excludes a separate history report. | Defer the history view to a later feature decision; keep analytics and extended audit history in future scope. | Feature-level design. |
| D-014 | The group specification assigns themes by the final digit of a team member's student ID; the project request identifies Quevo as Theme 9. | Treat Theme 9 as the selected context for this baseline; the team must confirm its assignment eligibility before submission. | Team requirements review. |
| D-015 | Theme 9 permits a public queue display with limited non-private status but does not require one. | No public display is in the Sprint 1 scope. If added later, show only approved non-private queue/ticket status and never customer identity or contact data. | Product/privacy review. |
| D-016 | Theme 9 mentions a priority policy “if applicable.” | FIFO is selected in BR-001; no priority feature is planned unless the team approves a scope change. | Product review. |
| D-017 | The no-show transition is not defined by the supplied theme brief. | PENDING → NO_SHOW is a proposal only; agree on timing, reassignment, customer notification, and rejoin behavior before F-013 implementation. | Sprint 2 feature contract. |
| D-018 | Theme 9 asks for useful service summaries but does not define measures. | Ticket counts and waiting/service durations are candidate measures; define exact formulas, filters, and privacy before F-014 implementation. | Sprint 3 feature contract. |
| D-019 | Service-specific request forms appear in the product's future scope, but field schemas are unspecified. | A service may define validated request fields; finalize allowed field types and handling in the F-017 contract. | Sprint 3 feature contract. |
| D-020 | Future service, counter, and operator-assignment management does not define a new administrative actor. | Keep management operations unavailable until the authorized role and branch scope are approved; do not infer an administrator role. | Product/course review. |

## 11. Glossary

| Term | Meaning |
| --- | --- |
| Queue | Ordered set of walk-in tickets for a branch service. |
| Ticket | A customer's persisted queue entry and its lifecycle state; this is what the supplied diagram calls a queue instance. |
| Active ticket | Ticket in WAITING, PENDING, or OPERATING state, per BR-003. |
| Call | Atomic selection and assignment of the oldest eligible waiting ticket to an operator. |
| Business date | Branch-local date used for ticket numbering; timezone and reset rules remain unresolved. |
| Authorized queue | Queue the authenticated operator is permitted to access and process. |
| NO_SHOW | Proposed future terminal outcome when an operator records a called customer as not arrived; policy is unresolved. |
