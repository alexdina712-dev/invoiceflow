# Deployment

## Recommended topology

Vercel serves the built Vite frontend. It rewrites `/api/:path*` to an Express API on Render. Neon hosts PostgreSQL. Use free plans and do not enable paid resources without explicit budget approval.

1. Provision a PostgreSQL database. Store `DATABASE_URL` only in backend environment settings.
2. Create a Render Node web service with `render.yaml` commands, Node 22.20.0, `NODE_ENV=production`, exact public frontend `APP_ORIGIN`, and health path `/api/health`.
3. Build runs frozen pnpm install, Prisma generation, frontend/server compilation. Start applies committed migrations and starts the API. Migration history must stay committed.
4. Seed fictional data once using `ALLOW_DEMO_SEED=true pnpm db:seed:built` with the cloud database environment. It does not overwrite an existing demo.
5. Run `node scripts/configure-vercel.mjs https://YOUR-SERVICE.onrender.com`. Commit the resulting `vercel.json`. Deploy the project with Vercel, build `pnpm db:generate && pnpm build`, output `dist` (see configuration).
6. Ensure `APP_ORIGIN` exactly matches the canonical Vercel origin. Redirect alternate domains to the canonical origin. Cookies must be Secure/HttpOnly/SameSite=Lax, and the browser must call same-origin `/api`.
7. Run local/CI checks and public Playwright workflows with `PUBLIC_DEMO_URL`. Confirm cross-account PDF/export access fails and account deletion works.

For CLI Vercel deployment, `vercel link --project <project>` and `vercel --prod` from a clean deployment checkout. Never upload `.env`, `.vercel` tokens, local database contents, test output, or hosting-tool credential files to GitHub/Drive. The actual deployment method and domains are recorded in PUBLIC_DEPLOYMENT.md.

Free Render services may sleep after inactivity; the first API request can take a while. Neon can also suspend idle compute. The demo does not run artificial keep-alive jobs. Frontend/API updates must be deployed together for contract changes. Confirm the Render commit matches the intended source; trigger a reviewed deployment explicitly if GitHub checks do not trigger it automatically.

## Docker

Set a URL-safe `POSTGRES_PASSWORD` in your shell and run `docker compose up --build`. This binds port 4002 for the combined app and keeps PostgreSQL internal. The image runs as the unprivileged Node user and includes licensed fonts. Production seeding is explicit:

```sh
docker compose exec -e ALLOW_DEMO_SEED=true app node dist-server/prisma/seed.js
```

Cookies are Secure under production. For a local plain-HTTP Docker smoke test use a development NODE_ENV override; use HTTPS for a real deployment. Docker configuration is provided; execution status is in VERIFICATION.md. Back up the database volume separately before destructive maintenance.
