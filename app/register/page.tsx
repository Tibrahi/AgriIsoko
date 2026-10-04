import { redirect } from "next/navigation";
import AuthPage from "@/app/auth-page";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export default async function RegisterPage() {
  let hasSession = false;
  try { hasSession = Boolean(await getSession()); } catch { /* Registration explains the database setup requirement. */ }
  if (hasSession) redirect("/");
  return <AuthPage mode="register" />;
}
