"use client";

import { useEffect, useState } from "react";
import { useCallback } from "react";

type Account = { id: string; name: string; email: string; organization_type: string; created_at: string; status: "pending" | "rejected"; review_note: string | null };

export default function AdminQueue() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/accounts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load account requests.");
      setAccounts(data.accounts);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load account requests."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/accounts", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) throw new Error(data.error ?? "Could not load account requests.");
        setAccounts(data.accounts);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load account requests."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function update(userId: string, status: "active" | "rejected") {
    setError("");
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, status, reviewNote: reasons[userId] ?? "", role: assignments[userId] ?? "farmer" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update account.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update account."); }
  }

  return <section className="panel glass-panel admin-panel">
    <div className="panel-header"><div><p className="eyebrow">ACCESS MANAGEMENT</p><h2>Account requests</h2></div><button className="refresh-button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></div>
    <p className="panel-copy">Approve access, reject with a note, or reconsider a rejected application. Applicants can sign in to see their decision.</p>
    {error && <p className="auth-message error" role="alert">{error}</p>}
    {loading ? <p className="admin-empty">Loading requests…</p> : accounts.length === 0 ? <p className="admin-empty">No account requests are waiting for review.</p> : <div className="account-list">{accounts.map((account) => <article className="account-row" key={account.id}>
      <div className="avatar account-avatar">{account.name.slice(0, 1).toUpperCase()}</div><div className="account-detail"><strong>{account.name} <span className={`badge ${account.status}`}>{account.status}</span></strong><small>{account.email} · {account.organization_type.replaceAll("_", " ")}</small>{account.review_note&&<small>Previous note: {account.review_note}</small>}</div>
      <select className="role-select" value={assignments[account.id] ?? (account.organization_type === "buyer" ? "buyer" : "farmer")} onChange={(event) => setAssignments((current) => ({ ...current, [account.id]: event.target.value }))} aria-label={`Assign role to ${account.name}`}><option value="farmer">Farmer</option><option value="buyer">Buyer</option><option value="analyst">Analyst</option></select>
      {account.status === "pending" && <textarea className="account-review-note" maxLength={500} placeholder="Optional note for a rejected request" value={reasons[account.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [account.id]: event.target.value }))} aria-label={`Review note for ${account.name}`} />}
      <button className="approve-button" onClick={() => void update(account.id, "active")}>{account.status === "rejected" ? "Reconsider" : "Approve"}</button>
      {account.status === "pending" && <button className="reject-button" onClick={() => void update(account.id, "rejected")}>Reject</button>}
    </article>)}</div>}
  </section>;
}
