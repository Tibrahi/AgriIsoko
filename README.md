# AgriIsoko

AgriIsoko is a Rwanda-focused agricultural marketplace and food intelligence workspace. Operational dashboard indicators are queried from PostgreSQL and are not seeded with sample data.

## Run locally

1. Provide a PostgreSQL connection string in `.env.local`:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
   ```

2. Apply `db/migrations/001_initial.sql` to the configured database using your PostgreSQL migration/deployment process. The application does not run migrations automatically and will not reset or seed database records.
3. Start the Next.js development server with `npm run dev`.

Without `DATABASE_URL`, or when the database/schema is unreachable, sign-in and registration explain the setup requirement. When the database is reachable but has no records, indicators show zero and report tables use a genuine empty state.

## Initial schema

Apply migrations in order. The first defines core agricultural entities; the second adds accounts, role assignments, and hashed server-side sessions. The application never creates or resets the schema at runtime.

## Accounts and access

- `/register` accepts farmer and buyer requests. New accounts remain pending until an administrator reviews them.
- `/login` issues a random, HTTP-only, same-site session cookie backed by a hashed token in PostgreSQL. Passwords are salted and derived with Node.js scrypt; raw passwords and session tokens are not stored in PostgreSQL.
- The dashboard requires an active account. National analytics are limited to the `national_admin` and `analyst` roles. Other active accounts are denied access to those aggregates until role-scoped workflows are implemented.
- Administrators can approve pending accounts as farmer, buyer, or analyst, or decline a pending request. Changes are written to the audit table; this first admin screen is not general account management for already approved users.
- The first administrator must be provisioned from a trusted server environment after both migrations have been applied. Set `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_NAME`, and a one-time `ADMIN_PASSWORD` of at least 16 characters, then run `npm run create-admin`. Remove the one-time password from the environment afterward. The command refuses to create a second initial administrator.

Role assignments for field officers and district/sector scopes are defined as data structures but not yet exposed for assignment. Do not grant unscoped staff roles directly in the database until geographic scope checks are implemented.

Email ownership verification and password recovery are not implemented. Administrators should verify a registrant's identity through an approved operational process before granting access. Before public deployment, configure HTTPS and request-rate limiting for `/api/auth/login` and `/api/auth/register` at a trusted edge or reverse proxy.

All submitted operational records should retain source, submission time, location, and verification status. Estimates, submitted reports, and verified records must remain distinct. Aggregates displayed in the app reflect AgriIsoko records only; they are not national estimates.

## Current scope and next steps

The initial dashboard reads verified harvested quantities, verified available stock, verified open listings, pending harvest reports, and recent actual-harvest reports. Account registration, sign-in, administrator approval, and session revocation are implemented. Next steps are scoped reporting permissions, audited harvest submission and verification, transactional stock movements, order state transitions, and a pilot with authorized users before wider geographic summaries.
