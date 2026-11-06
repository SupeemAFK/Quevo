# Quevo Three-Sprint Plan

**Status:** Draft plan for Deliverable 1 Part D (5 points); review sprint scope and capacity with both team members before using it as a commitment.
**Sources:** group_work_specs_v1.pdf §§2, 7, and 9; project_deliverable_1_v1.pdf §§3.4 and 4.
**Related documents:** [SRS](../requirements/srs.md), [feature inventory](../requirements/features.md), [traceability matrix](../requirements/traceability.md), and [system SDS](../design/system-sds.md).

This plan allocates the current Quevo feature inventory across the three course sprints. The source-basis column in the feature inventory and the Theme 9 crosswalk distinguish stated course scope from Quevo's product proposals. Sprint dates and outcomes below come from the supplied course documents; feature sequencing and dependencies are the team's proposed plan.

## Issue effort weights

Issue weights estimate one contributor's working effort, including implementation, tests, and review. They are separate from the official Deliverable 1 rubric points shown later in this plan. These are rough planning ranges, not fixed hours or calendar durations.

| Weight | Expected effort |
| ---: | --- |
| 1 | About 1 working day. |
| 2 | About 1–2 working days. |
| 3 | About 1–3 working days. |
| 5 | Up to 1 workweek. |

| Issue | Work | Weight | Estimate basis |
| --- | --- | ---: | --- |
| #6 | Review Sprint Plan and Scope | 1 | Plan and peer review only |
| #7 | Sign In and Enforce Permissions | 3 | Authentication and access tests |
| #9 | Customer Queue Journey | 3 | Service selection, join, own-ticket view, and tests |
| #12 | View the Operator Queue and Process Tickets | 5 | Authorized view, atomic call-next, state changes, skip, and tests |
| #15 | Persist Queue Data and Enforce Integrity | 3 | Migrations, seed, invariants, and PostgreSQL tests |
| #24 | Integrate and Verify the Sprint 1 Release | 3 | Full-stack acceptance and delivery evidence |
| #16 | Decide Whether to Manage the Service Catalog | 1 | Backlog grooming/contract decision only |
| #17 | Plan Support for Multiple Queues and Counters | 2 | Grooming and implementation breakdown only |
| #18 | Define the Customer Cancellation Policy | 1 | Backlog policy/contract decision only |
| #19 | Define the No-Show Policy | 1 | Backlog policy/contract decision only |
| #20 | Define Queue Service Summary Measures | 2 | Measure definitions and contract only |
| #21 | Decide Whether to Keep Extended Ticket History | 1 | Backlog scope/contract decision only |
| #22 | Decide Whether to Add Automatic Queue Updates | 1 | Backlog scope/contract decision only |
| #23 | Decide Whether Services Need Custom Request Details | 1 | Backlog scope/data-contract decision only |

For items still in Backlog, the weight covers only the grooming decision described in the ticket, not future feature implementation. If approved implementation work exceeds one workweek, create a parent Epic and GitHub sub-issues sized individually from 1 to 5; do not double-count the Epic's roll-up with its children. Detailed label and sizing conventions are in [docs/sprints/estimation.md](estimation.md).

## Sprint allocation

| Sprint | Goal and checkpoint | Included features | Dependencies | Completion outcome |
| --- | --- | --- | --- | --- |
| Sprint 1 | Release a small working product by Deliverable 1, November 8, 2026. | F-001–F-009 | Agree the queue rules; implement login/session and role checks; add explicit PostgreSQL migrations and repeatable synthetic seed data; then build customer join/read and operator processing on that foundation. | A local, persistent UI → API → PostgreSQL journey: a customer logs in, joins a seeded queue, and retrieves their own number/status; an authorized operator logs in, calls the next eligible ticket, serves/completes it, and can skip a PENDING ticket under the agreed contract. Demonstrate a meaningful rule rejection and forbidden access with backend tests. Record the tested commit and honest pass/fail/skip results. |
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

This plan was first drafted against the starter repository. Sprint 1 work is now tracked in the groomed feature issues, and implementation has begun. The November 8 checkpoint remains high risk until the customer/operator journey and required tests pass. Use each issue’s acceptance criteria as the completion boundary, report incomplete work honestly, and record approved scope changes rather than treating planned work as complete. Deliverable 1 requires local setup and test evidence; the course specification places completed Docker/CI/CD/GCP deployment in Lab 5, not D1. The last visible GitHub Actions run failed before test execution because of the account billing lock; record actual local results tied to the tested commit until hosted CI can run.

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

## Next work

The Sprint 1 tickets are groomed and in progress. Follow their linked dependencies: #7 (sign-in and permissions) and #15 (database integrity) can proceed in parallel; #9 (customer queue journey) depends on both; #12 (operator processing) depends on the shared foundation and customer ticket flow; #24 integrates and verifies the release. Operator implementation and tests may proceed against the reviewed contract and seeded fixtures while #9 is underway, but full integration waits for #9.

Keep implementation within the reviewed Sprint 1 contract and acceptance criteria in #7, #9, #12, and #15. Complete #24 with actual test outcomes, tested commit, peer-review evidence, and the required D1 delivery evidence. Do not claim behavior or tests that have not been verified.
