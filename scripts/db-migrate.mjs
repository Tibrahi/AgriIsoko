import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadProjectEnv } from "./load-env.mjs";

loadProjectEnv();

if (!process.env.DATABASE_URL) {
  console.error("Migration stopped: DATABASE_URL is not configured. Copy .env.example to .env.local and add your PostgreSQL URI.");
  process.exit(1);
}

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../db/migrations");
const files = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name)).sort();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000, query_timeout: 30000 });
const client = await pool.connect();
let locked = false;

try {
  await client.query("SELECT pg_advisory_lock(810240611)");
  locked = true;
  const version = await client.query("SELECT current_setting('server_version_num')::int AS version_num");
  if (version.rows[0].version_num < 130000) throw new Error("AgriIsoko requires PostgreSQL 13 or later.");
  await client.query(`CREATE TABLE IF NOT EXISTS agriisoko_schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = await client.query("SELECT name FROM agriisoko_schema_migrations");
  const appliedNames = new Set(applied.rows.map((row) => row.name));

  for (const name of files) {
    if (appliedNames.has(name)) continue;
    const sql = await readFile(path.join(directory, name), "utf8");
    try {
      await client.query(sql);
      await client.query("INSERT INTO agriisoko_schema_migrations (name) VALUES ($1)", [name]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
    console.log(`Applied ${name}.`);
  }
  console.log(`Migration check complete (${files.length} migration file${files.length === 1 ? "" : "s"}).`);
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown error";
  console.error(`Database migrations failed (${code}). Check PostgreSQL permissions and migration compatibility; existing records were not reset.`);
  process.exitCode = 1;
} finally {
  if (locked) await client.query("SELECT pg_advisory_unlock(810240611)").catch(() => undefined);
  client.release();
  await pool.end();
}
