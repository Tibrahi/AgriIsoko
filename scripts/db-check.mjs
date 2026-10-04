import pg from "pg";
import { randomUUID } from "node:crypto";
import { loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();

if (!process.env.DATABASE_URL) {
  console.error("Database check failed: DATABASE_URL is not configured. Copy .env.example to .env.local and add your PostgreSQL URI.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000, query_timeout: 5000 });
try {
  const connection = await pool.query("SELECT current_setting('server_version') AS version, current_setting('server_version_num')::int AS version_num");
  const schema = await pool.query(
    `SELECT to_regclass('public.agriisoko_schema_migrations') IS NOT NULL AS migration_table,
            to_regclass('public.harvest_reports') IS NOT NULL AS harvest_table,
            to_regclass('public.auth_sessions') IS NOT NULL AS auth_table`,
  );
  const migrations = schema.rows[0].migration_table
    ? await pool.query("SELECT count(*)::text AS count FROM agriisoko_schema_migrations")
    : { rows: [{ count: "0" }] };
  console.log(`Connected to PostgreSQL ${connection.rows[0].version}.`);
  if (connection.rows[0].version_num < 130000) {
    console.error("AgriIsoko requires PostgreSQL 13 or later.");
    process.exitCode = 2;
  }
  console.log(`AgriIsoko schema: ${schema.rows[0].harvest_table && schema.rows[0].auth_table ? "present" : "not fully installed"}.`);
  console.log(`Recorded migrations: ${migrations.rows[0].count}.`);
  if (!schema.rows[0].harvest_table || !schema.rows[0].auth_table) process.exitCode = 2;
  else {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO crops (name, active) VALUES ($1, true)", [`__agriisoko_write_check_${randomUUID()}__`]);
      await client.query("ROLLBACK");
      console.log("Database write check: passed (temporary record rolled back).");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown error";
  console.error(`Database check failed (${code}). Verify DATABASE_URL, network access, credentials, and database permissions.`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
