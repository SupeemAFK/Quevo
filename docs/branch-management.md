# Branch management and customer documents

Branch managers are assigned explicitly to branches and can configure only their assigned branch. The manager workspace supports service activation, multiple queues per service, up to five single-select or short-text customer fields, document guidance and requirements, counters, queue/operator assignments, and per-service outcome summaries over a UTC date range.

## Demo banking catalog

`make seed-demo` creates these synthetic services at the demo branch. The exact products and document checklists should be configured by each institution's compliance and operations teams.

| Demo service | Customer request field | Uploads | Required before service starts |
| --- | --- | --- | --- |
| Account Opening | Account type | Yes | Yes |
| Card Services | Card request type | No | No |
| Personal Loan Application | Loan type | Yes | Yes |
| Account Maintenance | Request type | No | No |
| Digital Banking Help | Support area | No | No |

These queue forms deliberately do not collect account or card numbers, government ID numbers, passwords, PINs, OTPs, or income details. Customers see the configured request fields and document checklist after selecting a service. When a service allows uploads, the customer receives a ticket first, then uses **Add document** on the ticket page; this associates each file with the right queue request. Sensitive numeric identifiers and authentication secrets must not be entered in free-text fields.

## Document flow and current limits

The ticket page sends attachments to a same-origin web route. That route checks the browser origin and a request marker, reads the HttpOnly session cookie on the server, and proxies the upload to the Go API. The API validates the ticket owner, service upload policy, waiting/called state, count, size, extension, declared MIME type, and detected content type. It accepts at most five PDF, PNG, or JPEG files up to 10 MiB each. Customers can list and download only their ticket's files; branch managers and assigned operators can access documents only for tickets within their authorized branch/queue. Responses use private no-store caching and `nosniff`.

Prototype limitations: document bytes are stored in PostgreSQL, there is no malware scanning, no antivirus quarantine, no retention/deletion workflow, and production encryption-at-rest depends on the database deployment. Do not upload real customer documents to this prototype. Before banking production use, move files to private encrypted object storage, scan/quarantine uploads before staff access, define retention and audit policy, and enforce institution-specific document and data-loss controls.

## Queue history and metrics

Every ticket receives an initial `WAITING` event and a row for each subsequent state transition. Operators assigned to the queue and the branch's managers may read the audit history. Service summaries count completed, skipped, cancelled, and no-show tickets and report average wait and service durations; they do not expose customer identifiers.

Apply migration `000003_sprint2_queue_expansion` before running the demo seed. See [the API setup guide](../apps/api/README.md#database-setup) for local credentials.
