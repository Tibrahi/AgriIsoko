import Link from "next/link";
import { getDashboardData } from "@/lib/agri-data";
import { getSession, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminQueue from "@/app/admin-queue";

const number = (value: number) => new Intl.NumberFormat("en-RW", { maximumFractionDigits: 1 }).format(value);

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) return null;
  if (!user.roles.includes("national_admin") && !user.roles.includes("analyst")) redirect("/dashboard/marketplace");
  const data = await getDashboardData();
  return <>
    <div className="page-heading"><div><p className="eyebrow">RWANDA • AGRICULTURE INTELLIGENCE</p><h1>Good day, {user.name.split(" ")[0]}.</h1><p className="subtitle">A clear view of the harvest, supply, and trade records in your workspace.</p></div><Link className="primary-button" href="/dashboard/harvest-reports"><span>↗</span> Review harvest reports</Link></div>
    {data.status !== "connected" && <div className="status-banner" role="status"><span className="status-symbol">!</span><div><strong>Live data is not connected</strong><p>{data.message} Reconnect PostgreSQL to load workspace records.</p></div></div>}
    <section className="metrics-grid" aria-label="Agriculture indicators">
      <Metric label="Verified harvest" value={data.status === "connected" ? `${number(data.harvestTonnes)} t` : "—"} note={`${data.harvestReports} verified reports`} icon="↗" tone="green" />
      <Metric label="Available produce" value={data.status === "connected" ? `${number(data.availableTonnes)} t` : "—"} note="Verified stock ledger" icon="▤" tone="blue" />
      <Metric label="Open listings" value={data.status === "connected" ? String(data.openListings) : "—"} note="Current marketplace records" icon="◇" tone="amber" />
      <Metric label="To verify" value={data.status === "connected" ? String(data.pendingReports) : "—"} note="Submitted harvest reports" icon="◷" tone="violet" />
    </section>
    <section className="content-grid"><div className="panel glass-panel activity-panel"><div className="panel-header"><div><p className="eyebrow">LIVE RECORDS</p><h2>Recent harvest reports</h2></div><Link href="/dashboard/harvest-reports" className="text-link">View all <span>→</span></Link></div>
      {!data.recentReports.length ? <Empty title="No harvest records yet" copy="Real submissions will appear here with their location and verification status."/> : <div className="table-wrap"><table><thead><tr><th>PRODUCE</th><th>LOCATION</th><th>QUANTITY</th><th>STATUS</th></tr></thead><tbody>{data.recentReports.map((r) => <tr key={r.id}><td><span className="crop-dot">{r.crop.slice(0,1)}</span><strong>{r.crop}</strong><small>{r.reportDate}</small></td><td>{r.location}</td><td>{number(r.quantity)} {r.unit}</td><td><span className={`badge ${r.status}`}>{r.status}</span></td></tr>)}</tbody></table></div>}
      <div className="coverage-note">ⓘ Records shown reflect AgriIsoko submissions, not national totals.</div></div>
      <aside className="panel glass-panel insight-panel"><div className="panel-header"><div><p className="eyebrow">MARKETPLACE</p><h2>Find the right connection</h2></div><span className="mini-icon">↗</span></div><p className="panel-copy">Browse verified produce listings currently available from registered sellers.</p><div className="market-empty"><span className="market-symbol">⌕</span></div><p className="empty-line">{data.openListings} open verified listings</p><Link href="/dashboard/marketplace" className="secondary-button">Explore marketplace <span>→</span></Link></aside>
    </section>
    {isAdmin(user) && <div className="admin-queue-wrap"><AdminQueue /></div>}
  </>;
}

function Metric({label,value,note,icon,tone}:{label:string;value:string;note:string;icon:string;tone:string}) { return <article className="metric-card glass-panel"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note"><span>{note}</span></div></article>; }
function Empty({title,copy}:{title:string;copy:string}) { return <div className="empty-state"><span className="empty-icon">⌑</span><strong>{title}</strong><p>{copy}</p></div>; }
