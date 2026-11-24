# Branch management and customer documents

Branch managers are assigned explicitly to branches and can configure only their assigned branch. The manager workspace supports service activation, multiple queues per service, up to five request fields, document guidance and requirements, counters, queue/operator assignments, and per-service outcome summaries over a UTC date range. Each field can be a single-select question, a short text input (200 characters), or a long answer textarea (1,000 characters). Use a select for fixed choices and text controls for details customers need to explain.

## Demo banking catalog

`make seed-demo` creates these synthetic services at the demo branch. The exact products and document checklists should be configured by each institution's compliance and operations teams.

| Demo service | Customer request fields | Uploads | Required before service starts |
| --- | --- | --- | --- |
| Account Opening | Account type; individual or joint; questions for the account team | Yes | Yes |
| Card Services | Request type; card product name (no number); issue description | No | No |
| Personal Loan Application | Loan type; new or follow-up; note for the loan officer | Yes | Yes |
| Account Maintenance | Request type; account type (no number); request details | No | No |
| Digital Banking Help | Support area; device model; issue description | No | No |

These queue forms deliberately do not collect account or card numbers, government ID numbers, passwords, PINs, OTPs, or income details. Customers see configured request fields and the document checklist before joining. The React Hook Form flow validates required answers and files, previews selected images, creates the ticket, and then uploads selected files to that ticket. Customers can use **Add document** on the ticket page to attach further files. The API and database enforce one active ticket per customer across all services and dates. Sensitive numeric identifiers and authentication secrets must not be entered in free-text fields.

## Document flow and current limits

The customer page selects attachments before joining and uploads them to the newly created ticket through a same-origin web route. The ticket page can also send additional attachments through that route. It checks the browser origin and a request marker, reads the HttpOnly session cookie on the server, and proxies the upload to the Go API. The API validates the ticket owner, service upload policy, waiting/called state, count, size, extension, declared MIME type, and detected content type. It accepts at most five PDF, PNG, or JPEG files up to 10 MiB each. Customers can preview images, list and download only their ticket's files; branch managers and assigned operators can access documents only for tickets within their authorized branch/queue. Responses use private no-store caching and `nosniff`.

Prototype limitations: document bytes are stored in PostgreSQL, there is no malware scanning, no antivirus quarantine, no retention/deletion workflow, and production encryption-at-rest depends on the database deployment. Do not upload real customer documents to this prototype. Before banking production use, move files to private encrypted object storage, scan/quarantine uploads before staff access, define retention and audit policy, and enforce institution-specific document and data-loss controls.

## Queue history and metrics

Every ticket receives an initial `WAITING` event and a row for each subsequent state transition. Operators assigned to the queue and the branch's managers may read the audit history. Service summaries count completed, skipped, cancelled, and no-show tickets and report average wait and service durations; they do not expose customer identifiers.

Apply all versioned migrations with `make migrate-up` before running the demo seed. Migration `000005_service_form_long_text` adds long-answer fields to the existing service form schema. See [the API setup guide](../apps/api/README.md#database-setup) for local credentials.
