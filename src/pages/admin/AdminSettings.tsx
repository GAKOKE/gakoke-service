import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { PaymentMethod, Platform, Settings } from "../../lib/types";

export function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [s, m, p] = await Promise.all([
      supabase.from("settings").select("*").eq("id", 1).single(),
      supabase.from("payment_methods").select("*").order("sort_order"),
      supabase.from("platforms").select("*").eq("active", true).maybeSingle(),
    ]);
    setSettings(s.data);
    setMethods((m.data as PaymentMethod[]) ?? []);
    setPlatform(p.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase
      .from("settings")
      .update({
        min_deposit: settings.min_deposit,
        max_deposit: settings.max_deposit,
        min_withdrawal: settings.min_withdrawal,
        max_withdrawal: settings.max_withdrawal,
        maintenance: settings.maintenance,
        help_deposit: settings.help_deposit,
        help_withdrawal: settings.help_withdrawal,
        currency: settings.currency,
        auto_deposit: settings.auto_deposit ?? false,
        auto_withdrawal: settings.auto_withdrawal ?? false,
      })
      .eq("id", 1);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage("Réglages enregistrés.");
  }

  async function saveMethod(method: PaymentMethod) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("payment_methods")
      .update({
        label: method.label,
        instructions: method.instructions,
        merchant_info: method.merchant_info,
        active: method.active,
      })
      .eq("id", method.id);
    setBusy(false);
    if (err) setError(err.message);
    else {
      setMessage(`Moyen ${method.label} mis à jour.`);
      await load();
    }
  }

  if (!settings) return <p className="muted">Chargement…</p>;

  return (
    <div className="rise stack">
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Configuration</h1>
        <p className="lede">
          Bookmaker actif : {platform?.name ?? "aucun"} · devise {settings.currency}
        </p>
      </section>

      <form className="panel stack" onSubmit={saveSettings}>
        <label className="field">
          Min dépôt
          <input
            type="number"
            value={settings.min_deposit}
            onChange={(e) =>
              setSettings({ ...settings, min_deposit: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          Max dépôt
          <input
            type="number"
            value={settings.max_deposit}
            onChange={(e) =>
              setSettings({ ...settings, max_deposit: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          Min retrait
          <input
            type="number"
            value={settings.min_withdrawal}
            onChange={(e) =>
              setSettings({
                ...settings,
                min_withdrawal: Number(e.target.value),
              })
            }
          />
        </label>
        <label className="field">
          Max retrait
          <input
            type="number"
            value={settings.max_withdrawal}
            onChange={(e) =>
              setSettings({
                ...settings,
                max_withdrawal: Number(e.target.value),
              })
            }
          />
        </label>
        <label className="field">
          Aide dépôt
          <textarea
            value={settings.help_deposit ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, help_deposit: e.target.value })
            }
          />
        </label>
        <label className="field">
          Aide retrait
          <textarea
            value={settings.help_withdrawal ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, help_withdrawal: e.target.value })
            }
          />
        </label>
        <label className="row" style={{ fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={settings.maintenance}
            onChange={(e) =>
              setSettings({ ...settings, maintenance: e.target.checked })
            }
          />
          Mode maintenance
        </label>
        <label className="row" style={{ fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={settings.auto_deposit ?? false}
            onChange={(e) =>
              setSettings({ ...settings, auto_deposit: e.target.checked })
            }
          />
          Auto-crédit bookmaker (MobCash) après réf. MoMo
        </label>
        <label className="row" style={{ fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={settings.auto_withdrawal ?? false}
            onChange={(e) =>
              setSettings({ ...settings, auto_withdrawal: e.target.checked })
            }
          />
          Auto-encaisser code retrait (MobCash) — MoMo reste manuel
        </label>
        <p className="muted">
          Secrets serveur requis : MOBCASH_LOGIN, MOBCASH_PASSWORD,
          MOBCASH_CASH_ID (voir docs/cashdesk-auto.md). Sans secrets → dry-run.
        </p>
        <button className="btn btn-primary btn-block" disabled={busy}>
          Enregistrer les limites
        </button>
      </form>

      {methods.map((m) => (
        <div key={m.id} className="panel stack">
          <h2 style={{ fontSize: "1.05rem" }}>{m.code}</h2>
          <label className="field">
            Libellé
            <input
              value={m.label}
              onChange={(e) =>
                setMethods((prev) =>
                  prev.map((x) =>
                    x.id === m.id ? { ...x, label: e.target.value } : x,
                  ),
                )
              }
            />
          </label>
          <label className="field">
            Infos marchand
            <input
              value={m.merchant_info ?? ""}
              onChange={(e) =>
                setMethods((prev) =>
                  prev.map((x) =>
                    x.id === m.id ? { ...x, merchant_info: e.target.value } : x,
                  ),
                )
              }
            />
          </label>
          <label className="field">
            Instructions
            <textarea
              value={m.instructions}
              onChange={(e) =>
                setMethods((prev) =>
                  prev.map((x) =>
                    x.id === m.id ? { ...x, instructions: e.target.value } : x,
                  ),
                )
              }
            />
          </label>
          <label className="row" style={{ fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={m.active}
              onChange={(e) =>
                setMethods((prev) =>
                  prev.map((x) =>
                    x.id === m.id ? { ...x, active: e.target.checked } : x,
                  ),
                )
              }
            />
            Actif
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            disabled={busy}
            onClick={() => saveMethod(methods.find((x) => x.id === m.id)!)}
          >
            Sauver {m.label}
          </button>
        </div>
      ))}

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
    </div>
  );
}
