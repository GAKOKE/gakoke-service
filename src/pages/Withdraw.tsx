import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { invokeFunction, supabase } from "../lib/supabase";
import type { PaymentMethod, PlayerAccount, Settings, Transaction } from "../lib/types";

export function Withdraw() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<PlayerAccount[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [playerAccountId, setPlayerAccountId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [withdrawalCode, setWithdrawalCode] = useState("");
  const [momoPhone, setMomoPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("player_accounts").select("*, platforms(*)"),
      supabase.from("payment_methods").select("*").eq("active", true).order("sort_order"),
      supabase.from("settings").select("*").eq("id", 1).single(),
    ]).then(([a, m, s]) => {
      setAccounts((a.data as PlayerAccount[]) ?? []);
      setMethods((m.data as PaymentMethod[]) ?? []);
      setSettings(s.data);
      if (a.data?.[0]) setPlayerAccountId(a.data[0].id);
      if (m.data?.[0]) setMethodId(m.data[0].id);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await invokeFunction<{ transaction: Transaction }>("withdraw", {
        player_account_id: playerAccountId,
        payment_method_id: methodId,
        amount: Number(amount),
        withdrawal_code: withdrawalCode,
        momo_phone: momoPhone,
      });
      navigate("/app/history");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="rise panel">
        <h1>Retrait</h1>
        <p className="lede">Ajoutez d’abord un ID joueur.</p>
        <Link to="/app/ids" className="btn btn-primary btn-block" style={{ marginTop: "1rem" }}>
          Mes IDs
        </Link>
      </div>
    );
  }

  return (
    <div className="rise stack">
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Retrait</h1>
        <p className="lede">
          {settings?.help_withdrawal ??
            "Fournissez le code de retrait bookmaker et votre n° MoMo."}
        </p>
      </section>
      <form className="panel stack" onSubmit={onSubmit}>
        <label className="field">
          ID joueur
          <select
            required
            value={playerAccountId}
            onChange={(e) => setPlayerAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.player_id}
                {a.label ? ` (${a.label})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Code retrait bookmaker
          <input
            required
            value={withdrawalCode}
            onChange={(e) => setWithdrawalCode(e.target.value)}
          />
        </label>
        <label className="field">
          Montant ({settings?.currency ?? "XOF"})
          <input
            type="number"
            required
            min={settings?.min_withdrawal ?? 1000}
            max={settings?.max_withdrawal ?? 500000}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="field">
          Moyen MoMo de réception
          <select
            required
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
          >
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          N° MoMo
          <input
            required
            placeholder="+228…"
            value={momoPhone}
            onChange={(e) => setMomoPhone(e.target.value)}
          />
        </label>
        {settings && (
          <p className="muted">
            Limites : {settings.min_withdrawal} – {settings.max_withdrawal}{" "}
            {settings.currency}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-accent btn-block" disabled={busy}>
          {busy ? "Envoi…" : "Soumettre le retrait"}
        </button>
      </form>
    </div>
  );
}
