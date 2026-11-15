# Sprint 1 UML sequence diagrams

Scope and acceptance checks are in the [Sprint 1 release record](../sprints/sprint-1.md). The [system design](system-sds.md) covers the architecture, session lifecycle, and physical data model.

## Customer joins and recovers a ticket

```mermaid
sequenceDiagram
    actor Customer
    participant Web as TanStack Start
    participant API as Go API
    participant DB as PostgreSQL

    Customer->>Web: Select a branch service and join
    Web->>API: POST /branches/{branchID}/services/{serviceID}/tickets
    API->>DB: Validate session, role, and service
    API->>DB: Allocate scoped number and insert WAITING ticket in one transaction
    DB-->>API: Commit ticket
    API-->>Web: 201 with ticket details
    Web-->>Customer: Show the ticket number and status
    Customer->>Web: Reopen the ticket or find it in active tickets
    Web->>API: GET /tickets/{ticketID} or /tickets/active
    API->>DB: Read within the authenticated customer's scope
    API-->>Web: Return owned ticket data
    Web-->>Customer: Show the persisted result
```

## Operator processes the queue

```mermaid
sequenceDiagram
    actor Operator
    participant Web as TanStack Start
    participant API as Go API
    participant DB as PostgreSQL

    Operator->>Web: Open an assigned queue
    Web->>API: Read authorized waiting and current tickets
    API->>DB: Check service assignment and read queue
    API-->>Web: Return queue detail
    Operator->>Web: Call next
    Web->>API: Request call-next
    API->>DB: Assign oldest eligible WAITING ticket and set PENDING
    API-->>Web: Return assigned ticket
    alt Customer arrives
        Operator->>Web: Start service
        Web->>API: Start assigned ticket
        API->>DB: Set OPERATING and record start time
        Operator->>Web: Complete service
        Web->>API: Complete assigned ticket
        API->>DB: Set COMPLETED and record completion
    else Skip pending ticket
        Operator->>Web: Skip
        Web->>API: Skip assigned ticket
        API->>DB: Set SKIPPED and record skip time
    end
    API-->>Web: Return updated ticket
    Web-->>Operator: Refresh the queue and current ticket
```

## Duplicate and access denials

```mermaid
sequenceDiagram
    actor Customer
    participant Web as TanStack Start
    participant API as Go API
    participant DB as PostgreSQL

    alt Duplicate active ticket
        Customer->>Web: Join the same service again
        Web->>API: Submit queue join
        API->>DB: Check active ticket constraint inside transaction
        DB-->>API: Reject conflict
        API-->>Web: 409 active_ticket_exists
        Web-->>Customer: Show duplicate message and recover existing ticket
    else Customer requests operator queues
        Customer->>API: GET /operator/queues with customer session
        API-->>Customer: 403 forbidden
    else Customer requests someone else's ticket
        Customer->>API: GET /tickets/{ticketID}
        API->>DB: Look up ticket within authenticated customer scope
        DB-->>API: No authorized result
        API-->>Customer: 404 with no ticket data
    end
```
