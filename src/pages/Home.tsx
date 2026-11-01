import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { formatAmount, formatDate, typeLabel } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { Settings, Transaction } from "../lib/types";

export function Home() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => setSettings(data));

    supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent((data as Transaction[]) ?? []));
  }, []);

  return (
    <div className="rise">
      <section className="hero">
        <p className="muted">
          Bonjour{profile?.username ? `, ${profile.username}` : ""}
        </p>
        <h1>Que souhaitez-vous faire ?</h1>
        <p className="lede">
          {settings?.maintenance
            ? "Service temporairement en maintenance."
            : "Dépôt ou retrait MoMo vers votre ID bookmaker."}
        </p>
      </section>

      <div className="actions-primary">
        <button
          type="button"
          className="action-tile deposit"
          disabled={settings?.maintenance}
          onClick={() => navigate("/app/deposit")}
        >
          <strong>Déposer</strong>
          <span>MoMo → compte paris</span>
        </button>
        <button
          type="button"
          className="action-tile withdraw"
          disabled={settings?.maintenance}
          onClick={() => navigate("/app/withdraw")}
        >
          <strong>Retirer</strong>
          <span>Compte paris → MoMo</span>
        </button>
      </div>

      <div className="row spread" style={{ marginBottom: "0.6rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Dernières opérations</h2>
        <Link to="/app/history" className="muted">
          Tout voir
        </Link>
      </div>

      <div className="list">
        {recent.length === 0 && (
          <div className="empty panel">Aucune opération pour le moment.</div>
        )}
        {recent.map((tx) => (
          <Link key={tx.id} to="/app/history" className="list-item">
            <div className="row spread">
              <strong>
                {typeLabel(tx.type)} · {formatAmount(tx.amount, tx.currency)}
              </strong>
              <StatusBadge status={tx.status} />
            </div>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              {formatDate(tx.created_at)}
            </p>
          </Link>
        ))}
      </div>

      <p style={{ marginTop: "1.25rem" }}>
        <Link to="/app/ids">Gérer mes IDs joueur →</Link>
      </p>
    </div>
  );
}
