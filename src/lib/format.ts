import type { TxStatus, TxType } from "./types";

export function formatAmount(amount: number, currency = "XOF"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export const STATUS_LABELS: Record<TxStatus, string> = {
  awaiting_payment_ref: "En attente de référence",
  pending_admin: "En cours de traitement",
  credited: "Crédité",
  paid_momo: "Payé (MoMo)",
  rejected: "Rejeté",
};

export function typeLabel(type: TxType): string {
  return type === "deposit" ? "Dépôt" : "Retrait";
}
