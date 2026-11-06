# Issue Grooming and Effort Weights

This guide defines the team's issue format, workflow labels, and effort weights. It is a planning aid, not a course rubric or grade scale.

## Workflow labels

| Label | Board status | Meaning |
| --- | --- | --- |
| `to-groom` | Backlog | Clarify scope, decisions, and acceptance criteria before scheduling. |
| `to-plan` | Ready | Scope is agreed and the team can schedule the work. |
| `to-do` | In Progress | Someone is actively working on the issue. |

Use exactly one workflow label that matches the project's current Status. Update it when the card moves.

## Work type and scope labels

| Label | Apply when |
| --- | --- |
| `features` | Customer, operator, database, or product capability work. |
| `docs` | Requirements, planning, or engineering documentation. |
| `testing` | Test infrastructure or verification work. |
| `release` | Integration, delivery, or release evidence. |
| `ci-blocked` | Hosted GitHub Actions cannot start; local verification may still proceed. |

Labels are additive: an issue can have one workflow label and one or more type/scope labels.

## Effort weight

Weights estimate one contributor's working time to complete the issue as written, including required implementation, tests, and review. They do not measure elapsed calendar time for parallel work and do not replace official Deliverable 1 points.

| Weight | Expected effort |
| ---: | --- |
| 1 | About 1 working day. |
| 2 | About 1–2 working days. |
| 3 | About 1–3 working days. |
| 5 | Up to 1 workweek. |

These ranges are intentionally rough. Choose a weight after the behavior and acceptance criteria are clear. For issues labeled `to-groom`, the estimate covers only the grooming/contract decision in that issue. If implementation is approved, create and size implementation issue(s) separately.

If implementation is expected to take more than one workweek, create a parent Epic and GitHub sub-issues sized individually from 1 to 5. The Epic captures the shared outcome and dependencies. Do not count an Epic's roll-up estimate alongside its child estimates. A milestone groups work by date or deliverable; sub-issues express the parent/child breakdown.

## Required issue format

Each open issue should state:

1. **User story:** `As a [role], I want [capability], so that [outcome].`
2. **Effort weight:** one of 1, 2, 3, or 5 working days.
3. **Traceability:** official requirement and feature IDs in the body, not a confusing title prefix.
4. **In scope / out of scope:** explicitly bound behavior.
5. **Acceptance criteria:** observable, testable outcomes.
6. **Dependencies / blockers:** link blocking issues and clarify whether they gate starting work or only integration/completion.
7. **Verification and done:** tests, data setup, documentation, and evidence required.

Closed detail issues consolidated into a parent are historical references and are not separately estimated.

## Current estimates

| Issue | Work | Weight | Estimate basis |
| --- | --- | ---: | --- |
| #6 | Review Sprint Plan and Scope | 1 | Plan and peer review only |
| #7 | Sign In and Enforce Permissions | 3 | Authentication and access tests |
| #9 | Customer Queue Journey | 3 | Service selection, join, own-ticket view, and tests |
| #12 | Operate the Queue and Process Tickets | 5 | Queue access, atomic call-next, transitions, skip, and tests |
| #15 | Persist Queue Data and Enforce Integrity | 3 | Migrations, seed, invariants, PostgreSQL tests |
| #16 | Decide on Service Catalog Management | 1 | Scope and contract decision only |
| #17 | Plan Multiple Queues and Counters | 2 | Domain, access, migration, and child-issue breakdown only |
| #18 | Define Ticket Cancellation Policy | 1 | Policy and contract only |
| #19 | Define No-Show Handling | 1 | Policy and contract only |
| #20 | Define Queue Summary Measures | 2 | Measures, access, and calculation contract only |
| #21 | Decide on Extended Ticket History | 1 | Product decision and contract only |
| #22 | Decide on Automatic Queue Updates | 1 | Product decision and technical contract only |
| #23 | Decide on Service-Specific Request Details | 1 | Product decision and data/privacy contract only |
| #24 | Integrate and Verify Sprint 1 Release | 3 | Full-stack acceptance and delivery evidence |

Effort weights are initial team estimates. Re-estimate when scope changes. Backlog grooming weights do not estimate the implementation of future features.
