export type Role = "user" | "admin";

export type DepositStatus =
  | "awaiting_payment_ref"
  | "pending_admin"
  | "credited"
  | "rejected";

export type WithdrawalStatus = "pending_admin" | "paid_momo" | "rejected";

export type TxStatus = DepositStatus | WithdrawalStatus;

export type TxType = "deposit" | "withdrawal";

export interface Profile {
  id: string;
  username: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
}

export interface Platform {
  id: string;
  name: string;
  active: boolean;
  cashdesk_provider?: string;
  cashdesk_cash_id?: number | null;
  cashdesk_notes?: string | null;
}

export interface PlayerAccount {
  id: string;
  user_id: string;
  platform_id: string;
  player_id: string;
  label: string | null;
  verified: boolean;
  created_at: string;
  platforms?: Platform;
}

export interface PaymentMethod {
  id: string;
  code: string;
  label: string;
  instructions: string;
  merchant_info: string | null;
  kind: string;
  active: boolean;
}

export interface Settings {
  id: number;
  currency: string;
  min_deposit: number;
  max_deposit: number;
  min_withdrawal: number;
  max_withdrawal: number;
  maintenance: boolean;
  help_deposit: string | null;
  help_withdrawal: string | null;
  auto_deposit?: boolean;
  auto_withdrawal?: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TxType;
  player_account_id: string;
  amount: number;
  currency: string;
  payment_method_id: string | null;
  payment_ref: string | null;
  withdrawal_code: string | null;
  momo_phone: string | null;
  status: TxStatus;
  admin_note: string | null;
  rejection_reason: string | null;
  cashdesk_status?: string | null;
  cashdesk_ref?: string | null;
  cashdesk_error?: string | null;
  cashdesk_at?: string | null;
  created_at: string;
  updated_at: string;
  player_accounts?: PlayerAccount;
  payment_methods?: PaymentMethod;
  profiles?: Profile;
}
