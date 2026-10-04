import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import DashboardNavigation from "@/app/dashboard/navigation";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let user;
  try { user = await getSession(); } catch { redirect("/login"); }
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/");
  const canSeeAnalytics = user.roles.includes("national_admin") || user.roles.includes("analyst");
  if (!canSeeAnalytics && !user.roles.some((role) => ["farmer", "buyer"].includes(role))) redirect("/");

  return <main className="app-shell">
    <aside className="sidebar glass-panel dashboard-sidebar">
      <Link className="brand" href="/dashboard"><span className="brand-mark">A<span>+</span></span><span><strong>AgriIsoko</strong><small>RWANDA FOOD INTELLIGENCE</small></span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <DashboardNavigation items={[
        ...(canSeeAnalytics ? [["/dashboard", "Overview", "⌂"] as const] : []),
        ["/dashboard/marketplace", "Marketplace", "◇"],
        ...(canSeeAnalytics ? [
          ["/dashboard/harvest-reports", "Harvest reports", "◷"] as const,
          ["/dashboard/availability", "Availability", "▤"] as const,
          ["/dashboard/analytics", "Analytics", "⌁"] as const,
        ] : []),
      ]} admin={isAdmin(user)} />
      <div className="sidebar-bottom"><div className="help-card"><span className="help-spark">✳</span><strong>Built for the field</strong><p>Clear records. Better connections. Stronger food systems.</p></div><div className="profile"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.roles.join(" · ").replaceAll("_", " ")}</small></div></div></div>
    </aside>
    <section className="main-content dashboard-content">
      <header className="topbar"><div className="breadcrumbs">AgriIsoko <span>/</span> <strong>Workspace</strong></div><div className="top-actions"><span className="connection online"><i/> Secure workspace</span><form action="/api/auth/logout" method="post"><button className="signout-button">Sign out</button></form><div className="avatar user-avatar">{user.name.slice(0,1).toUpperCase()}</div></div></header>
      {children}
      <footer className="footer"><span>AgriIsoko <i>•</i> Rwanda Agricultural Marketplace &amp; Food Intelligence</span><span>Verified records only where stated</span></footer>
    </section>
  </main>;
}
