# Privacy and security boundaries

All business data is private to a signed-in user. The application does not publish clients or invoices and does not share content with AI providers. PDFs and CSV files require authenticated ownership checks.

The shared demo intentionally uses fictional data and shared access. Do not enter sensitive information there. A private account is separate from the demo.

Client deletion removes the live client record; original invoice snapshots remain as historical documents. Service deletion leaves invoice lines intact. Draft invoices can be deleted. Issued invoices can be cancelled if unpaid; they cannot be edited or deleted. Account deletion with password confirmation removes the user, profile, clients, services, invoices, lines, events, and sessions from the application database. Managed-provider backup retention is not controlled by this route.

Sessions expire after seven days and store token digests rather than raw bearer tokens. Cookies are HttpOnly, SameSite=Lax, and Secure in production. Passwords are bcrypt-hashed at cost 12. Production uses exact Origin checks for mutations and same-origin frontend proxying. Private API responses are not cached. Environment files, local database files, dependencies, logs, and hosting credentials are excluded from source and backups.

This demo has no password reset, email verification, MFA, background session cleanup, or audited compliance certification. Database/provider access must remain restricted. No real banking details appear in seed data.
