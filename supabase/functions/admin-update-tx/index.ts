import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED: Record<string, string[]> = {
  deposit: ["credited", "rejected"],
  withdrawal: ["paid_momo", "rejected"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Non authentifié" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Session invalide" }, 401);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return json({ error: "Accès réservé aux opérateurs" }, 403);
    }

    const body = await req.json();
    const { transaction_id, status, admin_note, rejection_reason } = body;

    if (!transaction_id || !status) {
      return json({ error: "Paramètres manquants" }, 400);
    }

    const { data: tx, error: txErr } = await admin
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .single();

    if (txErr || !tx) {
      return json({ error: "Opération introuvable" }, 404);
    }

    const allowed = ALLOWED[tx.type] ?? [];
    if (!allowed.includes(status)) {
      return json({ error: `Transition interdite vers ${status}` }, 400);
    }

    if (tx.type === "deposit" && tx.status !== "pending_admin") {
      return json({ error: "Le dépôt n'est pas en attente admin" }, 400);
    }
    if (tx.type === "withdrawal" && tx.status !== "pending_admin") {
      return json({ error: "Le retrait n'est pas en attente admin" }, 400);
    }

    if (status === "rejected" && !rejection_reason?.trim()) {
      return json({ error: "Motif de rejet requis" }, 400);
    }

    const { data: updated, error: updErr } = await admin
      .from("transactions")
      .update({
        status,
        admin_note: admin_note ?? tx.admin_note,
        rejection_reason:
          status === "rejected" ? String(rejection_reason).trim() : null,
      })
      .eq("id", transaction_id)
      .select()
      .single();

    if (updErr) {
      return json({ error: updErr.message }, 400);
    }

    return json({ transaction: updated });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
