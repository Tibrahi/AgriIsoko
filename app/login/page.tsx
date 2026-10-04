import { redirect } from "next/navigation";
import AuthPage from "@/app/auth-page";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export default async function LoginPage() {
  let hasSession = false;
  try { hasSession = Boolean(await getSession()); } catch { /* The sign-in page remains available while the database is being configured. */ }
  if (hasSession) redirect("/");
  return <AuthPage mode="login" />;
}
