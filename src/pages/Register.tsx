import type { FormEvent } from "react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function Register() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, phone },
      },
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
        <h1>Inscription</h1>
        <p className="lede">Créez votre compte cashdesk Gakoke.</p>
      </section>
      <form className="panel stack rise delay" onSubmit={onSubmit}>
        <label className="field">
          Nom d’utilisateur
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="field">
          Téléphone
          <input
            required
            placeholder="+228…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
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
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Création…" : "Créer mon compte"}
        </button>
        <p className="muted" style={{ textAlign: "center" }}>
          Déjà inscrit ? <Link to="/login">Connexion</Link>
        </p>
      </form>
    </div>
  );
}
