import { getMarketplaceData } from "@/lib/agri-data";
import { getSession } from "@/lib/auth";
import MarketplaceRequest from "@/app/marketplace-request";
import Link from "next/link";
import MyRecordsManager from "@/app/my-records-manager";
import AdminDataManager from "@/app/admin-data-manager";
import { isAdmin } from "@/lib/auth";

export default async function MarketplaceRoute() {
  const data = await getMarketplaceData();
  const user = await getSession();
  const canOrder = Boolean(user?.roles.includes("buyer"));
  const canManage = Boolean(user && isAdmin(user));
  return <>
    <div className="page-heading"><div><p className="eyebrow">VERIFIED PRODUCE LISTINGS</p><h1>Marketplace</h1><p className="subtitle">Browse approved produce, publish listings, send purchase requests, and track seller responses.</p></div>{canManage&&<Link className="primary-button" href="/dashboard/data?entity=marketplace_listings">Add / manage listings <span>→</span></Link>}</div>
    {user?.roles.includes("farmer")&&!canManage&&<MyRecordsManager roles={user.roles} initialKind="marketplace_listings" onlyKind/>}
    {canManage&&<AdminDataManager initialEntity="marketplace_listings"/>}
    {data.status === "unavailable" && <div className="status-banner"><span className="status-symbol">!</span><div><strong>Marketplace data is unavailable</strong><p>{data.message}</p></div></div>}
    {data.status === "connected" && data.listings.length === 0 ? <section className="panel glass-panel marketplace-empty"><div className="market-symbol">⌕</div><h2>No verified listings yet</h2><p>Approved seller listings will appear here when available. Farmers can add listings through their records workspace.</p>{user?.roles.includes("farmer") && <Link className="text-link" href="/dashboard/my-records">Add your first listing →</Link>}</section> : <div className="listing-grid">{data.listings.map((l)=><article className="listing-card glass-panel" key={l.id}><div className="listing-card-top"><span className="listing-crop-icon">{l.crop.slice(0,1).toUpperCase()}</span><span className="verified-chip">✓ Verified</span></div><h2>{l.crop}</h2><p className="listing-seller">{l.seller}</p><div className="listing-meta"><span>⌖ {l.district}</span><span>◷ {l.availableFrom ? `From ${l.availableFrom}` : "Available now"}</span></div><div className="listing-bottom"><div><small>Available quantity</small><strong>{fmt(l.quantity)} {l.unit}</strong></div><div className="listing-price"><small>Asking price</small><strong>{l.price === null ? "By agreement" : `${l.currency} ${fmt(l.price)} / ${l.unit}`}</strong></div></div>{canOrder && <MarketplaceRequest listingId={l.id} price={l.price} maximum={l.quantity}/>}</article>)}</div>}
    <p className="route-note">Listings are verified AgriIsoko records. Purchase requests are saved to the database and handled by the seller. <Link href="/dashboard/my-records">View your marketplace activity →</Link></p>
  </>;
}
function fmt(value:number){return new Intl.NumberFormat("en-RW",{maximumFractionDigits:1}).format(value);}
