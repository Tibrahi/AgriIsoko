import { getAvailability } from "@/lib/dashboard-data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AvailabilityPage() {
  const user = await getSession();
  if (!user?.roles.some((role) => role === "national_admin" || role === "analyst")) redirect("/dashboard/marketplace");
  const result = await getAvailability();
  const tonnes = result.available ? result.rows.reduce((sum, r) => sum + Number(r.quantity), 0) / 1000 : 0;
  return <>
    <div className="page-heading"><div><p className="eyebrow">VERIFIED STOCK LEDGER</p><h1>Availability</h1><p className="subtitle">Produce quantities reported as available, grouped by crop and district.</p></div></div>
    {!result.available && <div className="status-banner"><span className="status-symbol">!</span><div><strong>Availability could not be loaded</strong><p>{result.message}</p></div></div>}
    <section className="metrics-grid availability-summary"><article className="metric-card glass-panel"><div className="metric-icon blue">▤</div><div className="metric-label">Verified available stock</div><div className="metric-value">{result.available ? `${new Intl.NumberFormat("en-RW",{maximumFractionDigits:1}).format(tonnes)} t` : "—"}</div><div className="metric-note"><span>Based on current verified ledger rows</span></div></article><article className="metric-card glass-panel"><div className="metric-icon green">⌖</div><div className="metric-label">Stock records</div><div className="metric-value">{result.available ? result.rows.length : "—"}</div><div className="metric-note"><span>Up to 100 latest records</span></div></article></section>
    <section className="panel glass-panel route-panel"><div className="panel-header"><div><p className="eyebrow">CURRENT STOCK</p><h2>Available produce by location</h2></div></div>
      {!result.available || result.rows.length === 0 ? <div className="empty-state"><span className="empty-icon">▤</span><strong>No verified stock yet</strong><p>{result.available ? "Verified inventory submissions will appear here." : "Connect the configured database to see verified inventory."}</p></div> : <div className="table-wrap"><table><thead><tr><th>CROP</th><th>DISTRICT</th><th>AVAILABLE</th><th>AS OF</th><th>SOURCE</th></tr></thead><tbody>{result.rows.map((r)=><tr key={r.id}><td><strong>{r.crop}</strong></td><td>{r.district}</td><td>{new Intl.NumberFormat("en-RW",{maximumFractionDigits:1}).format(Number(r.quantity))} kg</td><td>{r.asOf}</td><td>{r.source}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
