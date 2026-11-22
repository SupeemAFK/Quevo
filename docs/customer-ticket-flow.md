# Customer ticket flow

Customers see their active tickets first. If one active service is available, its branch and service are shown as context and the join action is ready without a redundant selection. If more than one service is available, customers choose using native, keyboard-operable radio controls. A service with an active ticket for the current customer is disabled and its ticket remains available above the join form.

Queue joining remains a typed server-function request to the existing API. The UI disables the action while the request is pending, redirects to the assigned ticket after success, and shows an API conflict if a second browser or concurrent request already created an active ticket. The active-ticket query is refreshed when the customer revisits the join page so terminal tickets are not treated as active indefinitely.

## Ticket status

The ticket page gives the number and current status first, then displays the service, branch, and business date. It provides concise guidance for every backend state:

| API state | Guidance |
| --- | --- |
| `WAITING` | Keep the page open or check back for updates. |
| `PENDING` | It is the customer's turn; go to the service desk. |
| `OPERATING` | Service is in progress; stay with the operator. |
| `COMPLETED` | Service is complete. |
| `SKIPPED` | Ask the service desk for guidance. |

Customers can choose **Refresh status** to load the current state. There is no polling or push-update mechanism, so the page does not claim real-time delivery. The API does not return a reliable customer position or wait-time estimate; neither is derived from ticket numbers. If a refresh fails, the last valid ticket stays visible with retry feedback.

## Validation

- Component tests cover one-service auto-selection, multiple-service choice, duplicate prevention, join errors, active-ticket recovery, all ticket-state guidance, manual refresh, and reduced-motion-safe status transitions.
- The `customer-queue.spec.ts` Playwright flow covers joining, reloading and recovering an active ticket, explicit refresh, the duplicate-request conflict path, and the operator queue lifecycle.
- The Playwright flow requires the repository's Docker-backed E2E setup; see the [development guide](development.md#end-to-end-tests).
