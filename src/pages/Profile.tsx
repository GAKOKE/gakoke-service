import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ phone, username })
      .eq("id", user.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshProfile();
    setMessage("Profil mis à jour.");
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setPassword("");
    setMessage("Mot de passe mis à jour.");
  }

  async function logout() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="rise stack">
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Profil</h1>
        <p className="lede">{user?.email}</p>
      </section>

      <form className="panel stack" onSubmit={saveProfile}>
        <label className="field">
          Nom d’utilisateur
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          Téléphone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          Enregistrer
        </button>
      </form>

      <form className="panel stack" onSubmit={changePassword}>
        <label className="field">
          Nouveau mot de passe
          <input
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn btn-ghost btn-block" disabled={busy}>
          Changer le mot de passe
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="panel stack">
        <Link to="/legal/cgu">Conditions d’utilisation</Link>
        <Link to="/legal/privacy">Politique de confidentialité</Link>
        {profile?.role === "admin" && <Link to="/admin">Espace ops</Link>}
        <button type="button" className="btn btn-danger btn-block" onClick={logout}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
