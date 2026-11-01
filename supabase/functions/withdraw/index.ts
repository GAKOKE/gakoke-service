import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const body = await req.json();
    const {
      player_account_id,
      amount,
      payment_method_id,
      withdrawal_code,
      momo_phone,
    } = body;

    const { data: settings } = await admin
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settings?.maintenance) {
      return json({ error: "Service en maintenance" }, 503);
    }

    const amt = Number(amount);
    if (
      !player_account_id ||
      !payment_method_id ||
      !withdrawal_code?.trim() ||
      !momo_phone?.trim() ||
      !Number.isFinite(amt)
    ) {
      return json({ error: "Paramètres manquants" }, 400);
    }

    if (
      amt < Number(settings.min_withdrawal) ||
      amt > Number(settings.max_withdrawal)
    ) {
      return json({
        error: `Montant hors limites (${settings.min_withdrawal}–${settings.max_withdrawal} ${settings.currency})`,
      }, 400);
    }

    const { data: account } = await admin
      .from("player_accounts")
      .select("id")
      .eq("id", player_account_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return json({ error: "ID joueur invalide" }, 400);
    }

    const { data: method } = await admin
      .from("payment_methods")
      .select("id")
      .eq("id", payment_method_id)
      .eq("active", true)
      .maybeSingle();

    if (!method) {
      return json({ error: "Moyen de paiement indisponible" }, 400);
    }

    const { data: created, error: createErr } = await admin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "withdrawal",
        player_account_id,
        amount: amt,
        currency: settings.currency,
        payment_method_id,
        withdrawal_code: String(withdrawal_code).trim(),
        momo_phone: String(momo_phone).trim(),
        status: "pending_admin",
      })
      .select()
      .single();

    if (createErr) {
      return json({ error: createErr.message }, 400);
    }

    return json({ transaction: created });
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
