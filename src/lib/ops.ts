import { supabase } from "./supabase";
import type { Settings, Transaction } from "./types";

async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Réglages indisponibles");
  if (data.maintenance) throw new Error("Service en maintenance");
  return data as Settings;
}

function unwrapTx(result: Transaction | { transaction: Transaction }): Transaction {
  if (result && typeof result === "object" && "transaction" in result) {
    return result.transaction;
  }
  return result as Transaction;
}

/** Prefer Edge Function; fall back to RLS client ops (cloud without deploy). */
async function invokeOrFallback(
  name: string,
  body: Record<string, unknown>,
  fallback: () => Promise<Transaction>,
): Promise<Transaction> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error && data && !data.error && (data.transaction || data.id)) {
      return unwrapTx(data);
    }
  } catch {
    // fall through
  }
  return fallback();
}

export async function createDeposit(input: {
  player_account_id: string;
  payment_method_id: string;
  amount: number;
}): Promise<Transaction> {
  return invokeOrFallback("deposit", input, async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const settings = await getSettings();
    const amt = Number(input.amount);
    if (
      !Number.isFinite(amt) ||
      amt < Number(settings.min_deposit) ||
      amt > Number(settings.max_deposit)
    ) {
      throw new Error(
        `Montant hors limites (${settings.min_deposit}–${settings.max_deposit} ${settings.currency})`,
      );
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "deposit",
        player_account_id: input.player_account_id,
        amount: amt,
        currency: settings.currency,
        payment_method_id: input.payment_method_id,
        status: "awaiting_payment_ref",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Transaction;
  });
}

export async function attachDepositRef(input: {
  transaction_id: string;
  payment_ref: string;
}): Promise<Transaction> {
  const body = { action: "attach_ref", ...input };
  return invokeOrFallback("deposit", body, async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const ref = input.payment_ref.trim();
    if (!ref) throw new Error("Référence de paiement requise");

    const { data: dup } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("payment_ref", ref)
      .in("status", ["awaiting_payment_ref", "pending_admin"])
      .neq("id", input.transaction_id)
      .maybeSingle();
    if (dup) throw new Error("Cette référence est déjà utilisée");

    const { data, error } = await supabase
      .from("transactions")
      .update({ payment_ref: ref, status: "pending_admin" })
      .eq("id", input.transaction_id)
      .eq("user_id", user.id)
      .eq("type", "deposit")
      .eq("status", "awaiting_payment_ref")
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Transaction;
  });
}

export async function createWithdrawal(input: {
  player_account_id: string;
  payment_method_id: string;
  amount: number;
  withdrawal_code: string;
  momo_phone: string;
}): Promise<Transaction> {
  return invokeOrFallback("withdraw", input, async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const settings = await getSettings();
    const amt = Number(input.amount);
    if (
      !Number.isFinite(amt) ||
      amt < Number(settings.min_withdrawal) ||
      amt > Number(settings.max_withdrawal)
    ) {
      throw new Error(
        `Montant hors limites (${settings.min_withdrawal}–${settings.max_withdrawal} ${settings.currency})`,
      );
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "withdrawal",
        player_account_id: input.player_account_id,
        amount: amt,
        currency: settings.currency,
        payment_method_id: input.payment_method_id,
        withdrawal_code: input.withdrawal_code.trim(),
        momo_phone: input.momo_phone.trim(),
        status: "pending_admin",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Transaction;
  });
}

export async function adminUpdateTx(input: {
  transaction_id: string;
  status: string;
  admin_note?: string;
  rejection_reason?: string;
}): Promise<Transaction> {
  return invokeOrFallback("admin-update-tx", input, async () => {
    const allowedDeposit = ["credited", "rejected"];
    const allowedWithdraw = ["paid_momo", "rejected"];

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", input.transaction_id)
      .single();
    if (txErr || !tx) throw new Error(txErr?.message ?? "Opération introuvable");
    if (tx.status !== "pending_admin") {
      throw new Error("L'opération n'est pas en attente admin");
    }

    const allowed = tx.type === "deposit" ? allowedDeposit : allowedWithdraw;
    if (!allowed.includes(input.status)) {
      throw new Error(`Transition interdite vers ${input.status}`);
    }
    if (input.status === "rejected" && !input.rejection_reason?.trim()) {
      throw new Error("Motif de rejet requis");
    }

    const { data, error } = await supabase
      .from("transactions")
      .update({
        status: input.status,
        admin_note: input.admin_note ?? tx.admin_note,
        rejection_reason:
          input.status === "rejected"
            ? String(input.rejection_reason).trim()
            : null,
      })
      .eq("id", input.transaction_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Transaction;
  });
}
