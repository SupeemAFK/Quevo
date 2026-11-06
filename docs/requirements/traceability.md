# Quevo Requirements Traceability

**Status:** Draft crosswalk against the supplied course documents. The group_work_specs_v1 document is marked draft for instructor review; the Deliverable 1 v1 document is the supplied assessment specification.
**Sources:** group_work_specs_v1.pdf (§§5–8, especially §§5.1–5.2, 6 Theme 9, and 8.1); project_deliverable_1_v1.pdf (§§3.1–3.3).
**Companion documents:** [srs.md](srs.md), [features.md](features.md), [workflows.md](workflows.md), and [system-sds.md](../design/system-sds.md).

This matrix records planned coverage, not implementation or test results. The verification column names intended evidence only; Step 4 will assign acceptance-criterion and test IDs. Source basis distinguishes direct course text from Quevo's interpretation or optional product proposals. Do not cite a product proposal as a rubric requirement.

## Functional requirements

| Requirement | Feature mapping | Planned sprint | Planned verification | Source basis |
| --- | --- | --- | --- | --- |
| FR-001 | F-001 | Sprint 1 | API tests for valid/invalid login and browser journey. | Group spec §5.2. |
| FR-002 | F-001 | Sprint 1 | API session-revocation test and browser logout/current-session check. | Group spec §5.2. |
| FR-003 | F-001 | Sprint 1 | API current-user tests for identity and role. | Group spec §5.2. |
| FR-004 | F-002 | Sprint 1 | Service-list API test and customer UI journey. | Theme 9 queue scope; branch/service selection is product interpretation. |
| FR-005 | F-003 | Sprint 1 | PostgreSQL integration and customer E2E join; read persisted ticket. | Theme 9 Sprint 1 example. |
| FR-006 | F-003, F-009 | Sprint 1 | PostgreSQL uniqueness and concurrent-numbering integration test. | Theme 9 Sprint 1 example requires safe unique numbers; exact scope/format are proposed. |
| FR-007 | F-004 | Sprint 1 | API ownership denial test, persistence read, and customer E2E status view. | Theme 9 identity/access example. |
| FR-008 | F-005 | Sprint 1 | API unauthorized-queue test and operator UI journey. | Theme 9 identity/access example. |
| FR-009 | F-006, F-009 | Sprint 1 | PostgreSQL order/concurrency integration test and operator E2E call-next. | Theme 9 Sprint 1 example requires next eligible entry; FIFO is a product choice. |
| FR-010 | F-007, F-009 | Sprint 1 | API state/assignment test and operator E2E start action. | User-provided journey; the separate OPERATING state is a product design choice. |
| FR-011 | F-008, F-009 | Sprint 1 | API state/assignment test and operator E2E completion. | Theme 9 Sprint 1 example requires completing service. |
| FR-012 | F-008, F-009 | Sprint 1 | API invalid-transition/permission test and operator E2E skip. | User-provided lifecycle diagram; skip is a Quevo workflow detail. |
| FR-013 | F-001, F-004–F-008 | Sprint 1 | API tests for anonymous, wrong-role, wrong-queue, wrong-assignee, and wrong-owner requests. | Group spec §5.2 and Theme 9 identity/access example. |
| FR-014 | F-003, F-006, F-009 | Sprint 1 | PostgreSQL race tests for duplicate joins and conflicting calls; invalid/out-of-order transition tests. | Theme 9 asks teams to define duplicate and transition rules and reject invalid behavior; exact policy is product design. |
| FR-015 | F-009 | Sprint 1 | PostgreSQL lifecycle timestamp assertions. | Proposed product requirement; not stated verbatim in Theme 9. |
| FR-016 | F-003–F-009 | Sprint 1 | PostgreSQL read-after-write and restart-persistence check. | Group spec §5.1 requires persistent data to survive application restart/redeployment. |
| FR-017 | F-005 | Sprint 1 | Operator dashboard E2E for authorized queues, waiting list, and history. | User-provided operator journey; dashboard detail is product scope. |
| FR-018 | F-010 | Sprint 2 | After role and contract approval: API authorization, persistence, and UI checks. | Quevo product proposal; Theme 9 does not explicitly require catalog administration. |
| FR-019 | F-011 | Sprint 2 | After scope/role approval: PostgreSQL and API assignment/queue checks. | Theme 9 names multiple queues/counters as later work; administration and assignments are product proposals. |
| FR-020 | F-012 | Sprint 2 | After cancellation policy approval: API/PostgreSQL transition and customer E2E. | Theme 9 names cancellation as later work; WAITING-only/customer-owned behavior is proposed policy. |
| FR-021 | F-013 | Sprint 2 | After no-show policy approval: API/PostgreSQL transition and operator E2E. | Theme 9 names no-show handling as later work; PENDING to NO_SHOW is proposed policy. |
| FR-022 | F-014 | Sprint 3 | After measures are agreed: API/database summary checks and role-protected UI checks. | Theme 9 asks for useful service summaries; specific metrics are proposed. |
| FR-023 | F-017 | Sprint 3 | If retained: form validation, persistence, and customer E2E after contract definition. | Quevo product proposal; not stated in Theme 9 or D1. |
| FR-024 | F-015 | Sprint 3 | If retained: state-event persistence and authorized audit-read checks. | Quevo product proposal; not stated in Theme 9 or D1. |

## Business rules

| Rule | Feature mapping | Planned sprint | Planned verification | Source basis |
| --- | --- | --- | --- | --- |
| BR-001 | F-006, F-009 | Sprint 1 | PostgreSQL ordering test with concurrent calls. | Theme 9 requires ordering to be defined; FIFO is proposed. |
| BR-002 | F-003, F-009 | Sprint 1 | PostgreSQL scoped uniqueness test. | Theme 9 requires service scopes to be defined; branch/service/business-date key is proposed. |
| BR-003 | F-003, F-006, F-009 | Sprint 1 | PostgreSQL checks for each active-state duplicate/workload case. | Quevo policy proposal. |
| BR-004 | F-003, F-009 | Sprint 1 | PostgreSQL concurrent duplicate-join test. | Theme 9 requires duplicate-entry behavior to be defined; disallowing a second active entry is the selected proposal. |
| BR-005 | F-003, F-006, F-009 | Sprint 1 | PostgreSQL transaction and race tests. | Implementation approach proposed to satisfy safe concurrent behavior and persistence. |
| BR-006 | F-005, F-006 | Sprint 1 | API tests for unauthorized queue reads and commands. | Theme 9 identity/access example. |
| BR-007 | F-006–F-008 | Sprint 1 | API tests for wrong-operator state changes. | Product interpretation of Theme 9 transition permissions. |
| BR-008 | F-006, F-009 | Sprint 1 | PostgreSQL concurrent-call test for one operator. | Quevo policy proposal. |
| BR-009 | F-006–F-009 | Sprint 1 | API/PostgreSQL tests for allowed and rejected transitions. | Theme 9 requires transition permissions/rules to be defined; exact state path is proposed. |
| BR-010 | F-001, F-004 | Sprint 1 | API cross-customer ownership test. | Theme 9 identity/access example. |
| BR-011 | F-006–F-009 | Sprint 1 | PostgreSQL timestamp/state consistency checks. | Quevo data-model proposal. |
| BR-012 | F-003–F-009 | Sprint 1 | API integration test against persistent PostgreSQL. | Group spec §5.1. |
| BR-013 | F-012 | Sprint 2 | After policy approval: API/PostgreSQL owner and state checks. | Theme 9 later-sprint cancellation; exact transition is proposed. |
| BR-014 | F-013 | Sprint 2 | After policy approval: API/PostgreSQL actor, state, and timing checks. | Theme 9 later-sprint no-show; exact transition is proposed. |

## Non-functional requirements

All NFR targets below are Quevo proposals to make quality goals measurable; they are not quoted rubric thresholds. The group specification requires important NFRs to be identified, while the exact targets and methods remain subject to team review.

| Requirement | Feature mapping | Planned sprint | Planned verification | Source basis |
| --- | --- | --- | --- | --- |
| NFR-001 | F-003, F-006, F-009 | Sprint 1 | PostgreSQL concurrency tests at the proposed 20-request load. | Proposed measurable target. |
| NFR-002 | F-001, F-004–F-008 | Sprint 1 | API negative tests for authentication, role, queue, assignment, and ownership. | Proposed measurable target aligned with group spec §5.2 access tests. |
| NFR-003 | F-003–F-006 | Sprint 1 | Repeatable 50-client/1,000-ticket performance run, if target accepted. | Proposed product target; not a rubric threshold. |
| NFR-004 | F-002–F-004 | Sprint 1 | Customer task check against the proposed three-action measure. | Proposed product target. |
| NFR-005 | F-001–F-008 | Sprint 1 | Keyboard walkthrough and automated accessibility scan, if standard is approved. | Proposed product target; not a rubric threshold. |
| NFR-006 | F-003–F-009 | Sprint 1 | PostgreSQL integration assertions for committed and rolled-back state. | Proposed measurable target supporting group spec §5.1 persistence. |
| NFR-007 | F-001–F-009 | Sprint 1 | Clean-checkout documented build, lint, and test commands with recorded results. | Proposed product target supporting reproducibility requirements. |

## Official Theme 9 crosswalk

The following rows paraphrase group_work_specs_v1.pdf §6, Theme 9 (pages 8–9 in the supplied PDF). They state the source expectation separately from Quevo's selected design. The group-work document is labeled draft for instructor review.

| Official Theme 9 scope | Quevo mapping | Planned sprint | Coverage and qualification |
| --- | --- | --- | --- |
| Waiting-line workflow supports joining, calling, serving, completing, cancelling, and handling no-shows. | FR-005, FR-009–FR-013, FR-020–FR-021; F-003, F-006–F-008, F-012–F-013 | Join/call/serve/complete in Sprint 1; cancel/no-show in Sprint 2 | Covered in planned scope. Exact cancellation/no-show rules remain proposed until reviewed. |
| Define queue ordering, service scope, duplicate-entry behavior, and transition permissions. | BR-001–BR-009; F-003, F-006, F-009 | Sprint 1 | Decisions are documented as proposals: FIFO and branch/service/business-date scope; reject duplicate active entries and invalid transitions. |
| Advance appointment booking is outside the core scope. | SRS §3.2 | All sprints | Explicitly out of scope. |
| Sprint 1 example: seed a service queue; customer logs in, joins, and sees queue number/status; operator logs in, calls next eligible entry, and completes service. | FR-001–FR-011; F-001–F-008 | Sprint 1 | Planned vertical slice; seeded data and persistence are described in system-sds.md. |
| Generate unique numbers safely, prevent duplicate active entries, and reject out-of-order/invalid transitions. | FR-006, FR-014; BR-002, BR-004–BR-005, BR-009; F-003, F-006, F-009 | Sprint 1 | Planned PostgreSQL constraints/transactions and API rejection tests. Queue-number formatting and exact scope remain design decisions. |
| Customer and Operator roles; customers see their own detailed entry; operators act only on authorized queues. | FR-001–FR-003, FR-007–FR-008, FR-013; BR-006, BR-010; F-001, F-004–F-006 | Sprint 1 | Planned server-side enforcement and negative API tests. |
| Test customer attempts to call/complete entries and operator attempts to access unauthorized queues. | FR-013; F-001, F-005–F-008 | Sprint 1 | Planned wrong-role and unauthorized-queue API tests; tests are not yet written for these future domain features. |
| Public queue displays may show limited non-private status. | D-015; no feature currently selected | Not planned | Optional permission, not a required feature. If later approved, public output must be limited to explicitly approved non-private status. |
| Later work: cancellation/no-show rules, multiple queues/counters, priority policy if applicable, and summaries. | F-011–F-014; BR-013–BR-014 | Sprint 2–3 proposals | Cancellation/no-show and summaries are allocated later; multiple queue/counter management is a proposal; priority is not selected because FIFO is the current proposal. |

## Deliverable 1 system-level SDS crosswalk

This crosswalk maps project_deliverable_1_v1.pdf §3.3 Part C to the current design document. It is a coverage aid, not an assertion that the course requires a specific implementation technology beyond what the source states.

| D1 Part C topic | Design document coverage | Status |
| --- | --- | --- |
| Stack, UI/API/database components, communication, rule enforcement | system-sds.md §§2–4 | Documented design proposal. |
| Entities, fields, relationships, constraints, ownership, setup, migrations, reproducible seed | system-sds.md §§9–10 | Conceptual model and planned setup; implementation remains future work. |
| Screens/navigation and validation/loading/empty/error behavior | system-sds.md §5 | Planned UI behavior. |
| API conventions, requests/responses, validation, safe errors | system-sds.md §4 | Proposed conventions; feature contracts will detail exact schemas. |
| Role/permission matrix, record ownership | system-sds.md §7 | Customer/Operator matrix; later management roles remain unresolved. |
| Credentials, password hashing if local, session/token lifecycle, current-user, logout | system-sds.md §6 | Proposed session design; password/account provisioning policy is described. |
| Environment variables, secret handling, database configuration, planned GCP components | system-sds.md §11 | Candidate components and unresolved Lab 5 topology documented. |
| Docker suitability and durable storage | system-sds.md §§2, 10–11 | Current container/Compose setup and durable-storage plan described. |

## Traceability notes

- Every FR, BR, and NFR in srs.md has a row above with a feature, planned sprint, and intended verification method.
- “Planned verification” is not evidence of an implemented test. Step 4 will assign AC and TEST IDs and write the test specification before feature implementation.
- Sprint 2 and Sprint 3 requirements have feature allocations now; their detailed contracts and tests can be elaborated before those features, as D1 §3.2 allows.
- F-015, F-016, F-017 and FR-023–FR-024 are explicitly product proposals, not Theme 9 or D1 requirements.
- Any uncovered or changed requirement must be recorded and reviewed; no uncovered direct Theme 9 Sprint 1 requirement is identified in this draft matrix.
