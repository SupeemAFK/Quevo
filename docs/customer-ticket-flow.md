# Customer ticket flow

Customers can select an active service, join its queue, and return to any active ticket from the customer queue page. Each ticket card links to its own ticket page and shows a readable status alongside its number, service, and branch.

The ticket page loads the latest status when opened. Customers can choose **Refresh status** to request an update; a successful refresh or a recoverable refresh error is announced without hiding the ticket details. The page does not poll automatically, so customers control when to request another update.

The customer ticket page is protected by the existing customer role guard. Ticket data continues to come from the typed customer queue API query; the interface does not create or change ticket state while refreshing.

## Validation

- Component tests cover each ticket status label, active-ticket links, service selection, disabled states, and refresh feedback.
- The `customer-queue.spec.ts` Playwright flow covers joining, reloading and recovering an active ticket, explicit refresh, and the existing operator queue lifecycle.
- The Playwright flow requires the repository's Docker-backed E2E setup; see [the development guide](development.md#end-to-end-tests).
