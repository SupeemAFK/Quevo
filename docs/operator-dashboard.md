# Operator queue dashboard

The operator workspace keeps assigned queues available beside the selected queue's current ticket and waiting list. The selected branch and service are named in the ticket panel, and the waiting count is derived from the API-backed waiting list shown in service order.

The current ticket is the main focus. Its readable status and state-specific actions remain visible together: an operator can start or skip a called ticket, complete a ticket in service, or call the next customer when no ticket is current. Queue selection, refresh, pending, success, error, and empty states retain their existing API and mutation behavior.

On narrow screens the queue selector and ticket workspace stack, while ticket numbers, statuses, and controls remain readable and touch accessible.

## Validation

- `OperatorQueue` component tests cover current-ticket actions, status text, waiting order, empty queues, and pending controls.
- The `customer-queue.spec.ts` Playwright flow exercises the operator lifecycle at a 390 CSS pixel viewport and checks for horizontal overflow.
- The browser test requires the Docker-backed E2E setup; see [the development guide](development.md#end-to-end-tests).
