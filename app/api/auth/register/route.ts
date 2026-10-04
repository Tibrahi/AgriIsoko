import type { PoolClient } from "pg";
import { getPool } from "@/lib/agri-data";
import { createSession, hashPassword, normalizeEmail, verifySameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  let body: { name?: unknown; email?: unknown; password?: unknown; role?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Enter valid account details." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const requestedRole = typeof body.role === "string" ? body.role.trim().toLocaleLowerCase() : "";
  const role = requestedRole === "buyer" ? "buyer" : requestedRole === "farmer" ? "farmer" : "";
  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 256 || !role) {
    return Response.json({ error: "Use a valid name and email, choose farmer or buyer, and set a password of at least 12 characters." }, { status: 400 });
  }
  let client: PoolClient;
  try { client = await getPool().connect(); }
  catch { return Response.json({ error: "Registration is unavailable. Configure DATABASE_URL and apply the AgriIsoko migrations." }, { status: 503 }); }
  try {
    const { salt, hash } = await hashPassword(password);
    await client.query("BEGIN");
    const organization = await client.query<{ id: string }>(
      "INSERT INTO organizations (name, organization_type) VALUES ($1, $2) RETURNING id",
      [name, role],
    );
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO users (organization_id, display_name, email, password_salt, password_hash, account_status)
       VALUES ($1, $2, $3, $4, $5, 'pending') ON CONFLICT DO NOTHING RETURNING id`,
      [organization.rows[0].id, name, email, salt, hash],
    );
    if (!inserted.rows[0]) {
      await client.query("ROLLBACK");
      return Response.json({ error: "An account with those details could not be created. If you already registered, sign in or contact your administrator." }, { status: 409 });
    }
    const assignment = await client.query("INSERT INTO user_roles (user_id, role_id, organization_id) SELECT $1, id, $2 FROM roles WHERE name = $3", [inserted.rows[0].id, organization.rows[0].id, role]);
    if (assignment.rowCount !== 1) throw new Error("The requested account role is not configured.");
    await client.query("COMMIT");
    await createSession(inserted.rows[0].id);
    return Response.json({ ok: true, status: "pending" }, { status: 201 });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return Response.json({ error: "Registration is temporarily unavailable. Check that PostgreSQL and the AgriIsoko migrations are ready." }, { status: 503 });
  } finally {
    client.release();
  }
}
