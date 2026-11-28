# User Journeys and Ticket Lifecycle

**Status:** Customer joining/status, operator processing, branch management, service request forms, cancellation, no-show, ticket history, and periodic queue refresh are implemented. See [branch management and customer documents](../branch-management.md) for manager scope and attachment limitations.
**Sources:** group_work_specs_v1.pdf §6 Theme 9 and the user-provided diagrams.

A queue is the shared line for a branch service. A ticket is one customer's entry in that queue; it carries the lifecycle state. The diagram shows the implemented customer, operator, and branch-manager workflows.

## Customer and operator journey

```mermaid
flowchart TB
  subgraph Customer
    direction LR
    C1[Authenticate] --> C2[Select service, queue, and request details] --> C3[Join service queue] --> C4[Receive WAITING ticket] --> C5[View own ticket status]
    C5 -->|lose URL or sign in on another device| C6[Find active ticket]
    C5 -->|while WAITING| CX[Cancel own ticket]
  end

  subgraph Operator
    direction LR
    O1[Authenticate] --> O2[Operator dashboard]
    O2 --> OV[Overview: authorized queues]
    O2 --> OW[Queue tickets: WAITING]
    OW --> CALL[Call next ticket]
    CALL --> NOTIFY[Notify customer<br/>actor and channel TBD]
    NOTIFY --> START[Start when customer arrives]
    NOTIFY --> SKIP[Skip while PENDING]
    NOTIFY --> NS[Record no-show while PENDING]
    NOTIFY --> HO[Assigned operator hands off to eligible queue operator]
    START --> FINISH[Complete service]
    START --> HO
  end

  subgraph Manager
    M1[Authenticate] --> M2[Manage assigned branch]
    M2 --> M3[Configure services, queues, forms, counters, and assignments]
    M2 --> M4[Review summaries and ticket history]
  end

  DB[(PostgreSQL)]
  C3 -->|create ticket as WAITING| DB
  C5 -->|read own ticket| DB
  C6 -->|list active tickets owned by customer| DB
  CX -->|set CANCELLED and record event| DB
  O2 -->|read authorized queues| DB
  OW -->|read waiting tickets| DB
  CALL -->|atomically assign and set PENDING| DB
  HO -->|atomically change assignee; preserve state; record handoff| DB
  START -->|set OPERATING| DB
  FINISH -->|set COMPLETED| DB
  SKIP -->|set SKIPPED| DB
  NS -->|set NO_SHOW and record event| DB
  M3 -->|save branch configuration| DB
  M4 -->|read authorized reports and history| DB
```

The current operator view covers assigned queues, waiting tickets, the operator's current ticket, recent terminal tickets, and paginated history for authorized tickets. Customer notification remains a staff/workflow step; no delivery integration is implied.

### Ticket lifecycle

```mermaid
stateDiagram-v2
  [*] --> WAITING: Customer joins the service queue
  WAITING --> PENDING: Operator calls next; assign operator atomically
  PENDING --> PENDING: Current assignee hands off to eligible operator
  PENDING --> OPERATING: Assigned operator starts service
  OPERATING --> OPERATING: Current assignee hands off to eligible operator
  OPERATING --> COMPLETED: Assigned operator finishes service
  PENDING --> SKIPPED: Assigned operator skips ticket
  WAITING --> CANCELLED: Customer cancels own ticket
  PENDING --> NO_SHOW: Assigned operator records no-show
  COMPLETED --> [*]
  SKIPPED --> [*]
  CANCELLED --> [*]
  NO_SHOW --> [*]
```

A ticket can be skipped or marked no-show only while PENDING. Customers may cancel only their own WAITING ticket. COMPLETED, SKIPPED, CANCELLED, and NO_SHOW are terminal; ticket numbers are never reused, and a customer may join again after cancellation as a new ticket.

For Lab 7, the current assignee may hand off an active PENDING or OPERATING ticket to a different operator authorized for the same queue if that operator has no other active ticket. The handoff preserves the ticket state and lifecycle timestamps, atomically changes the assignee, and records the actor, previous assignee, recipient, and time. Only the new assignee may perform subsequent ticket actions.

## Interpretation and open decisions

- The operator dashboard has an overview of assigned queues, a WAITING ticket view, the operator's current ticket, recent terminal tickets, and paginated status history.
- A successful Call next action atomically assigns the WAITING ticket to the operator and changes it to PENDING.
- The journey includes notifying the customer after a call. The diagrams leave the actor and delivery channel open; they do not imply SMS, push, or another integration.
- The current implementation uses branch-scoped queues and counters with FIFO ordering. Queue configuration and role rules are Quevo product decisions, not claims about requirements in the course brief.
- FIFO orders tickets by joined time and immutable ticket ID; only the assigned operator can perform the allowed transitions.


## Lab 7 assignment-change overlay

This section amends the Sprint 1 assignment rule under change request CR-L7-01; it does not rewrite the accepted Sprint 1 baseline above. The current assignee may transfer a `PENDING` or `OPERATING` ticket to another operator authorized for the same service when that operator has no active ticket. A successful transfer changes assignment and appends an audit record atomically. Ticket state and lifecycle timestamps stay unchanged. Afterward, only the new assignee may start, complete, or skip according to the existing state rules. `WAITING`, `COMPLETED`, and `SKIPPED` tickets cannot be transferred.

