import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import DashboardNavigation from "@/app/dashboard/navigation";
import { getDatabaseStatus } from "@/lib/agri-data";
import BrandMark from "@/app/brand-mark";
import DashboardBreadcrumbs from "@/app/dashboard/breadcrumbs";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let user;
  try { user = await getSession(); } catch { redirect("/login"); }
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/");
  const canSeeAnalytics = user.roles.includes("national_admin") || user.roles.includes("analyst");
  const canSubmitOwnRecords = user.roles.some((role) => ["farmer", "buyer"].includes(role));
  const database = await getDatabaseStatus();

  return <main className="app-shell">
    <aside className="sidebar glass-panel dashboard-sidebar">
      <Link className="brand" href="/dashboard"><BrandMark/><span><strong>AgriIsoko</strong><small>RWANDA FOOD INTELLIGENCE</small></span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <DashboardNavigation admin={isAdmin(user)} items={[
        ["/dashboard", "Overview", "⌂"],
        ...(canSubmitOwnRecords ? [["/dashboard/my-records", "My records", "▣"] as const] : []),
        ["/dashboard/marketplace", "Marketplace", "◇"],
        ...(canSeeAnalytics ? [
          ["/dashboard/harvest-reports", "Harvest reports", "◷"] as const,
          ["/dashboard/availability", "Availability", "▤"] as const,
          ["/dashboard/analytics", "Analytics", "⌁"] as const,
        ] : []),
      ]} />
      <div className="sidebar-bottom"><div className="profile"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.roles.join(" · ").replaceAll("_", " ")}</small></div></div></div>
    </aside>
    <section className="main-content dashboard-content">
      <header className="topbar"><DashboardBreadcrumbs/><div className="top-actions"><span className={`connection ${database.status === "connected" ? "online" : "offline"}`} title={database.message}><i/>{database.status === "connected" ? "Database connected" : "Database needs attention"}</span><form action="/api/auth/logout" method="post"><button className="signout-button">Sign out</button></form><div className="avatar user-avatar">{user.name.slice(0,1).toUpperCase()}</div></div></header>
      {database.status === "unavailable" && <div className="status-banner" role="status"><span className="status-symbol">!</span><div><strong>Database access needs attention</strong><p>{database.message}</p></div></div>}
      {children}
      <footer className="footer"><span>AgriIsoko <i>•</i> Rwanda Agricultural Marketplace &amp; Food Intelligence</span><span>Verified records only where stated</span></footer>
    </section>
  </main>;
}
