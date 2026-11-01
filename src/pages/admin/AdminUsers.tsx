import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { PlayerAccount, Profile } from "../../lib/types";

interface UserRow extends Profile {
  player_accounts?: PlayerAccount[];
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*, player_accounts(*)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setUsers((data as UserRow[]) ?? []));
  }, []);

  return (
    <div className="rise stack">
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Utilisateurs</h1>
        <p className="lede">Vue légère — téléphone, IDs, rôle.</p>
      </section>
      <div className="list">
        {users.map((u) => (
          <div key={u.id} className="list-item">
            <div className="row spread">
              <strong>{u.username ?? "sans nom"}</strong>
              <span className={`badge ${u.role === "admin" ? "ok" : "muted"}`}>
                {u.role}
              </span>
            </div>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              {u.phone ?? "pas de téléphone"}
            </p>
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              IDs :{" "}
              {u.player_accounts?.length
                ? u.player_accounts.map((a) => a.player_id).join(", ")
                : "aucun"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
