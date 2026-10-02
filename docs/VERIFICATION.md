# Verification record

Date: 2 October 2026. Tests use fictional data and disposable accounts.

- Production TypeScript/Vite/server build: passed.
- Vitest unit/API suite: 37 tests passed (17 calculation/validation and 20 API integration tests).
- Desktop/mobile browser checks: initial run found missing mobile logout; fixed with visible top-bar control. Final rerun: all 12 desktop/mobile tests passed.
- Generated PDF: real PDF header, extracted invoice number, Romanian Unicode seller name, and expected monetary total verified. Rendered demo invoice visually reviewed with Poppler.
- Responsive screenshots: desktop 1440px and mobile 390px reviewed. Tables deliberately scroll within their container; page-width overflow is checked in browser tests.
- Local PostgreSQL migrations and idempotent fictional demo seed: applied successfully.
- GitHub Actions on PostgreSQL 16: passed, run 36992518028. Public deployment and Desktop backup verification: pending final delivery checks.
- Docker files supplied; container runtime execution has not yet been verified on this computer.

No test uses real customer information. Public tests register temporary accounts and remove them after each workflow. Keep generated browser reports and private runtime files outside the repository.
