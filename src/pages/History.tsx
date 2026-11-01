import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { formatAmount, formatDate, typeLabel } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../lib/types";

type Filter = "all" | "open" | "done" | "rejected";

export function History() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const load = () =>
      supabase
        .from("transactions")
        .select("*, player_accounts(*), payment_methods(*)")
        .order("created_at", { ascending: false })
        .then(({ data }) => setItems((data as Transaction[]) ?? []));

    load();

    const channel = supabase
      .channel("tx-history")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((tx) => {
      if (filter === "all") return true;
      if (filter === "open") {
        return (
          tx.status === "awaiting_payment_ref" || tx.status === "pending_admin"
        );
      }
      if (filter === "done") {
        return tx.status === "credited" || tx.status === "paid_momo";
      }
      return tx.status === "rejected";
    });
  }, [items, filter]);

  return (
    <div className="rise stack">
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Historique</h1>
        <p className="lede">Statuts mis à jour en temps réel.</p>
      </section>

      <div className="filters">
        {(
          [
            ["all", "Tous"],
            ["open", "En cours"],
            ["done", "Terminés"],
            ["rejected", "Rejetés"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`chip ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="list">
        {filtered.length === 0 && (
          <div className="empty panel">Aucune opération.</div>
        )}
        {filtered.map((tx) => (
          <div key={tx.id} className="list-item">
            <div className="row spread">
              <strong>
                {typeLabel(tx.type)} · {formatAmount(tx.amount, tx.currency)}
              </strong>
              <StatusBadge status={tx.status} />
            </div>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              {formatDate(tx.created_at)}
              {tx.payment_ref ? ` · réf. ${tx.payment_ref}` : ""}
              {tx.player_accounts?.player_id
                ? ` · ID ${tx.player_accounts.player_id}`
                : ""}
            </p>
            {tx.rejection_reason && (
              <p className="error" style={{ marginTop: "0.4rem" }}>
                Motif : {tx.rejection_reason}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
