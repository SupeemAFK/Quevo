# Customer ticket flow

Customers with an active ticket see that ticket first and can return to its status page. A customer can hold one active ticket across all services, branches, and business dates. The service form stays unavailable until the ticket is completed, skipped, cancelled, or otherwise leaves an active state; the API transaction and PostgreSQL partial unique index enforce the same rule across devices and concurrent requests. If no ticket is active and one service is available, its branch and service are shown as context. If multiple services are available, customers choose using keyboard-operable radio controls.

Service choices use a clear bordered selected state with service and branch icons. Active-ticket rows enter and reorder with short layout transitions. The ticket view gives the number and status the strongest hierarchy, pairs status labels with recognizable icons, and uses the branch and business date as supporting details.

Customers select a service and, when configured, a queue and service-specific request fields before joining. The form uses React Hook Form with shared shadcn form, label, input, textarea, and select controls. Service fields render as single-select lists, short text inputs (200 characters), or long answer textareas (1,000 characters); the field type matches the kind of information requested. Required answers are checked before submission and validated again by the API. The ticket stores the submitted values and a label snapshot for the operator. The form warns customers not to enter account/card numbers, government ID numbers, passwords, PINs, OTPs, or income details in free-text fields. Services that allow documents show their checklist and file picker before the join action. Selected PNG and JPEG files show image previews; up to five PDF, PNG, or JPG files (10 MiB each) are uploaded to the created ticket immediately after the join succeeds. If upload fails after ticket creation, the active ticket remains visible so the customer can open it and retry.

Queue joining disables the action while the request is pending and redirects to the assigned ticket after success. Validation, duplicate-ticket, authorization, and unavailable-service messages are shown from the API response; unexpected server failures include a request reference for support. Ticket state refreshes every eight seconds while the page is visible and online, on tab focus/reconnect, or through the explicit refresh control. Polling pauses when the page is hidden or offline.

## Ticket status

The ticket page uses a dark, layered ticket face with concave side notches, perforated dividers, and a detachable status stub. A large ticket number and service lead the layout; branch and business date stay below as supporting details. The ticket keeps its contrast in both themes, while the status badge uses the backend state’s semantic color. It provides concise guidance for every backend state:

| API state | Guidance |
| --- | --- |
| `WAITING` | Keep the page open or check back for updates. |
| `PENDING` | It is the customer's turn; go to the service desk. |
| `OPERATING` | Service is in progress; stay with the operator. |
| `COMPLETED` | Service is complete. |
| `SKIPPED` | Ask the service desk for guidance. |
| `CANCELLED` | Join an active service again if help is still needed. |
| `NO_SHOW` | Ask the service desk about next steps. |

Customers cancel a waiting ticket through the shadcn/Radix modal confirmation dialog; called or in-service tickets cannot be cancelled. The dialog is rendered in the page and does not use a browser-native JavaScript confirmation popup. Customers can add further files from the ticket’s **Add document** control. Required document services block operator start until at least one file is attached. The ticket page previews uploaded images and provides a download link for PDFs. The ticket highlight follows mouse input and is disabled for reduced-motion users. The API does not return a reliable customer position or wait-time estimate; neither is derived from ticket numbers. If a refresh fails, the last valid ticket stays visible with retry feedback.

Uploaded data is stored in PostgreSQL for this prototype and protected by ticket-level customer/operator/manager access checks. The demo does not scan malware or provide a production document-storage service; see [branch management and customer documents](branch-management.md) before handling real customer data.

## Validation

- Component tests cover one-service auto-selection, multiple-service choice, required service answers and uploads, selected-image previews, one-active-ticket blocking, active-ticket recovery, status guidance, manual refresh, and reduced-motion-safe status transitions.
- The `customer-queue.spec.ts` Playwright flow covers bank-service selection, the pre-join request form and image upload/preview, ticket recovery, explicit refresh, cross-device duplicate handling, and the operator queue lifecycle.
- The Playwright flow requires the repository's Docker-backed E2E setup; see the [development guide](development.md#end-to-end-tests).
