# Quevo Three-Sprint Plan

**Status:** Draft plan for Deliverable 1 Part D (5 points); review sprint scope and capacity with both team members before using it as a commitment.
**Sources:** group_work_specs_v1.pdf §§2, 7, and 9; project_deliverable_1_v1.pdf §§3.4 and 4.
**Related documents:** [SRS](../requirements/srs.md), [feature inventory](../requirements/features.md), [traceability matrix](../requirements/traceability.md), and [system SDS](../design/system-sds.md).

This plan allocates the current Quevo feature inventory across the three course sprints. The source-basis column in the feature inventory and the Theme 9 crosswalk distinguish stated course scope from Quevo's product proposals. Sprint dates and outcomes below come from the supplied course documents; feature sequencing and dependencies are the team's proposed plan.

## Sprint allocation

| Sprint | Goal and checkpoint | Included features | Dependencies | Completion outcome |
| --- | --- | --- | --- | --- |
| Sprint 1 | Release a small working product by Deliverable 1, November 8, 2026. | F-001–F-009 | Agree the queue rules; implement login/session and role checks; add explicit PostgreSQL migrations and repeatable synthetic seed data; then build customer join/read and operator processing on that foundation. | A local, persistent UI → API → PostgreSQL journey: a customer logs in, joins a seeded queue, and retrieves their own number/status; an authorized operator logs in, calls the next eligible ticket, serves/completes it. Demonstrate a meaningful rule rejection and forbidden access with backend tests. Record the tested commit and honest pass/fail/skip results. |
| Sprint 2 | Complete core expansion for Deliverable 2, November 29, 2026. | F-011–F-013 are the current candidates for Theme 9 later work; F-010 is a Quevo proposal and is included only if the team confirms it is needed. | Sprint 1 release; reviewed feature contracts before implementation; approved queue/counter scope and management permissions; explicit cancellation and no-show policies. | Deliver the approved Sprint 2 workflows as an integrated, tested increment. Theme 9 calls out cancellation/no-show handling and multiple queues/counters as later work. Do not implement the proposed policies until their contracts are approved. |
| Sprint 3 | Define progress by November 29, then complete and release by December 13, 2026. | F-014; F-015 and F-017 only if retained as product proposals; F-016 is optional. Also finish remaining approved baseline work and hardening. | Integrated Sprint 1 and 2 releases; agreed summary measures; reviewed feature contracts; regression and authorization coverage. | Complete remaining approved workflows, integration, failure handling, usability, authorization, and regression testing. By November 29, show Sprint 3 contracts, working progress, and an explicit remaining-work list; by December 13, release the completed product and evidence. |

The planned Sprint 1 flow follows Theme 9's example. The source requires defining queue order and duplicate/transition behavior, but does not prescribe FIFO, an exact ticket-number format, or every state name. Quevo's current choices are documented as proposals in the SRS and traceability matrix. Cancellation and no-show are official later-sprint topics; their exact transition, timing, and rejoin policies remain team decisions. Service catalog administration, extended audit history, request forms, and real-time refresh are not stated Theme 9 requirements.

## Sprint 1 dependencies and release gate

1. Agree and document the first queue's ordering, uniqueness scope, duplicate-entry rule, and permitted transitions.
2. Create the explicit PostgreSQL schema/migrations and synthetic, reproducible demo data, including Customer and Operator accounts and an operator's queue authorization.
3. Implement and verify valid/invalid login, logout, current-user identity, session expiry/revocation, unauthenticated access denial, and server-side role/ownership checks.
4. Implement service selection, customer join, unique ticket issuance, and retrieval of the customer's own persisted ticket.
5. Implement the authorized operator view, call-next, serving/completion flow, and invalid/out-of-order transition rejection.
6. Run the PostgreSQL integration, API authorization, and full-stack checks required for the release; capture commands, results, test names, and tested commit. For D1, include screenshots of the normal persisted journey, a rejected rule, and forbidden access, plus short excerpts/results for one domain-rule test and one role/ownership test.

The repository baseline inspected for this plan is still a starter with no queue/authentication feature implementation. The November 8 Sprint 1 checkpoint is therefore high risk. Prioritize the required end-to-end slice, report any incomplete feature honestly, and record any agreed scope change instead of presenting planned work as completed. Deliverable 1 requires local setup and test evidence; the course specification places completed Docker/CI/CD/GCP deployment in Lab 5, not D1. GitHub Actions currently cannot start because the account has a billing lock; record local test results tied to the tested commit until the runner can be used.

## Team participation and evidence

The group specification's default is a shared team score; it does not define a separate individual participation point allocation. Both students must participate across requirements/design, testing, AI-agent supervision, implementation, review, deployment, and maintenance. Permanent role splits are not allowed. Pair work is acceptable, but identify both participants on the relevant Issue or PR. Equal commit counts are not required; both students should be able to explain a sampled requirement, test, design decision, or release step. The specification says suspected non-participation is referred to the instructor for review.

Use Issues to connect work to feature/contract IDs, commits and PRs to preserve implementation history, and substantive teammate reviews to show joint engineering. Rotate the driver/reviewer across design, tests, implementation, and release work so both members take part in multiple activities. Fill in the contribution table from completed work; do not invent or predict contributions:

| Team member | Features/issues contributed | Design, test, implementation, and review work | PR/review evidence |
| --- | --- | --- | --- |
| Member 1 — fill in name | Record actual IDs | Record actual contributions | Link actual PRs/reviews |
| Member 2 — fill in name | Record actual IDs | Record actual contributions | Link actual PRs/reviews |

For Deliverable 1, the working Sprint 1 and verification section is worth 20 points and includes Issue/PR/review/integration evidence. The course spec does not split those points into individual participation marks. The final delivery separately assigns 15 points to engineering process and team evidence, including both students' participation. Include the required short AI-use declaration and actual contribution summary in the submitted evidence.

## Assessment checkpoints

| Assessment | Due | Points | Plan evidence |
| --- | --- | ---: | --- |
| Project Deliverable 1 | November 8, 2026 | 80 | SRS and scope (10), feature inventory/traceability (10), system SDS (15), three-sprint plan (5), Sprint 1 contracts (20), working Sprint 1 and verification (20). |
| Project Deliverable 2 | November 29, 2026 | 70 | Sprint 1 continuity (5), Sprint 2 contracts and working increment (25), Sprint 3 contracts/progress (15), updated traceability (10), integrated release candidate (15). |
| Final Project Delivery | December 13, 2026 | 100 | Completed product (35), process/team evidence (15), final traceability (20), QA/DoD (20), demonstration video (8), release summary (2). |

The project deliverables use the shared team score described above. The course's group labs are a separate grading pool; the supplied group specification lists 35% for labs/assignments and 25% for the group project.

## Next work item

Prepare the Sprint 1 engineering contracts before implementation. D1 Part E is worth 20 points and requires feature-level behavior, applicable UI/API/data details, stable acceptance criteria, a test specification, a product definition of done, and pre-implementation history. Define F-001–F-009 in dependency order: identity and database integrity; seeded service discovery; customer join and own-ticket view; authorized operator views and call-next; then start, complete, and skip transitions. Do not implement a feature before its contract is ready, and do not claim a feature or test is complete until its behavior exists and has been verified.
