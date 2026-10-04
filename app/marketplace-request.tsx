"use client";

import { useState } from "react";

export default function MarketplaceRequest({ listingId, price, maximum }: { listingId: string; price: number | null; maximum: number }) {
  const [quantity, setQuantity] = useState("");
  const [offer, setOffer] = useState(price === null ? "" : String(price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/user/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "marketplace_orders", values: { listing_id: listingId, quantity, agreed_price_per_unit: offer } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Your purchase request could not be sent.");
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your purchase request could not be sent."); }
    finally { setSaving(false); }
  }

  return <form className="listing-request" onSubmit={submit}>
    {sent ? <p className="request-success" role="status">Request sent. Track it in <a href="/dashboard/my-records">My records</a>.</p> : <>
      <label>Quantity<input aria-label="Request quantity" type="number" min="0.01" max={maximum} step="any" required value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
      <label>Offer / unit<input aria-label="Offer price per unit" type="number" min="0" step="any" value={offer} onChange={event => setOffer(event.target.value)} placeholder="Optional" /></label>
      <button className="primary-button" disabled={saving}>{saving ? "Sending…" : "Request produce"}</button>
      {error && <p className="auth-message error" role="alert">{error}</p>}
    </>}
  </form>;
}
