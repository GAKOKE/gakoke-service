import { STATUS_LABELS } from "../lib/format";
import type { TxStatus } from "../lib/types";

export function StatusBadge({ status }: { status: TxStatus }) {
  const tone =
    status === "credited" || status === "paid_momo"
      ? "ok"
      : status === "rejected"
        ? "bad"
        : status === "pending_admin" || status === "awaiting_payment_ref"
          ? "pending"
          : "muted";

  return <span className={`badge ${tone}`}>{STATUS_LABELS[status]}</span>;
}
