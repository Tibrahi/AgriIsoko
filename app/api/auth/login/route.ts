import { getPool } from "@/lib/agri-data";
import { createSession, normalizeEmail, verifyPassword, verifySameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  let body: { email?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Enter your email and password." }, { status: 400 }); }
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || password.length === 0 || password.length > 256) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  try {
    const result = await getPool().query<{ id: string; password_salt: string | null; password_hash: string | null; account_status: string }>(
      "SELECT id, password_salt, password_hash, account_status FROM users WHERE lower(email) = $1 LIMIT 1", [email],
    );
    const account = result.rows[0];
    const valid = account?.password_salt && account.password_hash
      ? await verifyPassword(password, account.password_salt, account.password_hash)
      : await verifyPassword(password, "agriisoko-login-dummy-salt", "0".repeat(128));
    if (!account || !valid || account.account_status === "suspended") return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    await createSession(account.id);
    return Response.json({ ok: true, status: account.account_status });
  } catch {
    return Response.json({ error: "Sign-in is unavailable. Check that PostgreSQL and the AgriIsoko migrations are ready." }, { status: 503 });
  }
}
