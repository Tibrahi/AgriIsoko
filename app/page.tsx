import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  let user;
  try { user = await getSession(); } catch { redirect("/login"); }
  if (!user) redirect("/login");
  const hasWorkspace = user.roles.some((role) => ["national_admin", "analyst", "farmer", "buyer"].includes(role));
  if (user.status === "active" && hasWorkspace) redirect("/dashboard");
  const title = user.status === "pending" ? "Your account is waiting for approval" : user.status === "rejected" ? "Your access request was declined" : user.status === "suspended" ? "This account is suspended" : "Your workspace is being prepared";
  const copy = user.status === "pending" ? "An AgriIsoko administrator must approve your account before you can enter the workspace. You can sign out and return later." : user.status === "rejected" ? `Your request was reviewed and declined.${user.reviewNote ? ` Administrator note: ${user.reviewNote}` : " Contact the AgriIsoko administrator if you need clarification."}` : user.status === "suspended" ? "Workspace access has been paused. Contact your AgriIsoko administrator if you think this is a mistake." : `You are signed in as ${user.roles.map((role) => role.replaceAll("_", " ")).join(", ") || "a user"}. Your role-specific workspace is being prepared.`;
  return <main className="auth-page"><section className="auth-card glass-panel access-card"><Link className="brand auth-brand" href="/login"><span className="brand-mark">A<span>+</span></span><span><strong>AgriIsoko</strong><small>RWANDA FOOD INTELLIGENCE</small></span></Link><div className="access-mark">⌑</div><p className="eyebrow">ACCOUNT ACCESS</p><h1>{title}</h1><p className="auth-intro">{copy}</p><div className="signed-user"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><span><strong>{user.name}</strong><small>Signed in</small></span><form action="/api/auth/logout" method="post"><button className="signout-button">Sign out</button></form></div></section><p className="auth-foot">AgriIsoko <i>•</i> Rwanda agricultural marketplace &amp; food intelligence</p></main>;
}
