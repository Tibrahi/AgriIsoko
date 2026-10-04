import { getAnalytics } from "@/lib/dashboard-data";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const user = await getSession();
  if (!user?.roles.some((role) => role === "national_admin" || role === "analyst")) redirect("/dashboard/marketplace");
  const [crops, districts] = await getAnalytics();
  const total = crops.available ? crops.rows.reduce((sum,r)=>sum+Number(r.tonnes),0) : 0;
  return <>
    <div className="page-heading"><div><p className="eyebrow">VERIFIED DATA ONLY</p><h1>Analytics</h1><p className="subtitle">Harvest summaries from verified AgriIsoko actual-harvest records.</p></div></div>
    {(!crops.available || !districts.available) && <div className="status-banner"><span className="status-symbol">!</span><div><strong>Analytics are unavailable</strong><p>{!crops.available ? crops.message : !districts.available ? districts.message : "Reconnect the database."}</p></div></div>}
    <section className="metrics-grid availability-summary"><article className="metric-card glass-panel"><div className="metric-icon green">↗</div><div className="metric-label">Verified harvest recorded</div><div className="metric-value">{crops.available ? `${new Intl.NumberFormat("en-RW",{maximumFractionDigits:1}).format(total)} t` : "—"}</div><div className="metric-note"><span>Actual harvest reports only</span></div></article><article className="metric-card glass-panel"><div className="metric-icon amber">⌖</div><div className="metric-label">Districts represented</div><div className="metric-value">{districts.available ? districts.rows.length : "—"}</div><div className="metric-note"><span>Districts with verified reports</span></div></article></section>
    <section className="analytics-grid"><AnalyticsTable title="Harvest by crop" eyebrow="CROP SUMMARY" empty="Verified actual harvest records will appear here." rows={crops.available ? crops.rows.map(r=>({label:r.crop,value:`${r.tonnes} t`,detail:`${r.reports} reports`})) : []}/><AnalyticsTable title="Harvest by district" eyebrow="GEOGRAPHIC COVERAGE" empty="Verified location summaries will appear here." rows={districts.available ? districts.rows.map(r=>({label:r.district,value:`${r.tonnes} t`,detail:`${r.reports} reports`})) : []}/></section>
    <p className="route-note">These summaries cover records held in AgriIsoko only. They are not national production estimates.</p>
  </>;
}
function AnalyticsTable({title,eyebrow,empty,rows}:{title:string;eyebrow:string;empty:string;rows:{label:string;value:string;detail:string}[]}){return <section className="panel glass-panel route-panel"><div className="panel-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>{rows.length===0?<div className="empty-state"><span className="empty-icon">⌁</span><strong>Nothing to summarize yet</strong><p>{empty}</p></div>:<div className="analytics-list">{rows.map((r,i)=><div className="analytics-row" key={r.label}><span className="analytics-rank">{String(i+1).padStart(2,"0")}</span><div className="analytics-label"><strong>{r.label}</strong><small>{r.detail}</small></div><strong className="analytics-value">{r.value}</strong></div>)}</div>}</section>;}
