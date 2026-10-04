# AgriIsoko

AgriIsoko is a Rwanda-focused agricultural marketplace and food intelligence workspace. Operational dashboard indicators are queried from PostgreSQL and are not seeded with sample data.

## Run locally

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to the real URI supplied by Neon:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
   ```

   Replace every placeholder with Neon's connection URI. Use the pooled connection URI for the web app; it has a `-pooler` hostname. Percent-encode reserved characters in the username/password, and keep Neon's `sslmode=require` parameter. The schema requires PostgreSQL 13 or newer. `.env.local` and `.env` are ignored by Git and read by Next.js and the database setup commands. If both files exist, `.env.local` takes precedence.

2. Check the connection and apply the versioned migrations in order:

   ```sh
   npm run db:check
   npm run db:migrate
   npm run db:check
   ```

   The first check confirms the connection/version; it reports that the schema is missing until migrations are applied. The migration command uses a PostgreSQL advisory lock and a migration ledger, and does not reset or seed records.
3. Provision the first administrator by temporarily setting `ADMIN_EMAIL`, `ADMIN_NAME`, and a unique `ADMIN_PASSWORD` of at least 16 characters in `.env.local`, then run `npm run create-admin`. Remove `ADMIN_PASSWORD` from `.env.local` after it succeeds.
4. Start the Next.js development server with `npm run dev`.

Without `DATABASE_URL`, or when the database/schema is unreachable, sign-in and registration explain the setup requirement. When the database is reachable but has no records, indicators show zero and report tables use a genuine empty state.

## Initial schema

The migration runner applies the SQL files in order. The first defines core agricultural entities; the second adds accounts, role assignments, and hashed server-side sessions. The application never creates or resets the schema at runtime.

## Accounts and access

- `/register` accepts farmer and buyer requests. New accounts remain pending until an administrator reviews them.
- `/login` issues a random, HTTP-only, same-site session cookie backed by a hashed token in PostgreSQL. Passwords are salted and derived with Node.js scrypt; raw passwords and session tokens are not stored in PostgreSQL.
- Pending users can sign in to see their review state. Rejected users can sign in to see the decision and any administrator note, but cannot submit or access approved-user data. Suspended accounts cannot sign in. Approved users are routed to role-appropriate dashboards.
- National analytics are limited to the `national_admin` and `analyst` roles. Farmers can manage their own farm, harvest, inventory, and produce listing submissions. Buyers can create and track purchase requests. Users cannot edit/delete verified submissions; seller order transitions and buyer cancellations are checked against organization ownership.
- Administrators can approve pending or reconsider rejected accounts as farmer, buyer, or analyst, or reject a pending request with an optional note. Decisions are written to the audit table.
- The first administrator must be provisioned from a trusted server environment after both migrations have been applied. Set `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_NAME`, and a one-time `ADMIN_PASSWORD` of at least 16 characters, then run `npm run create-admin`. Remove the one-time password from the environment afterward. The command refuses to create a second initial administrator.

Role assignments for field officers and district/sector scopes are defined as data structures but not yet exposed for assignment. Do not grant unscoped staff roles directly in the database until geographic scope checks are implemented.

Email ownership verification and password recovery are not implemented. Administrators should verify a registrant's identity through an approved operational process before granting access. Before public deployment, configure HTTPS and request-rate limiting for `/api/auth/login` and `/api/auth/register` at a trusted edge or reverse proxy.

All submitted operational records should retain source, submission time, location, and verification status. Estimates, submitted reports, and verified records must remain distinct. Aggregates displayed in the app reflect AgriIsoko records only; they are not national estimates.

## Current scope and next steps

The dashboard routes include `/dashboard`, `/dashboard/marketplace`, `/dashboard/my-records`, `/dashboard/harvest-reports`, `/dashboard/availability`, `/dashboard/analytics`, administrator-only `/dashboard/accounts`, and administrator-only `/dashboard/data`. The workspace header checks Neon live and reports its connection state. The data manager provides audited create, edit, and delete operations for crops, locations, organizations, seasons, farms, harvest reports, inventory, marketplace listings, and orders. User submissions are tied to the signed-in user and organization and remain pending until reviewed. Pages use real database records and clear empty states rather than sample figures. Account registration, sign-in, administrator approval/rejection, and session revocation are implemented.
