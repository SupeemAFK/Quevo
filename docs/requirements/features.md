# Quevo Feature Inventory

**Status:** Provisional baseline — pending the official group_work_specs_v1 and project_deliverable_1_v1 specifications.
**Source:** Product scope in the current task; see docs/requirements/srs.md.
**Planning note:** Sprint 1 assignments below are proposed from the supplied scope. They must be compared with the official rubric before being treated as final.

Feature IDs are stable. Keep an existing ID attached to a feature if its description changes; add a new ID rather than reusing a retired one. The customer/operator journey and ticket lifecycle are detailed in [workflows.md](workflows.md).

| Feature ID | Feature | Scope and outcome | Requirement links | Planned scope |
| --- | --- | --- | --- | --- |
| F-001 | Identity and access | Customer/operator authenticate, logout, read current identity, and receive role- and ownership-based protection. | FR-001–FR-003, FR-013; BR-010 | Sprint 1 |
| F-002 | Service discovery | Customer can see and select an available branch service. Service administration is excluded. | FR-004 | Sprint 1 |
| F-003 | Join queue and issue ticket | Customer joins one service queue and receives a ticket number unique within the agreed branch/service/business-date scope. Includes transactional duplicate prevention. | FR-005–FR-006, FR-014, FR-016; BR-002–BR-005, BR-012 | Sprint 1 |
| F-004 | Customer ticket view | Customer can read their ticket and current status; server enforces ownership. | FR-007, FR-013, FR-016; BR-010, BR-012 | Sprint 1 |
| F-005 | Operator dashboard and queue views | Operator can view an overview of authorized queues, WAITING tickets in those queues, and a read-only history of COMPLETED or SKIPPED tickets. | FR-008, FR-013, FR-017; BR-006 | Sprint 1 |
| F-006 | Call next ticket | Operator atomically claims the oldest eligible WAITING ticket, assigns it to themselves, and changes it to PENDING while respecting the one-active-ticket rule. | FR-009, FR-013–FR-016; BR-001, BR-005–BR-008, BR-011–BR-012 | Sprint 1 |
| F-007 | Start service | Assigned operator moves a PENDING ticket to OPERATING and records the start timestamp. | FR-010, FR-013–FR-016; BR-007, BR-009, BR-011–BR-012 | Sprint 1 |
| F-008 | Complete or skip ticket | Assigned operator completes an OPERATING ticket or skips a PENDING ticket; the terminal state and timestamp are persisted. | FR-011–FR-016; BR-007, BR-009, BR-011–BR-012 | Sprint 1 |
| F-009 | Queue integrity and lifecycle data | Shared persistence, state-transition validation, unique constraints, ownership/assignment consistency, and lifecycle timestamps across queue flows. | FR-006, FR-013–FR-016; BR-001–BR-012 | Sprint 1 |
| F-010 | Service catalog administration | Authorized staff can create, update, enable, and disable branch services. | Future requirements to be elicited | Future; sprint TBD |
| F-011 | Counter and operator assignment management | Authorized staff can manage counters and operator-to-service assignments. | Future requirements to be elicited | Future; sprint TBD |
| F-012 | Customer cancellation | Customer can cancel an eligible WAITING ticket, proposed transition WAITING → CANCELLED. | Future requirements to be elicited; cancellation is explicitly deferred by BR-013 | Future; sprint TBD |
| F-013 | No-show handling | Operator can handle an unarrived customer under an agreed timeout and state policy. | Future requirements to be elicited | Future; sprint TBD |
| F-014 | Queue analytics and reporting | Staff can review agreed queue volume and service-time measures. | Future requirements to be elicited | Future; sprint TBD |
| F-015 | Extended audit history | Authorized staff can review a defined history of ticket and operator actions beyond required lifecycle timestamps. | Future requirements to be elicited | Future; sprint TBD |
| F-016 | Real-time queue updates | Customer or operator views can update without manual refresh using an agreed delivery mechanism. | Future requirements to be elicited | Future; sprint TBD |

## Sprint boundary

Sprint 1 is the proposed customer/operator vertical slice from identity through ticket completion or skip. It includes the integrity work needed for these flows. It does not include administration workflows or the candidate future features F-010 through F-016.

No future feature should be implemented early solely because it appears in this inventory. The Step 3 sprint plan will allocate future work after the official specifications and dependencies are reviewed.
