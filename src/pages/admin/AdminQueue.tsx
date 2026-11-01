import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { formatAmount, formatDate, typeLabel } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import type { Transaction } from "../../lib/types";

type Filter = "pending" | "all" | "deposit" | "withdrawal";

export function AdminQueue() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");

  useEffect(() => {
    const load = () =>
      supabase
        .from("transactions")
        .select(
          "*, player_accounts(*), payment_methods(*), profiles:user_id(username, phone)",
        )
        .order("created_at", { ascending: true })
        .then(({ data }) => setItems((data as Transaction[]) ?? []));

    load();
    const channel = supabase
      .channel("admin-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const pendingCount = items.filter((t) => t.status === "pending_admin").length;

  const filtered = useMemo(() => {
    return items.filter((tx) => {
      if (filter === "pending") return tx.status === "pending_admin";
      if (filter === "deposit") return tx.type === "deposit";
      if (filter === "withdrawal") return tx.type === "withdrawal";
      return true;
    });
  }, [items, filter]);

  return (
    <div className="rise stack">
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>File ops</h1>
        <p className="lede">{pendingCount} opération(s) en attente.</p>
      </section>

      <div className="filters">
        {(
          [
            ["pending", "En attente"],
            ["deposit", "Dépôts"],
            ["withdrawal", "Retraits"],
            ["all", "Tous"],
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
          <div className="empty panel">File vide.</div>
        )}
        {filtered.map((tx) => (
          <Link key={tx.id} to={`/admin/tx/${tx.id}`} className="list-item">
            <div className="row spread">
              <strong>
                {typeLabel(tx.type)} · {formatAmount(tx.amount, tx.currency)}
              </strong>
              <StatusBadge status={tx.status} />
            </div>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              {formatDate(tx.created_at)}
              {tx.profiles?.username ? ` · ${tx.profiles.username}` : ""}
              {tx.player_accounts?.player_id
                ? ` · ID ${tx.player_accounts.player_id}`
                : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
