# Public demo deployment

Verified 2 October 2026.

- Frontend: https://invoiceflow-dina19.vercel.app
- API: https://invoiceflow-api-yna9.onrender.com
- Health (same-origin proxy): https://invoiceflow-dina19.vercel.app/api/health
- Source: https://github.com/alexdina712-dev/invoiceflow
- Organized Drive backup: https://drive.google.com/drive/folders/1mqLnxqaZlVpyqhSFLW07vGKJpXrOgwm1

Click **Explore the demo workspace**, or sign in with `demo@invoiceflow.app` / `InvoiceFlowDemo!2026`. Sample data includes six fictional clients, seven service presets, 20 invoices, multiple statuses, and all four supported currencies. Do not add sensitive data to the shared demo.

## Infrastructure

Vercel Hobby project `invoiceflow`, Render free service `invoiceflow-api` in Frankfurt, Neon project `InvoiceFlow Portfolio Demo` with PostgreSQL 16. The exact Neon credential was explicitly approved for private transfer to Render as DATABASE_URL. It is absent from source, frontend, Drive, and Desktop backups.

The frontend was deployed by Vercel CLI from a clean Git archive, with `/api` rewritten to the Render service. The alternate production domain redirects to the canonical domain. Render is configured to deploy after checks; verify commit/status in the dashboard and trigger a deployment explicitly if the public-repository check trigger does not fire. Vercel automatic Git deployment is not connected; use the documented CLI workflow for updates.

Initial verified frontend source: `fd64465`; initial verified API source: `36df8cd`. The later source updates add launchers, routing, documentation, and refreshed screenshots without changing the running domain/API implementation. Backups identify their exact source commit in the manifest.

## Verification

- Public HTML and proxied database health: HTTP 200 without deployment-login protection.
- Six browser workflows on desktop and mobile: all 12 passed against the public deployment.
- Demo login and logout: successful; cookie HttpOnly/Secure/SameSite=Lax.
- API responses: no-store; untrusted mutation Origin: 403.
- Real PDF downloads, invoice calculations, client/service CRUD, invoice status changes/duplication, account deletion: verified in public browser workflows.
- GitHub Actions verified the production build, 37 unit/API tests, and 12 browser tests against fresh PostgreSQL 16.

Free Render services sleep after inactivity, so the first request can take about a minute. All portfolio Render services share the account's free resource allowance. No paid services or artificial keep-alive jobs were enabled. Provider limits can suspend availability; do not promise production uptime from this portfolio demo.
