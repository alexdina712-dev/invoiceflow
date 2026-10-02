# REST API

Base `/api`; JSON bodies and errors `{ "error": "message" }`. Private endpoints require the `invoiceflow_session` HttpOnly cookie. API responses use `Cache-Control: no-store`. Production mutations require the configured frontend Origin header. Errors: 400 validation, 401 unauthenticated, 403 origin/demo-account restriction, 404 missing/unowned record, 409 stale/conflicting state, 413 oversized body, 429 rate limit, 500 generic unexpected failure.

| Method           | Route                               | Behavior                                            |
| ---------------- | ----------------------------------- | --------------------------------------------------- |
| GET              | `/health`                           | Database readiness                                  |
| POST             | `/auth/register`                    | name/email/password, creates seller profile/session |
| POST             | `/auth/login`                       | email/password, rotates session                     |
| POST             | `/auth/logout`                      | Revokes current session                             |
| GET              | `/auth/me`                          | Current safe user                                   |
| GET/PUT          | `/workspace/profile`                | Seller profile                                      |
| GET/POST         | `/workspace/clients`                | List/create                                         |
| PATCH/DELETE     | `/workspace/clients/:id`            | Edit/delete; snapshots remain                       |
| GET/POST         | `/workspace/services`               | List/create presets                                 |
| PATCH/DELETE     | `/workspace/services/:id`           | Edit/delete preset                                  |
| GET/POST         | `/workspace/invoices`               | Filtered list/create draft                          |
| GET/PATCH/DELETE | `/workspace/invoices/:id`           | Read/edit draft/delete draft                        |
| PATCH            | `/workspace/invoices/:id/status`    | status + current revision                           |
| POST             | `/workspace/invoices/:id/duplicate` | New draft, new number                               |
| GET              | `/workspace/invoices/:id/pdf`       | Private PDF attachment                              |
| GET              | `/workspace/export/clients`         | All own clients as CSV                              |
| GET              | `/workspace/export/invoices`        | Filtered own invoices as CSV                        |
| DELETE           | `/workspace/account`                | Password confirmation, cascading deletion           |

Invoice list/export query: `q`, `clientId`, `status`, `currency`, `from`, `to` (issue-date range, inclusive). Valid statuses: DRAFT/SENT/PAID/OVERDUE/CANCELLED; OVERDUE is computed, not stored.

Create invoice: clientId, issueDate, dueDate, currency, notes, items. Each item: description, unit, quantity, unitPrice, discountPercent, taxRate. All numeric item values are strings. Edit also requires revision. Server assigns number and totals, snapshots current parties, and returns items/events. Status body: `{ "status": "SENT", "revision": 1 }`. Allowed DRAFT→SENT/CANCELLED, SENT→PAID/CANCELLED. Paid/Cancelled are terminal. Sending and payment are manual bookkeeping only.

Authentication requests are limited to 50 per 15 minutes per IP. PDF downloads are limited to 30 per minute per signed-in user. JSON is capped at 512 KB. In-process limit counters are not distributed across replicas.
