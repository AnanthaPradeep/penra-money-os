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

/**
 * Posted only via public.record_debt_proceeds / public.record_debt_payment
 * (see src/lib/debts/actions.ts) — never through create_manual_transaction
 * or the generic transaction composer, since a debt payment's
 * principal/interest/fees split has no equivalent in the manual entry-
 * builder forms. Still a real, ledger-backed transaction type that can
 * appear in ordinary transaction history/account history, so it must be
 * recognised here or mapLedgerTransactionRow's assertLiteral throws.
 */
export const DEBT_TRANSACTION_TYPES = [
  "debt_proceeds",
  "debt_payment",
] as const;
export type DebtTransactionType = (typeof DEBT_TRANSACTION_TYPES)[number];

export const DEBT_TRANSACTION_TYPE_LABELS: Record<DebtTransactionType, string> =
  {
    debt_proceeds: "Loan proceeds",
    debt_payment: "Debt payment",
  };

export type TransactionType =
  ManualTransactionType | SystemTransactionType | DebtTransactionType;

export const TRANSACTION_STATUSES = ["posted", "reversed"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
