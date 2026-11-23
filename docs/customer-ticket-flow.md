# Customer ticket flow

Customers see their active tickets first. If one active service is available, its branch and service are shown as context and the join action is ready without a redundant selection. If more than one service is available, customers choose using native, keyboard-operable radio controls. A service with an active ticket for the current customer is disabled and its ticket remains available above the join form.

Service choices use a clear bordered selected state with service and branch icons. Active-ticket rows enter and reorder with short layout transitions. The ticket view gives the number and status the strongest hierarchy, pairs status labels with recognizable icons, and uses the branch and business date as supporting details.

Customers select a service and, when configured, a queue and service-specific request fields before joining. Field definitions and answer values are validated by the API. The ticket stores the submitted values and a label snapshot for the operator. The form warns customers not to enter account/card numbers, government ID numbers, passwords, PINs, OTPs, or income details in free-text fields.

Queue joining disables the action while the request is pending, redirects to the assigned ticket after success, and shows an API conflict if another browser or concurrent request already created an active ticket. Ticket state refreshes every eight seconds while the page is visible and online, on tab focus/reconnect, or through the explicit refresh control. Polling pauses when the page is hidden or offline.

## Ticket status

The ticket page gives the number and current status first, then displays the service, branch, and business date. It provides concise guidance for every backend state:

| API state | Guidance |
| --- | --- |
| `WAITING` | Keep the page open or check back for updates. |
| `PENDING` | It is the customer's turn; go to the service desk. |
| `OPERATING` | Service is in progress; stay with the operator. |
| `COMPLETED` | Service is complete. |
| `SKIPPED` | Ask the service desk for guidance. |
| `CANCELLED` | Join an active service again if help is still needed. |
| `NO_SHOW` | Ask the service desk about next steps. |

Customers can cancel a waiting ticket after confirming; called or in-service tickets cannot be cancelled. Configured services can accept up to five PDF, PNG, or JPG files (10 MiB each) through a same-origin authenticated upload proxy. Required document services block operator start until at least one file is attached. The reflective ticket highlight follows mouse input, uses neutral theme colors, and is disabled for reduced-motion users. The API does not return a reliable customer position or wait-time estimate; neither is derived from ticket numbers. If a refresh fails, the last valid ticket stays visible with retry feedback.

Uploaded data is stored in PostgreSQL for this prototype and protected by ticket-level customer/operator/manager access checks. The demo does not scan malware or provide a production document-storage service; see [branch management and customer documents](branch-management.md) before handling real customer data.

## Validation

- Component tests cover one-service auto-selection, multiple-service choice, duplicate prevention, join errors, active-ticket recovery, status guidance, manual refresh, and reduced-motion-safe status transitions.
- The `customer-queue.spec.ts` Playwright flow covers joining, reloading and recovering an active ticket, explicit refresh, the duplicate-request conflict path, and the operator queue lifecycle.
- The Playwright flow requires the repository's Docker-backed E2E setup; see the [development guide](development.md#end-to-end-tests).
