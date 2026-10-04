import { getDashboardData } from "@/lib/agri-data";

const navItems = ["Overview", "Marketplace", "Harvest reports", "Availability", "Analytics"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-RW", { maximumFractionDigits: 1 }).format(value);
}

export default async function Home() {
  const data = await getDashboardData();

  return (
    <main className="app-shell">
      <aside className="sidebar glass-panel">
        <a className="brand" href="#overview" aria-label="AgriIsoko home">
          <span className="brand-mark">A<span>+</span></span>
          <span><strong>AgriIsoko</strong><small>RWANDA FOOD INTELLIGENCE</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map((item, index) => (
            <a className={`nav-link ${index === 0 ? "active" : ""}`} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>
              <span className="nav-icon">{["⌂", "◇", "◷", "▤", "⌁"][index]}</span>{item}
              {item === "Harvest reports" && data.pendingReports > 0 && <span className="nav-count">{data.pendingReports}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-spark">✳</span><strong>Built for the field</strong><p>Clear records. Better connections. Stronger food systems.</p></div>
          <div className="profile"><div className="avatar">AI</div><div><strong>AgriIsoko</strong><small>Workspace</small></div><span className="profile-menu">•••</span></div>
        </div>
      </aside>

      <section className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>Overview</strong></div>
          <div className="top-actions"><span className={`connection ${data.status === "connected" ? "online" : "offline"}`}><i />{data.status === "connected" ? "Database connected" : "Database unavailable"}</span><button className="icon-button" aria-label="Notifications">♧<b /></button><div className="avatar user-avatar">AI</div></div>
        </header>

        <div className="page-heading">
          <div><p className="eyebrow">RWANDA • AGRICULTURE INTELLIGENCE</p><h1>Good morning<span>,</span> let’s grow.</h1><p className="subtitle">A clear view of the harvest, supply, and trade records in your workspace.</p></div>
          <a className="primary-button" href="#harvest-reports"><span>＋</span> Submit a report</a>
        </div>

        {data.status !== "connected" && <div className="status-banner" role="status"><span className="status-symbol">!</span><div><strong>Live data is not connected</strong><p>{data.message} Dashboard indicators will appear when PostgreSQL is configured and the schema is installed.</p></div><a href="#setup">Connection details <span>↗</span></a></div>}

        <section className="metrics-grid" aria-label="Agriculture indicators">
          <Metric label="Verified harvest" value={data.status === "connected" ? `${formatNumber(data.harvestTonnes)} t` : "—"} note={data.status === "connected" ? `${data.harvestReports} verified reports` : "Awaiting live records"} icon="↗" tone="green" />
          <Metric label="Available produce" value={data.status === "connected" ? `${formatNumber(data.availableTonnes)} t` : "—"} note={data.status === "connected" ? "Verified stock ledger" : "No stock data loaded"} icon="▤" tone="blue" />
          <Metric label="Open listings" value={data.status === "connected" ? String(data.openListings) : "—"} note={data.status === "connected" ? "Current marketplace records" : "Awaiting live records"} icon="◇" tone="amber" />
          <Metric label="To verify" value={data.status === "connected" ? String(data.pendingReports) : "—"} note={data.status === "connected" ? "Submitted reports" : "Verification queue"} icon="◷" tone="violet" />
        </section>

        <section className="content-grid">
          <div className="panel glass-panel activity-panel" id="availability">
            <div className="panel-header"><div><p className="eyebrow">LIVE RECORDS</p><h2>Recent harvest reports</h2></div><a href="#harvest-reports" className="text-link">View all <span>→</span></a></div>
            {data.status !== "connected" ? <EmptyState title="No records to show" description="Reports will appear here after PostgreSQL is connected and verified harvest records are submitted." /> : data.recentReports.length === 0 ? <EmptyState title="No harvest reports yet" description="When producers submit real harvest information, it will be listed here with its verification status." /> : <div className="table-wrap"><table><thead><tr><th>PRODUCE</th><th>LOCATION</th><th>QUANTITY</th><th>STATUS</th></tr></thead><tbody>{data.recentReports.map((report) => <tr key={report.id}><td><span className="crop-dot">{report.crop.slice(0, 1)}</span><strong>{report.crop}</strong><small>{report.reportDate}</small></td><td>{report.location}</td><td>{formatNumber(report.quantity)} {report.unit}</td><td><span className={`badge ${report.status}`}>{report.status}</span></td></tr>)}</tbody></table></div>}
            <div className="coverage-note"><span>ⓘ</span> Records shown reflect AgriIsoko submissions only, not national totals.</div>
          </div>

          <aside className="panel glass-panel insight-panel" id="marketplace">
            <div className="panel-header"><div><p className="eyebrow">MARKETPLACE</p><h2>Find the right connection</h2></div><span className="mini-icon">↗</span></div>
            <p className="panel-copy">Browse real produce listings and connect directly with verified sellers and buyers.</p>
            <div className="market-empty"><div className="market-orbit orbit-one"/><div className="market-orbit orbit-two"/><span className="market-symbol">⌕</span></div>
            {data.status === "connected" && data.openListings === 0 ? <p className="empty-line">No active listings in the database yet.</p> : data.status !== "connected" ? <p className="empty-line">Marketplace records will load from PostgreSQL.</p> : <p className="empty-line">{data.openListings} active listings available.</p>}
            <a href="#listings" className="secondary-button">Explore marketplace <span>→</span></a>
          </aside>
        </section>

        <section className="bottom-grid">
          <div className="panel glass-panel focus-panel" id="harvest-reports">
            <div className="focus-icon">✳</div><div><p className="eyebrow">DATA COVERAGE</p><h2>Build a clearer picture, one report at a time.</h2><p>Every submitted report keeps its source, date, location, and verification history. Coverage grows as more local partners participate.</p><a href="#reporting" className="text-link">How reporting works <span>→</span></a></div>
            <div className="focus-watermark">✳</div>
          </div>
          <div className="panel glass-panel season-panel">
            <div className="panel-header"><div><p className="eyebrow">DATA PRINCIPLES</p><h2>Trust starts with context</h2></div></div>
            <div className="principle-row"><span className="principle-icon">✓</span><div><strong>Source is visible</strong><small>Know who submitted each record.</small></div></div>
            <div className="principle-row"><span className="principle-icon">◷</span><div><strong>Verification is clear</strong><small>Submitted and verified data stay distinct.</small></div></div>
            <div className="principle-row"><span className="principle-icon">⌖</span><div><strong>Coverage is stated</strong><small>Records are not presented as national totals.</small></div></div>
          </div>
        </section>
        <footer className="footer" id="setup"><span>AgriIsoko <i>•</i> Rwanda Agricultural Marketplace & Food Intelligence</span><span>All indicators come from configured PostgreSQL records</span></footer>
      </section>
    </main>
  );
}

function Metric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: string; tone: string }) {
  return <article className="metric-card glass-panel"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note"><span>{note}</span></div></article>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-icon">⌑</span><strong>{title}</strong><p>{description}</p></div>;
}
