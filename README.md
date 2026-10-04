# AgriIsoko

AgriIsoko is a Rwanda-focused agricultural marketplace and food intelligence workspace. Operational dashboard indicators are queried from PostgreSQL and are not seeded with sample data.

## Run locally

1. Provide a PostgreSQL connection string in `.env.local`:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
   ```

2. Apply `db/migrations/001_initial.sql` to the configured database using your PostgreSQL migration/deployment process. The application does not run migrations automatically and will not reset or seed database records.
3. Start the Next.js development server with `npm run dev`.

Without `DATABASE_URL`, or when the database/schema is unreachable, the dashboard presents a clear unavailable state. When the database is reachable but has no records, indicators show zero and report tables use a genuine empty state.

## Initial schema

The first migration defines the core geography, organization, user, crop, season, farm, harvest report, inventory balance, listing, order, and audit-event entities. It is a starting operational schema, not a complete authorization system. Do not expose data-entry or verification mutations until authentication, role scope, and reviewer separation are configured for the deployment.

All submitted operational records should retain source, submission time, location, and verification status. Estimates, submitted reports, and verified records must remain distinct. Aggregates displayed in the app reflect AgriIsoko records only; they are not national estimates.

## Current scope and next steps

The initial dashboard reads verified harvested quantities, verified available stock, verified open listings, pending harvest reports, and recent actual-harvest reports. Next implementation steps are to select and configure authentication/role-based access, implement audited submission and review workflows, add transactional stock movements and order state transitions, and pilot with authorized users before presenting wider geographic summaries.
