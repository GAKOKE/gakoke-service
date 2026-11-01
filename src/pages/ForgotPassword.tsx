import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const redirectTo = `${window.location.origin}/login`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage(
      "Si un compte existe, un e-mail de réinitialisation a été envoyé (Inbucket en local).",
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand-mark">
          Gako<span>ke</span>
        </Link>
      </header>
      <section className="hero rise">
        <h1>Mot de passe oublié</h1>
        <p className="lede">Recevez un lien de réinitialisation.</p>
      </section>
      <form className="panel stack rise delay" onSubmit={onSubmit}>
        <label className="field">
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Envoi…" : "Envoyer le lien"}
        </button>
        <p className="muted" style={{ textAlign: "center" }}>
          <Link to="/login">Retour connexion</Link>
        </p>
      </form>
    </div>
  );
}
