import { getHarvestReports } from "@/lib/dashboard-data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import MyRecordsManager from "@/app/my-records-manager";
import AdminDataManager from "@/app/admin-data-manager";

export default async function HarvestReportsPage() {
  const user = await getSession();
  if (!user?.roles.some((role) => role === "national_admin" || role === "analyst" || role === "farmer")) redirect("/dashboard/marketplace");
  const canManage = user.roles.includes("national_admin");
  const isFarmer = user.roles.includes("farmer") && !canManage;
  const result = isFarmer ? null : await getHarvestReports();
  return <>
    <div className="page-heading"><div><p className="eyebrow">PRODUCTION RECORDS</p><h1>Harvest reports</h1><p className="subtitle">Submit new harvest information, update your submissions, or review records and their status.</p></div>{canManage&&<Link className="primary-button" href="/dashboard/data?entity=harvest_reports">Add / manage reports <span>→</span></Link>}</div>
    {isFarmer ? <MyRecordsManager roles={user.roles} initialKind="harvest_reports" onlyKind/> : <>{canManage&&<AdminDataManager initialEntity="harvest_reports"/>}<section className="panel glass-panel route-panel"><div className="panel-header"><div><p className="eyebrow">LATEST SUBMISSIONS</p><h2>{result!.available ? `${result!.rows.length} recent reports` : "Harvest records"}</h2></div><span className="coverage-note">Up to 100 records</span></div>
      {!result!.available && <div className="status-banner"><span className="status-symbol">!</span><div><strong>Reports could not be loaded</strong><p>{result!.message}</p></div></div>}
      {!result!.available || result!.rows.length === 0 ? <EmptyState copy={result!.available ? "No harvest reports have been submitted yet." : "Connect the configured database to see reports."}/> : <div className="table-wrap"><table><thead><tr><th>CROP</th><th>DISTRICT</th><th>REPORT TYPE</th><th>QUANTITY</th><th>DATE</th><th>STATUS</th><th>SOURCE</th></tr></thead><tbody>{result!.rows.map((r)=><tr key={r.id}><td><strong>{r.crop}</strong></td><td>{r.district}</td><td className="capitalize">{r.type}</td><td>{fmt(r.quantity)} kg</td><td>{r.date}</td><td><span className={`badge ${r.status}`}>{r.status}</span></td><td>{r.source}</td></tr>)}</tbody></table></div>}
    </section></>}
  </>;
}
function fmt(s:string){return new Intl.NumberFormat("en-RW",{maximumFractionDigits:1}).format(Number(s));}
function EmptyState({copy}:{copy:string}){return <div className="empty-state"><span className="empty-icon">◷</span><strong>No report rows</strong><p>{copy}</p></div>;}
