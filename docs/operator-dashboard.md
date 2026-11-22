# Operator queue dashboard

The operator workspace puts the current ticket and next action first, with the ordered waiting list beside it on wide screens and directly below it on mobile. Service and branch context stays visible. Operators with one authorized queue do not see a redundant selector; operators with multiple queues can switch with a compact mobile select or the desktop service navigation.

## Backend-owned lifecycle

The UI follows the existing API transitions and does not optimistically change ticket state:

- With waiting customers and no current ticket, **Call next** claims the oldest waiting ticket.
- A called (`PENDING`) ticket can be started or skipped. Skip is available only in this state.
- An in-service (`OPERATING`) ticket can be completed.
- An empty queue shows a short message and a refresh control; it does not show a disabled call action.

All actions are disabled while a request is pending. The UI refreshes API-owned queue data after an action, announces success or failure, and leaves the last valid state visible when an action fails. Refresh is manual; the operator screen does not claim polling or live updates. The API response provides the waiting order and count; the visible positions in the operator list follow that order.

## Validation

- `OperatorQueue` component tests cover current-ticket actions, status text, waiting order and positions, empty queues, pending controls, focus after a confirmed transition, and state retention after failure.
- The `customer-queue.spec.ts` Playwright flow exercises call, start, complete, skip, manual refresh, role guards, keyboard focus, and the narrow-screen operator workspace.
- The browser test requires the Docker-backed E2E setup; see the [development guide](development.md#end-to-end-tests).
