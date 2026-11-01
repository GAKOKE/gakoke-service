import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Platform, PlayerAccount } from "../lib/types";
import { useAuth } from "../context/AuthContext";

export function PlayerIds() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<PlayerAccount[]>([]);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: plats }, { data: accs }] = await Promise.all([
      supabase.from("platforms").select("*").eq("active", true).maybeSingle(),
      supabase
        .from("player_accounts")
        .select("*, platforms(*)")
        .order("created_at", { ascending: false }),
    ]);
    setPlatform(plats);
    setAccounts((accs as PlayerAccount[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !platform) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("player_accounts").insert({
      user_id: user.id,
      platform_id: platform.id,
      player_id: playerId.trim(),
      label: label.trim() || null,
      verified: false,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setPlayerId("");
    setLabel("");
    await load();
  }

  async function remove(id: string) {
    await supabase.from("player_accounts").delete().eq("id", id);
    await load();
  }

  return (
    <div className="rise stack">
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Mes IDs</h1>
        <p className="lede">
          Plateforme active : {platform?.name ?? "aucune"}. La vérification est
          manuelle côté opérateur.
        </p>
      </section>

      <form className="panel stack" onSubmit={onSubmit}>
        <label className="field">
          ID joueur
          <input
            required
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            placeholder="Ex. 123456789"
          />
        </label>
        <label className="field">
          Libellé (optionnel)
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Compte principal"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !platform}>
          {busy ? "Ajout…" : "Ajouter l’ID"}
        </button>
      </form>

      <div className="list">
        {accounts.length === 0 && (
          <div className="empty panel">Aucun ID enregistré.</div>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="list-item">
            <div className="row spread">
              <div>
                <strong>{a.player_id}</strong>
                <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                  {a.label || a.platforms?.name || "Sans libellé"} ·{" "}
                  {a.verified ? "vérifié" : "à contrôler"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => remove(a.id)}
              >
                Suppr.
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
