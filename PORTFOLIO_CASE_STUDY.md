# InvoiceFlow — portfolio case study

## Problem

Freelancers often keep client details, service rates, invoices, and payment notes in separate documents. That makes it easy to lose track of overdue work or introduce inconsistent totals. InvoiceFlow brings those workflows into one lightweight business workspace.

## Solution and user workflow

A user creates an account, completes seller details, adds clients and service presets, and builds a draft invoice. The editor previews exact line totals. The server validates and independently recomputes the saved invoice. The user downloads its PDF, delivers it externally, marks it sent, and records payment later. The dashboard shows received and unpaid amounts by currency. Search and CSV exports make records easy to find and reuse.

## Key features

Private client/service CRUD; percentage discounts and per-line taxes; EUR/RON/USD/GBP; sequential invoice numbering; snapshots; immutable sent documents; derived overdue status; duplicate-to-draft; payment history; Unicode PDFs; currency-separated charts; client/invoice CSV; responsive screens; password-confirmed account deletion; fictional recruiter demo.

## Architecture and database

React/TypeScript/Vite communicates with an Express REST API through same-origin `/api`. Shared Zod schemas define validation and typed input; decimal.js defines the calculation contract. Domain services own transactions and PDF generation. Prisma maps users, digest sessions, seller profiles, clients, services, invoices, lines, and events to PostgreSQL.

Client deletion uses a nullable relation while keeping invoice snapshots. Account deletion cascades everything. User-scoped row locks serialize invoice creation and transitions. Revision numbers protect against lost updates from multiple tabs. Paid/cancelled terminal states and immutable issued documents make the lifecycle explicit.

## Calculation model

Money is transported as decimal strings and stored as PostgreSQL decimal values. Each line rounds base, discount, and tax half up to two decimals; totals sum the rounded components. A 2-hour × 100 EUR line with 10% discount and 20% tax gives 200 subtotal, 20 discount, 36 tax, and 216 total. Quantities support three decimal places. Different currencies are never added together or silently converted.

## Technical challenges

1. **Rounding and validation:** a shared exact-decimal function keeps editor and API aligned while server recomputation prevents forged client totals.
2. **History and concurrency:** snapshots protect historical invoice content; locks prevent duplicate numbers; revisions reject stale edits and transitions.
3. **PDF reliability:** embedded licensed Noto Sans fonts support Romanian names. Long invoices paginate with repeated headings and page numbers. A separate process extracts generated PDF text in integration tests.
4. **Mobile usability:** browser tests exposed a hidden logout control. A visible top-bar control fixed the real interaction problem. Full-screen mobile dialogs prevent forms from being clipped.
5. **Deployment boundaries:** Vercel rewrites `/api` to Render so cookies remain same-origin; Neon credentials stay in backend settings only.

## Privacy and security

Every private query is scoped to its authenticated owner. Sessions use random tokens, stored only as SHA-256 digests; cookies are HttpOnly and secure in production. Passwords use bcrypt. Server validation, rate limits, origin checks, and private/no-store API responses protect the main workflows. Client deletion keeps historic snapshots by design; complete account deletion removes all application records. Provider backup retention remains a separate operational concern.

## Testing approach

Exact-math unit tests cover fractional quantities, half-up rounding, full discounts, invalid decimal notation, dates, limits, and CSV formula handling. Supertest integration checks cover auth, client/service CRUD, permissions, concurrency, server recomputation, invoice statuses, snapshot persistence, duplication, CSV, PDFs, logout, and deletion. Six Playwright workflows run on desktop and mobile, locally and against the deployment. Visual checks inspect real app screenshots and rendered invoice PDFs. CI uses a fresh PostgreSQL 16 service.

Actual counts and outcomes are recorded in `docs/VERIFICATION.md`, rather than treating configured tests as passed tests.

## Learning and interview preparation

This project was developed with Codex assistance and adapted a proven scaffold from the earlier portfolio applications. It should not be described as independently authored. The following are concrete topics to study and explain before presenting it in an interview:

- Why decimal strings and line-level rounding are used, and how this differs from binary floating point.
- How database locks and optimistic revisions solve different concurrency problems.
- Why invoice snapshots differ from live client relations.
- What cookie security, origin verification, and ownership checks protect.
- How real API tests differ from mocked component tests.
- How PDF pagination and fonts are packaged for deployment.
- Why mixed-currency totals and invented payment processing would be misleading.

Do not claim to have learned these concepts until you can reproduce and debug the relevant code yourself. A useful exercise is changing one calculation rule, adding its tests, and explaining the resulting trade-offs.

## Future development

Credit notes; email delivery and reminders; recurring billing; team roles; configurable numbering; invoice templates; pagination; operational monitoring; payment integrations. Any jurisdiction-specific tax/e-invoice compliance needs separate requirements and verification.

## Outcome

A working portfolio business application with source, migrations, tests, screenshots, deployment configuration, and reproducible local setup. It is intentionally honest about manual delivery, recorded payments, and the boundaries of a portfolio invoicing tool.
