import { revokeCurrentSession, verifySameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  try {
    await revokeCurrentSession();
  } catch {
    // The browser cookie is cleared even if PostgreSQL is offline; the stored session also expires on its own.
  }
  return Response.redirect(new URL("/login", request.url), 303);
}
