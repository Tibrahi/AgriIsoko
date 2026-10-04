import { revokeCurrentSession, verifySameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    await revokeCurrentSession();
    return Response.redirect(new URL("/login", request.url), 303);
  } catch {
    return Response.json({ error: "Sign-out could not reach the session store." }, { status: 503 });
  }
}
