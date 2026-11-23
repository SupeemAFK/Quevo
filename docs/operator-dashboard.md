# Operator queue dashboard

The operator workspace puts the current ticket and next action first, with the ordered waiting list beside it on wide screens and directly below it on mobile. Service, queue, and branch context stays visible. Operators with one authorized queue do not see a redundant selector; operators with multiple queues can switch with a compact mobile select or the desktop service navigation.

Lucide icons distinguish service context, refresh, call, start, skip, and completion actions. Waiting counts and ticket/status changes use short transitions so the queue feels responsive without delaying an action.

## Backend-owned lifecycle

The UI follows the existing API transitions and does not optimistically change ticket state:

- With waiting customers and no current ticket, **Call next** claims the oldest waiting ticket.
- A called (`PENDING`) ticket can be started, skipped, or marked no-show. Start is blocked until required service documents have been attached.
- An in-service (`OPERATING`) ticket can be completed.
- An empty queue shows a short message and a refresh control; it does not show a disabled call action.

All actions are disabled while a request is pending. The UI refreshes API-owned queue data after an action, announces success or failure, and leaves the last valid state visible when an action fails. Queue data refreshes every eight seconds while the tab is visible and online and on focus/reconnect. Ticket details include the customer's configured request answers, authorized document downloads, and an expandable status history. The API response provides the waiting order and count; the visible positions in the operator list follow that order.

## Validation

- `OperatorQueue` component tests cover current-ticket actions, status text, waiting order and positions, empty queues, pending controls, focus after a confirmed transition, and state retention after failure.
- The `customer-queue.spec.ts` Playwright flow exercises call, start, complete, skip, manual refresh, role guards, keyboard focus, and the narrow-screen operator workspace.
- The browser test requires the Docker-backed E2E setup; see the [development guide](development.md#end-to-end-tests).
