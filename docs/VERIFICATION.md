# Verification record

Date: 2 October 2026. Tests use fictional data and disposable accounts.

- Production TypeScript/Vite/server build: passed.
- Vitest unit/API suite: 37 tests passed (17 calculation/validation and 20 API integration tests).
- Desktop/mobile browser checks: initial run found missing mobile logout; fixed with visible top-bar control. Final rerun: all 12 desktop/mobile tests passed.
- Generated PDF: real PDF header, extracted invoice number, Romanian Unicode seller name, and expected monetary total verified. Rendered demo invoice visually reviewed with Poppler.
- Responsive screenshots: desktop 1440px and mobile 390px reviewed. Tables deliberately scroll within their container; page-width overflow is checked in browser tests.
- Local PostgreSQL migrations and idempotent fictional demo seed: applied successfully.
- GitHub Actions on PostgreSQL 16: passed, run 36992518028. Public Vercel/Render/Neon deployment: health and all 12 public desktop/mobile workflows passed. Desktop packaging checks recorded below.
- Docker files supplied; container runtime execution has not yet been verified on this computer.

No test uses real customer information. Public tests register temporary accounts and remove them after each workflow. Keep generated browser reports and private runtime files outside the repository.

## Public verification

Canonical demo: https://invoiceflow-dina19.vercel.app. Cookie security flags and no-store responses verified; wrong-Origin mutation returned 403. Public tests used temporary private accounts and deleted them. Eight screenshots and the sample PDF were recaptured from the live fictional demo.

## Runtime limitations

Docker is not installed on this computer, so Docker execution was not tested. Local embedded PostgreSQL uses version 18.4; CI and Neon use PostgreSQL 16 and the migration passes on both. Free cloud resources may sleep or hit shared quotas. No email or payment integration is claimed.
