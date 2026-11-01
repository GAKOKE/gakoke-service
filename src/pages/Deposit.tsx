import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { formatAmount } from "../lib/format";
import { attachDepositRef, createDeposit as createDepositOp } from "../lib/ops";
import { supabase } from "../lib/supabase";
import type { PaymentMethod, PlayerAccount, Settings, Transaction } from "../lib/types";

export function Deposit() {
  const [accounts, setAccounts] = useState<PlayerAccount[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [playerAccountId, setPlayerAccountId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [tx, setTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedMethod = methods.find((m) => m.id === methodId);

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

  async function createDeposit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const transaction = await createDepositOp({
        player_account_id: playerAccountId,
        payment_method_id: methodId,
        amount: Number(amount),
      });
      setTx(transaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function attachRef(e: FormEvent) {
    e.preventDefault();
    if (!tx) return;
    setBusy(true);
    setError(null);
    try {
      const transaction = await attachDepositRef({
        transaction_id: tx.id,
        payment_ref: paymentRef,
      });
      setTx(transaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="rise panel">
        <h1>Dépôt</h1>
        <p className="lede">Ajoutez d’abord un ID joueur.</p>
        <Link to="/app/ids" className="btn btn-primary btn-block" style={{ marginTop: "1rem" }}>
          Mes IDs
        </Link>
      </div>
    );
  }

  if (tx?.status === "pending_admin" || tx?.status === "credited") {
    return (
      <div className="rise stack">
        <h1>Demande envoyée</h1>
        <div className="panel stack">
          <StatusBadge status={tx.status} />
          <p>
            {formatAmount(tx.amount, tx.currency)} — réf. {tx.payment_ref}
          </p>
          <p className="muted">
            Un opérateur vérifie le paiement MoMo puis crédite votre ID bookmaker.
          </p>
          <Link to="/app/history" className="btn btn-primary btn-block">
            Voir l’historique
          </Link>
        </div>
      </div>
    );
  }

  if (tx?.status === "awaiting_payment_ref") {
    return (
      <div className="rise stack">
        <h1>Payer puis coller la référence</h1>
        <div className="panel stack">
          <p>
            Montant : <strong>{formatAmount(tx.amount, tx.currency)}</strong>
          </p>
          {selectedMethod && (
            <>
              <p>
                <strong>{selectedMethod.label}</strong>
                {selectedMethod.merchant_info
                  ? ` — ${selectedMethod.merchant_info}`
                  : ""}
              </p>
              <ol className="steps" style={{ padding: 0, margin: 0 }}>
                {selectedMethod.instructions.split("\n").map((line) => (
                  <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
                ))}
              </ol>
            </>
          )}
        </div>
        <form className="panel stack" onSubmit={attachRef}>
          <label className="field">
            Référence de paiement
            <input
              required
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="Coller la réf. SMS / reçu"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Envoi…" : "Confirmer le paiement"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="rise stack">
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Dépôt</h1>
        <p className="lede">
          {settings?.help_deposit ??
            "Créez une demande, payez hors app, puis collez la référence."}
        </p>
      </section>
      <form className="panel stack" onSubmit={createDeposit}>
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
          Moyen MoMo
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
          Montant ({settings?.currency ?? "XOF"})
          <input
            type="number"
            required
            min={settings?.min_deposit ?? 500}
            max={settings?.max_deposit ?? 500000}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        {settings && (
          <p className="muted">
            Limites : {settings.min_deposit} – {settings.max_deposit}{" "}
            {settings.currency}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Création…" : "Continuer"}
        </button>
      </form>
    </div>
  );
}
