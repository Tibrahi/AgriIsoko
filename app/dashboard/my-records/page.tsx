import { redirect } from "next/navigation";
import MyRecordsManager from "@/app/my-records-manager";
import { getSession } from "@/lib/auth";

export default async function MyRecordsPage() {
  const user = await getSession();
  if (!user || user.status !== "active" || !user.roles.some((role) => role === "farmer" || role === "buyer")) redirect("/dashboard");
  return <><div className="page-heading"><div><p className="eyebrow">PRIVATE USER WORKSPACE</p><h1>My records</h1><p className="subtitle">Add records for your organization and follow each review or order update.</p></div></div><MyRecordsManager roles={user.roles}/></>;
}
