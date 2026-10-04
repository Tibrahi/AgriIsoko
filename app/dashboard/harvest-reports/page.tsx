import { getHarvestReports } from "@/lib/dashboard-data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HarvestReportsPage() {
  const user = await getSession();
  if (!user?.roles.some((role) => role === "national_admin" || role === "analyst")) redirect("/dashboard/marketplace");
  const result = await getHarvestReports();
  return <>
    <div className="page-heading"><div><p className="eyebrow">PRODUCTION RECORDS</p><h1>Harvest reports</h1><p className="subtitle">Submitted harvest information, with review status and source context.</p></div></div>
    {!result.available && <div className="status-banner"><span className="status-symbol">!</span><div><strong>Reports could not be loaded</strong><p>{result.message}</p></div></div>}
    <section className="panel glass-panel route-panel"><div className="panel-header"><div><p className="eyebrow">LATEST SUBMISSIONS</p><h2>{result.available ? `${result.rows.length} recent reports` : "Harvest records"}</h2></div><span className="coverage-note">Up to 100 records</span></div>
      {!result.available || result.rows.length === 0 ? <EmptyState copy={result.available ? "No harvest reports have been submitted yet." : "Connect the configured database to see reports."}/> : <div className="table-wrap"><table><thead><tr><th>CROP</th><th>DISTRICT</th><th>REPORT TYPE</th><th>QUANTITY</th><th>DATE</th><th>STATUS</th><th>SOURCE</th></tr></thead><tbody>{result.rows.map((r)=><tr key={r.id}><td><strong>{r.crop}</strong></td><td>{r.district}</td><td className="capitalize">{r.type}</td><td>{fmt(r.quantity)} kg</td><td>{r.date}</td><td><span className={`badge ${r.status}`}>{r.status}</span></td><td>{r.source}</td></tr>)}</tbody></table></div>}
    </section><p className="route-note">Harvest reporting forms are not yet enabled. This page shows database submissions only; no records are invented.</p>
  </>;
}
function fmt(s:string){return new Intl.NumberFormat("en-RW",{maximumFractionDigits:1}).format(Number(s));}
function EmptyState({copy}:{copy:string}){return <div className="empty-state"><span className="empty-icon">◷</span><strong>No report rows</strong><p>{copy}</p></div>;}
