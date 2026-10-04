import { scryptSync, randomBytes } from "node:crypto";
import pg from "pg";
import { loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();

const { Pool } = pg;
const { DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;

if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD) {
  console.error("Set DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD for this one-time setup command.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 16) {
  console.error("ADMIN_PASSWORD must contain at least 16 characters.");
  process.exit(1);
}

const email = ADMIN_EMAIL.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("ADMIN_EMAIL must be a valid email address.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(810240610)");
  const existing = await client.query("SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'national_admin' LIMIT 1");
  if (existing.rowCount) throw new Error("A national administrator already exists. Use the administration screen to manage accounts.");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(ADMIN_PASSWORD, salt, 64).toString("hex");
  const organization = await client.query("INSERT INTO organizations (name, organization_type) VALUES ($1, 'government') RETURNING id", [ADMIN_NAME]);
  const user = await client.query(
    "INSERT INTO users (organization_id, display_name, email, password_salt, password_hash, account_status) VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id",
    [organization.rows[0].id, ADMIN_NAME.trim(), email, salt, hash],
  );
  const assignment = await client.query("INSERT INTO user_roles (user_id, role_id, organization_id) SELECT $1, id, $2 FROM roles WHERE name = 'national_admin'", [user.rows[0].id, organization.rows[0].id]);
  if (assignment.rowCount !== 1) throw new Error("The national administrator role is missing. Apply the authentication migration and retry.");
  await client.query("COMMIT");
  console.log("Created the initial administrator account. Remove ADMIN_PASSWORD from the environment now.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error instanceof Error ? error.message : "Could not create administrator account.");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
