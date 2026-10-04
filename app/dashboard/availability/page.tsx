import { getAvailability } from "@/lib/dashboard-data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import MyRecordsManager from "@/app/my-records-manager";
import AdminDataManager from "@/app/admin-data-manager";
import PageControls from "@/app/page-controls";

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const user = await getSession();
  if (!user?.roles.some((role) => role === "national_admin" || role === "analyst" || role === "farmer")) redirect("/dashboard/marketplace");
  const canManage = user.roles.includes("national_admin");
  const isFarmer = user.roles.includes("farmer") && !canManage;
  const result = await getAvailability(requestedPage);
  const tonnes = result.available ? result.rows.reduce((sum, r) => sum + Number(r.quantity), 0) / 1000 : 0;
  return <>
    <div className="page-heading"><div><p className="eyebrow">VERIFIED STOCK LEDGER</p><h1>Availability</h1><p className="subtitle">Enter stock availability, follow your submissions, and review verified produce by crop and district.</p></div>{canManage&&<Link className="primary-button" href="/dashboard/data?entity=inventory_balances">Add / manage stock <span>→</span></Link>}</div>
    {isFarmer&&<MyRecordsManager roles={user.roles} initialKind="inventory_balances" onlyKind/>}
    {canManage&&<AdminDataManager initialEntity="inventory_balances"/>}
    {!result.available && <div className="status-banner"><span className="status-symbol">!</span><div><strong>Availability could not be loaded</strong><p>{result.message}</p></div></div>}
    <section className="metrics-grid availability-summary"><article className="metric-card glass-panel"><div className="metric-icon blue">▤</div><div className="metric-label">Verified available stock</div><div className="metric-value">{result.available ? `${new Intl.NumberFormat("en-RW",{maximumFractionDigits:1}).format(tonnes)} t` : "—"}</div><div className="metric-note"><span>Current page subtotal of verified ledger rows</span></div></article><article className="metric-card glass-panel"><div className="metric-label">Verified stock records</div><div className="metric-value">{result.available ? result.total.toLocaleString() : "—"}</div><div className="metric-note"><span>All matching database records</span></div></article></section>
    <section className="panel glass-panel route-panel"><div className="panel-header"><div><p className="eyebrow">CURRENT STOCK</p><h2>Available produce by location</h2></div></div>
      {!result.available || result.rows.length === 0 ? <div className="empty-state"><span className="empty-icon">▤</span><strong>No verified stock yet</strong><p>{result.available ? "Verified inventory submissions will appear here." : "Connect the configured database to see verified inventory."}</p></div> : <><div className="table-wrap"><table><thead><tr><th>CROP</th><th>DISTRICT</th><th>AVAILABLE</th><th>AS OF</th><th>SOURCE</th></tr></thead><tbody>{result.rows.map((r)=><tr key={r.id}><td><strong>{r.crop}</strong></td><td>{r.district}</td><td>{new Intl.NumberFormat("en-RW",{maximumFractionDigits:1}).format(Number(r.quantity))} kg</td><td>{r.asOf}</td><td>{r.source}</td></tr>)}</tbody></table></div><PageControls page={result.page} pages={result.pages} href="/dashboard/availability"/><p className="route-note">Showing {result.rows.length} of {result.total.toLocaleString()} verified availability records.</p></>}
    </section><p className="route-note">Verified stock summaries update after an administrator reviews submissions.</p>
  </>;
}
