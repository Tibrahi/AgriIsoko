import { getPool } from "@/lib/agri-data";
import { getSession, isAdmin, verifySameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await getSession();
    if (!admin || !isAdmin(admin)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const result = await getPool().query<{ id: string; name: string; email: string; organization_type: string; created_at: string }>(
      `SELECT u.id, u.display_name AS name, u.email, o.organization_type, u.created_at::text
       FROM users u JOIN organizations o ON o.id = u.organization_id
       WHERE u.account_status = 'pending' ORDER BY u.created_at ASC LIMIT 100`,
    );
    return Response.json({ accounts: result.rows });
  } catch {
    return Response.json({ error: "The account review queue is unavailable. Check PostgreSQL and the migrations." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!verifySameOrigin(request)) return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    const admin = await getSession();
    if (!admin || !isAdmin(admin)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const body = await request.json() as { userId?: unknown; status?: unknown; role?: unknown };
    if (typeof body.userId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.userId) || !["active", "suspended"].includes(String(body.status)) || (body.status === "active" && !["farmer", "buyer", "analyst"].includes(String(body.role)))) {
      return Response.json({ error: "Choose an account and a valid access status." }, { status: 400 });
    }
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ organization_id: string; account_status: string }>(
        "SELECT organization_id, account_status FROM users WHERE id = $1 FOR UPDATE", [body.userId],
      );
      if (!current.rows[0]) {
        await client.query("ROLLBACK");
        return Response.json({ error: "That account was not found." }, { status: 404 });
      }
      if (current.rows[0].account_status !== "pending") {
        await client.query("ROLLBACK");
        return Response.json({ error: "Only pending account requests can be changed from this queue." }, { status: 409 });
      }
      await client.query("UPDATE users SET account_status = $1 WHERE id = $2", [body.status, body.userId]);
      if (body.status === "active") {
        await client.query("DELETE FROM user_roles WHERE user_id = $1", [body.userId]);
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, organization_id, assigned_by)
           SELECT $1, id, $2, $3 FROM roles WHERE name = $4`,
          [body.userId, current.rows[0].organization_id, admin.id, body.role],
        );
      }
      await client.query(
        `INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action, before_state, after_state)
         VALUES ($1, 'user_account', $2, $3, jsonb_build_object('account_status', $4), jsonb_build_object('account_status', $5, 'role', $6))`,
        [admin.id, body.userId, body.status === "active" ? "account_approved" : "account_suspended", current.rows[0].account_status, body.status, body.status === "active" ? body.role : null],
      );
      await client.query("COMMIT");
      return Response.json({ ok: true, status: body.status });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  } catch {
    return Response.json({ error: "The account could not be updated. Check PostgreSQL and try again." }, { status: 503 });
  }
}
