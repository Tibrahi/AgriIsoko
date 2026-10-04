"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const registering = mode === "register";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error ?? "Unable to continue. Please try again."); return; }
      if (registering) setSuccess("Your account is registered and waiting for administrator approval.");
      router.replace("/");
      router.refresh();
    } catch {
      setError("The service could not be reached. Check that the application and PostgreSQL are running.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    {registering && <label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Your name" /></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
    <label>Password<input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 12 : 1} maxLength={256} placeholder={registering ? "At least 12 characters" : "Your password"} /></label>
    {registering && <label>Account type<select name="role" defaultValue="farmer"><option value="farmer">Farmer / producer</option><option value="buyer">Buyer</option></select><small>Other staff roles are assigned by an administrator.</small></label>}
    {error && <p className="auth-message error" role="alert">{error}</p>}
    {success && <p className="auth-message success" role="status">{success}</p>}
    <button className="primary-button auth-submit" disabled={busy}>{busy ? "Please wait…" : registering ? "Request an account" : "Sign in"}<span>→</span></button>
  </form>;
}
