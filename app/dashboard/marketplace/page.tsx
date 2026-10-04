import { getMarketplaceData } from "@/lib/agri-data";

export default async function MarketplaceRoute() {
  const data = await getMarketplaceData();
  return <>
    <div className="page-heading"><div><p className="eyebrow">VERIFIED PRODUCE LISTINGS</p><h1>Marketplace</h1><p className="subtitle">Browse open listings approved by AgriIsoko reviewers. Confirm availability with the seller before arranging a purchase.</p></div></div>
    {data.status === "unavailable" && <div className="status-banner"><span className="status-symbol">!</span><div><strong>Marketplace data is unavailable</strong><p>{data.message}</p></div></div>}
    {data.status === "connected" && data.listings.length === 0 ? <section className="panel glass-panel marketplace-empty"><div className="market-symbol">⌕</div><h2>No verified listings yet</h2><p>Approved seller listings will appear here when available.</p></section> : <div className="listing-grid">{data.listings.map((l)=><article className="listing-card glass-panel" key={l.id}><div className="listing-card-top"><span className="listing-crop-icon">{l.crop.slice(0,1).toUpperCase()}</span><span className="verified-chip">✓ Verified</span></div><h2>{l.crop}</h2><p className="listing-seller">{l.seller}</p><div className="listing-meta"><span>⌖ {l.district}</span><span>◷ {l.availableFrom ? `From ${l.availableFrom}` : "Available now"}</span></div><div className="listing-bottom"><div><small>Available quantity</small><strong>{fmt(l.quantity)} {l.unit}</strong></div><div className="listing-price"><small>Asking price</small><strong>{l.price === null ? "By agreement" : `${l.currency} ${fmt(l.price)} / ${l.unit}`}</strong></div></div></article>)}</div>}
    <p className="route-note">Listings are verified AgriIsoko records. Ordering and payment workflows are not enabled yet.</p>
  </>;
}
function fmt(value:number){return new Intl.NumberFormat("en-RW",{maximumFractionDigits:1}).format(value);}
