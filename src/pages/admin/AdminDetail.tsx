import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { formatAmount, formatDate, typeLabel } from "../../lib/format";
import { adminUpdateTx } from "../../lib/ops";
import { supabase } from "../../lib/supabase";
import type { Transaction } from "../../lib/types";

export function AdminDetail() {
  const { id } = useParams();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("transactions")
      .select(
        "*, player_accounts(*, platforms(*)), payment_methods(*), profiles:user_id(username, phone, role)",
      )
      .eq("id", id)
      .maybeSingle();
    setTx(data as Transaction | null);
    if (data?.admin_note) setAdminNote(data.admin_note);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function transition(status: string, e?: FormEvent) {
    e?.preventDefault();
    if (!tx) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await adminUpdateTx({
        transaction_id: tx.id,
        status,
        admin_note: adminNote,
        rejection_reason: rejectionReason,
      });
      setTx(updated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!tx) {
    return (
      <div className="rise">
        <p className="muted">Chargement…</p>
        <Link to="/admin">← File</Link>
      </div>
    );
  }

  const pending = tx.status === "pending_admin";

  return (
    <div className="rise stack">
      <Link to="/admin" className="muted">
        ← File ops
      </Link>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>
          {typeLabel(tx.type)} · {formatAmount(tx.amount, tx.currency)}
        </h1>
        <div style={{ marginTop: "0.5rem" }}>
          <StatusBadge status={tx.status} />
        </div>
      </section>

      <div className="admin-grid cols-2">
        <div className="panel stack">
          <p>
            <strong>Utilisateur</strong>
            <br />
            {tx.profiles?.username ?? "—"} · {tx.profiles?.phone ?? "pas de tél."}
          </p>
          <p>
            <strong>ID joueur</strong>
            <br />
            {tx.player_accounts?.player_id} (
            {tx.player_accounts?.platforms?.name ?? "plateforme"})
          </p>
          <p>
            <strong>Moyen</strong>
            <br />
            {tx.payment_methods?.label ?? "—"}
          </p>
          {tx.type === "deposit" && (
            <p>
              <strong>Réf. paiement</strong>
              <br />
              {tx.payment_ref ?? "—"}
            </p>
          )}
          {tx.type === "withdrawal" && (
            <>
              <p>
                <strong>Code retrait</strong>
                <br />
                {tx.withdrawal_code}
              </p>
              <p>
                <strong>N° MoMo</strong>
                <br />
                {tx.momo_phone}
              </p>
            </>
          )}
          <p className="muted">Créé le {formatDate(tx.created_at)}</p>
          {tx.rejection_reason && (
            <p className="error">Rejet : {tx.rejection_reason}</p>
          )}
        </div>

        <div className="panel stack">
          <label className="field">
            Note interne
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Vérifié Flooz, crédité ID…"
            />
          </label>

          {pending && tx.type === "deposit" && (
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy}
              onClick={() => transition("credited")}
            >
              Marquer crédité
            </button>
          )}
          {pending && tx.type === "withdrawal" && (
            <button
              type="button"
              className="btn btn-accent btn-block"
              disabled={busy}
              onClick={() => transition("paid_momo")}
            >
              Marquer payé MoMo
            </button>
          )}

          {pending && (
            <form className="stack" onSubmit={(e) => transition("rejected", e)}>
              <label className="field">
                Motif de rejet
                <input
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </label>
              <button className="btn btn-danger btn-block" disabled={busy}>
                Rejeter
              </button>
            </form>
          )}

          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
