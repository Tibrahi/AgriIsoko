import Link from "next/link";
import AuthForm from "@/app/auth-form";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  return <main className="auth-page"><div className="auth-decoration deco-one"/><div className="auth-decoration deco-two"/>
    <section className="auth-card glass-panel">
      <Link className="brand auth-brand" href="/" aria-label="AgriIsoko"><span className="brand-mark">A<span>+</span></span><span><strong>AgriIsoko</strong><small>RWANDA FOOD INTELLIGENCE</small></span></Link>
      <p className="eyebrow">SECURE WORKSPACE</p><h1>{register ? "Join AgriIsoko" : "Welcome back"}</h1>
      <p className="auth-intro">{register ? "Create a farmer or buyer account. An administrator will review your request before access is enabled." : "Sign in to view the records and tools available to your account."}</p>
      {!process.env.DATABASE_URL && <p className="auth-message error" role="status">PostgreSQL is not configured yet. Add DATABASE_URL and apply the database migrations before registering or signing in.</p>}
      <AuthForm mode={mode}/>
      <p className="auth-switch">{register ? "Already have an account?" : "New to AgriIsoko?"} <Link href={register ? "/login" : "/register"}>{register ? "Sign in" : "Request an account"}</Link></p>
      <div className="auth-trust"><span>⌑</span> Protected accounts · Role-based access · Verified records</div>
    </section>
    <p className="auth-foot">AgriIsoko <i>•</i> Rwanda agricultural marketplace &amp; food intelligence</p>
  </main>;
}
