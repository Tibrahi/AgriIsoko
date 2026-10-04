import { redirect } from "next/navigation";
import AdminDataManager from "@/app/admin-data-manager";
import { getSession, isAdmin } from "@/lib/auth";

export default async function DataManagementPage() {
  const user = await getSession();
  if (!user || !isAdmin(user)) redirect("/dashboard");
  return <><div className="page-heading"><div><p className="eyebrow">ADMINISTRATOR WORKSPACE</p><h1>Manage agriculture data</h1><p className="subtitle">Create, review, update, and remove records stored in Neon PostgreSQL.</p></div></div><AdminDataManager /></>;
}
