export const ACCOUNT_CLASSES = [
  "asset",
  "liability",
  "income",
  "expense",
  "equity",
] as const;
export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

/** Account types a user can create directly (see /app/accounts/new). */
export const USER_ACCOUNT_TYPES = [
  "bank_savings",
  "bank_current",
  "cash",
  "wallet",
  "credit_card",
  "loan",
  "other_asset",
  "other_liability",
] as const;
export type UserAccountType = (typeof USER_ACCOUNT_TYPES)[number];

/** Hidden accounts provisioned automatically for every user — never user-created. */
export const SYSTEM_ACCOUNT_TYPES = [
  "opening_balance_equity",
  "uncategorized_income",
  "uncategorized_expense",
] as const;
export type SystemAccountType = (typeof SYSTEM_ACCOUNT_TYPES)[number];

export type AccountType = UserAccountType | SystemAccountType;

/**
 * Mirrors the account_type -> account_class derivation in
 * public.create_account_with_opening_balance() (see supabase/migrations).
 * An account's class is always derived from its type — never chosen
 * directly by the user, and never trusted from client input.
 */
export const USER_ACCOUNT_TYPE_CLASS: Record<
  UserAccountType,
  Extract<AccountClass, "asset" | "liability">
> = {
  bank_savings: "asset",
  bank_current: "asset",
  cash: "asset",
  wallet: "asset",
  other_asset: "asset",
  credit_card: "liability",
  loan: "liability",
  other_liability: "liability",
};

export function deriveAccountClass(
  accountType: UserAccountType,
): Extract<AccountClass, "asset" | "liability"> {
  return USER_ACCOUNT_TYPE_CLASS[accountType];
}

export const ACCOUNT_TYPE_LABELS: Record<UserAccountType, string> = {
  bank_savings: "Bank savings account",
  bank_current: "Bank current account",
  cash: "Cash",
  wallet: "Wallet",
  credit_card: "Credit card",
  loan: "Loan",
  other_asset: "Other asset",
  other_liability: "Other liability",
};

export function isCreditCardType(accountType: UserAccountType): boolean {
  return accountType === "credit_card";
}
