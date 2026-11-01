import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  autoDepositPlayer,
  autoWithdrawByCode,
  type MobCashConfig,
} from "../_shared/mobcash.ts";

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
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

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
    if (userError || !user) return json({ error: "Session invalide" }, 401);

    const body = await req.json();
    const { transaction_id, force } = body as {
      transaction_id?: string;
      force?: boolean;
    };
    if (!transaction_id) return json({ error: "transaction_id requis" }, 400);

    const { data: tx, error: txErr } = await admin
      .from("transactions")
      .select(
        "*, player_accounts(player_id, platform_id, platforms(cashdesk_provider, cashdesk_cash_id, name))",
      )
      .eq("id", transaction_id)
      .single();
    if (txErr || !tx) return json({ error: "Opération introuvable" }, 404);

    // Owner or admin
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const isAdmin = profile?.role === "admin";
    if (tx.user_id !== user.id && !isAdmin) {
      return json({ error: "Accès refusé" }, 403);
    }

    const { data: settings } = await admin
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single();

    const provider =
      tx.player_accounts?.platforms?.cashdesk_provider ?? "mobcash";

    if (provider === "none") {
      await mark(admin, tx.id, {
        cashdesk_status: "skipped",
        cashdesk_error: "Provider=none",
      });
      return json({ skipped: true, reason: "provider_none", transaction: tx });
    }

    const cfg = buildConfig(tx.player_accounts?.platforms?.cashdesk_cash_id);

    if (tx.type === "deposit") {
      if (!force && !settings?.auto_deposit) {
        return json({ skipped: true, reason: "auto_deposit_off" });
      }
      if (tx.status !== "pending_admin" && !force) {
        return json({ error: "Dépôt pas en pending_admin" }, 400);
      }

      await mark(admin, tx.id, { cashdesk_status: "pending" });

      try {
        const result = await autoDepositPlayer(
          cfg,
          tx.player_accounts.player_id,
          Number(tx.amount),
        );
        const dry = Boolean((result as { dryRun?: boolean }).dryRun);
        const { data: updated } = await admin
          .from("transactions")
          .update({
            status: dry ? tx.status : "credited",
            cashdesk_status: dry ? "dry_run" : "success",
            cashdesk_ref: dry
              ? "dry-run"
              : String(
                (result as { result?: { Id?: string } }).result?.Id ??
                  crypto.randomUUID(),
              ),
            cashdesk_error: null,
            cashdesk_payload: result,
            cashdesk_at: new Date().toISOString(),
            admin_note: dry
              ? "Dry-run cashdesk (secrets manquants ou MOBCASH_DRY_RUN=1)"
              : "Crédit auto MobCash OK",
          })
          .eq("id", tx.id)
          .select()
          .single();
        return json({ ok: true, dryRun: dry, transaction: updated, result });
      } catch (e) {
        const err = e as Error & { status?: number; code?: string };
        const msg = err.message || String(e);
        const status = err.status === 401 ? 401 : 502;
        await mark(admin, tx.id, {
          cashdesk_status: "failed",
          cashdesk_error: msg,
        });
        return json(
          { error: msg, cashdesk_status: "failed", code: err.code },
          status,
        );
      }
    }

    if (tx.type === "withdrawal") {
      if (!force && !settings?.auto_withdrawal) {
        return json({ skipped: true, reason: "auto_withdrawal_off" });
      }
      if (tx.status !== "pending_admin" && !force) {
        return json({ error: "Retrait pas en pending_admin" }, 400);
      }
      if (!tx.withdrawal_code) {
        return json({ error: "Code retrait manquant" }, 400);
      }

      await mark(admin, tx.id, { cashdesk_status: "pending" });

      try {
        const result = await autoWithdrawByCode(
          cfg,
          tx.withdrawal_code,
          Number(tx.amount),
        );
        const dry = Boolean((result as { dryRun?: boolean }).dryRun);
        // Cashdesk OK ≠ MoMo envoyé : on reste pending_admin sauf dry; note ops
        const { data: updated } = await admin
          .from("transactions")
          .update({
            cashdesk_status: dry ? "dry_run" : "success",
            cashdesk_ref: dry
              ? "dry-run"
              : String(tx.withdrawal_code),
            cashdesk_error: null,
            cashdesk_payload: result,
            cashdesk_at: new Date().toISOString(),
            admin_note: dry
              ? "Dry-run cashdesk retrait"
              : "Code encaissé via MobCash — envoyer MoMo puis marquer payé",
          })
          .eq("id", tx.id)
          .select()
          .single();
        return json({ ok: true, dryRun: dry, transaction: updated, result });
      } catch (e) {
        const err = e as Error & { status?: number; code?: string };
        const msg = err.message || String(e);
        const status = err.status === 401 ? 401 : 502;
        await mark(admin, tx.id, {
          cashdesk_status: "failed",
          cashdesk_error: msg,
        });
        return json(
          { error: msg, cashdesk_status: "failed", code: err.code },
          status,
        );
      }
    }

    return json({ error: "Type non supporté" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function buildConfig(cashId?: number | null): MobCashConfig {
  const login = Deno.env.get("MOBCASH_LOGIN") || "";
  const password = Deno.env.get("MOBCASH_PASSWORD") || "";
  const dryEnv = Deno.env.get("MOBCASH_DRY_RUN") === "1";
  const dryRun = dryEnv || !login || !password;
  const cashIdEnv = Deno.env.get("MOBCASH_CASH_ID");
  return {
    login,
    password,
    cashId: cashId ?? (cashIdEnv ? Number(cashIdEnv) : undefined),
    baseUrl: Deno.env.get("MOBCASH_BASE_URL") || undefined,
    appGuid: Deno.env.get("MOBCASH_APP_GUID") || undefined,
    dryRun,
  };
}

async function mark(
  admin: ReturnType<typeof createClient>,
  id: string,
  patch: Record<string, unknown>,
) {
  await admin
    .from("transactions")
    .update({ ...patch, cashdesk_at: new Date().toISOString() })
    .eq("id", id);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
