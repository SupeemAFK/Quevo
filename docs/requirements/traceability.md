# Quevo Requirements Traceability

**Status:** Provisional — official course rubric mapping cannot be confirmed until group_work_specs_v1 and project_deliverable_1_v1 are supplied.
**Companion documents:** [srs.md](srs.md), [features.md](features.md), and [workflows.md](workflows.md).

Sprint assignments for baseline requirements are proposed Sprint 1 scope, derived from the supplied project task. Future items are left as future, sprint TBD. This matrix maps every requirement in the current SRS to one or more features and a planned scope.

## Functional requirements

| Requirement | Feature mapping | Planned sprint |
| --- | --- | --- |
| FR-001 | F-001 | Sprint 1 |
| FR-002 | F-001 | Sprint 1 |
| FR-003 | F-001 | Sprint 1 |
| FR-004 | F-002 | Sprint 1 |
| FR-005 | F-003 | Sprint 1 |
| FR-006 | F-003, F-009 | Sprint 1 |
| FR-007 | F-004 | Sprint 1 |
| FR-008 | F-005 | Sprint 1 |
| FR-009 | F-006, F-009 | Sprint 1 |
| FR-010 | F-007, F-009 | Sprint 1 |
| FR-011 | F-008, F-009 | Sprint 1 |
| FR-012 | F-008, F-009 | Sprint 1 |
| FR-013 | F-001, F-004, F-005, F-006, F-007, F-008, F-009 | Sprint 1 |
| FR-014 | F-003, F-006, F-007, F-008, F-009 | Sprint 1 |
| FR-015 | F-006, F-007, F-008, F-009 | Sprint 1 |
| FR-016 | F-003, F-004, F-006, F-007, F-008, F-009 | Sprint 1 |
| FR-017 | F-005 | Sprint 1 |

## Business rules

| Rule | Feature mapping | Planned sprint |
| --- | --- | --- |
| BR-001 | F-006, F-009 | Sprint 1 |
| BR-002 | F-003, F-009 | Sprint 1 |
| BR-003 | F-003, F-006, F-009 | Sprint 1 |
| BR-004 | F-003, F-009 | Sprint 1 |
| BR-005 | F-003, F-006, F-009 | Sprint 1 |
| BR-006 | F-005, F-006 | Sprint 1 |
| BR-007 | F-006, F-007, F-008 | Sprint 1 |
| BR-008 | F-006, F-009 | Sprint 1 |
| BR-009 | F-006, F-007, F-008, F-009 | Sprint 1 |
| BR-010 | F-001, F-004 | Sprint 1 |
| BR-011 | F-006, F-007, F-008, F-009 | Sprint 1 |
| BR-012 | F-003, F-004, F-006, F-007, F-008, F-009 | Sprint 1 |
| BR-013 | F-012 | Future; sprint TBD |

## Non-functional requirements

| Requirement | Feature mapping | Planned sprint |
| --- | --- | --- |
| NFR-001 | F-003, F-006, F-009 | Sprint 1 |
| NFR-002 | F-001, F-004, F-005, F-006, F-007, F-008 | Sprint 1 |
| NFR-003 | F-003, F-004, F-005, F-006 | Sprint 1 |
| NFR-004 | F-002, F-003, F-004 | Sprint 1 |
| NFR-005 | F-001, F-002, F-003, F-004, F-005, F-006, F-007, F-008 | Sprint 1 |
| NFR-006 | F-003, F-004, F-006, F-007, F-008, F-009 | Sprint 1 |
| NFR-007 | F-001, F-002, F-003, F-004, F-005, F-006, F-007, F-008, F-009 | Sprint 1 |

## Future feature placeholders

These feature IDs have no numbered FR/BR/NFR yet because detailed future requirements are outside Step 1's confirmed baseline. They are listed to preserve scope visibility, not to imply approved behavior.

| Feature | Planned scope | Requirement status |
| --- | --- | --- |
| F-010 | Service catalog administration | Future; requirements to be elicited |
| F-011 | Counter and operator assignment management | Future; requirements to be elicited |
| F-012 | Customer cancellation | Future; requirements to be elicited; proposed WAITING → CANCELLED transition |
| F-013 | No-show handling | Future; requirements to be elicited |
| F-014 | Queue analytics and reporting | Future; requirements to be elicited |
| F-015 | Extended audit history | Future; requirements to be elicited |
| F-016 | Real-time queue updates | Future; requirements to be elicited |

## Traceability and validation notes

- Every FR, BR, and NFR declared in the SRS has a row in this matrix.
- Every current baseline requirement maps to at least one stable F-ID and a proposed sprint.
- Each Sprint 1 feature is linked to one or more FRs and BRs in the feature inventory.
- Future feature placeholders are not assigned invented FRs or acceptance criteria.
- This matrix traces the proposed product baseline only. It does not establish coverage of Theme 9 or any other official rubric item.
- During Step 4, add acceptance-criterion and test IDs to each requirement/feature mapping. Do not claim an AC or test exists before it is written and verified.
- During Step 1 review, reconcile each requirement with the official course documents, then update the mappings and record any rubric-specific IDs verbatim.
