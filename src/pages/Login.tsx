import type { FormEvent } from "react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate("/app");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand-mark">
          Gako<span>ke</span>
        </Link>
      </header>
      <section className="hero rise">
        <h1>Connexion</h1>
        <p className="lede">Accédez à vos dépôts et retraits.</p>
      </section>
      <form className="panel stack rise delay" onSubmit={onSubmit}>
        <label className="field">
          E-mail
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          Mot de passe
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
        <p className="muted" style={{ textAlign: "center" }}>
          <Link to="/forgot">Mot de passe oublié</Link>
          {" · "}
          <Link to="/register">Créer un compte</Link>
        </p>
      </form>
    </div>
  );
}
