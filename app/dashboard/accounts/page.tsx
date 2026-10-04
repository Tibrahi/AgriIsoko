import { redirect } from "next/navigation";
import AdminQueue from "@/app/admin-queue";
import { getSession, isAdmin } from "@/lib/auth";

export default async function AccountRequestsPage() {
  const user = await getSession();
  if (!user || !isAdmin(user)) redirect("/dashboard");
  return <><div className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>Account requests</h1><p className="subtitle">Review new registrations before they can enter the workspace.</p></div></div><AdminQueue /></>;
}
