/** Transaction types a user creates directly through a manual transaction form. */
export const MANUAL_TRANSACTION_TYPES = [
  "income",
  "expense",
  "transfer",
  "credit_card_purchase",
  "credit_card_payment",
] as const;
export type ManualTransactionType = (typeof MANUAL_TRANSACTION_TYPES)[number];

export const MANUAL_TRANSACTION_TYPE_LABELS: Record<
  ManualTransactionType,
  string
> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  credit_card_purchase: "Credit card purchase",
  credit_card_payment: "Credit card payment",
};

/** System-generated transaction types — never created directly from the manual transaction form. */
export const SYSTEM_TRANSACTION_TYPES = [
  "opening_balance",
  "adjustment",
  "reversal",
] as const;
export type SystemTransactionType = (typeof SYSTEM_TRANSACTION_TYPES)[number];

export type TransactionType = ManualTransactionType | SystemTransactionType;

export const TRANSACTION_STATUSES = ["posted", "reversed"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
