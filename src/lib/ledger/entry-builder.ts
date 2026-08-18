import type { Money } from "@/lib/money/decimal";
import { toDbAmountString } from "@/lib/money/parse";

/**
 * The signed-entry pairs below implement the sign convention used
 * throughout the ledger: positive amount = debit, negative amount =
 * credit. Every builder here returns exactly two entries that sum to
 * zero — the deferred balance constraint trigger on ledger_entries (see
 * supabase/migrations) re-verifies this in the database; these functions
 * are what guarantee it holds by construction on the way in.
 *
 * Phase 3 has no user-defined income/expense categories (a Phase 4+
 * concern) — every user account is asset or liability, so a manual
 * income/expense transaction always pairs the chosen account with the
 * user's Uncategorized Income/Expense system account.
 */

const DEFAULT_CURRENCY = "INR";

export type LedgerEntryInput = {
  accountId: string;
  amount: Money;
  currency?: string;
  memo?: string;
};

export type LedgerEntryPayload = {
  account_id: string;
  amount: string;
  currency: string;
  memo?: string;
};

export function toEntriesPayload(
  entries: LedgerEntryInput[],
): LedgerEntryPayload[] {
  return entries.map((entry) => ({
    account_id: entry.accountId,
    amount: toDbAmountString(entry.amount),
    currency: entry.currency ?? DEFAULT_CURRENCY,
    ...(entry.memo ? { memo: entry.memo } : {}),
  }));
}

/** Exactly two entries that sum to zero — every builder below returns this shape by construction. */
export type LedgerEntryPair = [LedgerEntryInput, LedgerEntryInput];

/** Money arriving in an asset account from an unmodelled income source. */
export function buildIncomeEntries(params: {
  toAccountId: string;
  uncategorizedIncomeAccountId: string;
  amount: Money;
}): LedgerEntryPair {
  return [
    { accountId: params.toAccountId, amount: params.amount },
    {
      accountId: params.uncategorizedIncomeAccountId,
      amount: params.amount.negated(),
    },
  ];
}

/** Money leaving an asset account to an unmodelled expense. */
export function buildExpenseEntries(params: {
  fromAccountId: string;
  uncategorizedExpenseAccountId: string;
  amount: Money;
}): LedgerEntryPair {
  return [
    { accountId: params.uncategorizedExpenseAccountId, amount: params.amount },
    { accountId: params.fromAccountId, amount: params.amount.negated() },
  ];
}

/** Money moving between two of the user's own accounts. */
export function buildTransferEntries(params: {
  fromAccountId: string;
  toAccountId: string;
  amount: Money;
}): LedgerEntryPair {
  return [
    { accountId: params.toAccountId, amount: params.amount },
    { accountId: params.fromAccountId, amount: params.amount.negated() },
  ];
}

/** A purchase on a credit card: increases the amount owed (an unmodelled expense) and the card's liability balance. */
export function buildCreditCardPurchaseEntries(params: {
  creditCardAccountId: string;
  uncategorizedExpenseAccountId: string;
  amount: Money;
}): LedgerEntryPair {
  return [
    { accountId: params.uncategorizedExpenseAccountId, amount: params.amount },
    { accountId: params.creditCardAccountId, amount: params.amount.negated() },
  ];
}

/** A payment toward a credit card from an asset account — flows asset -> liability, reducing the amount owed. */
export function buildCreditCardPaymentEntries(params: {
  creditCardAccountId: string;
  fromAccountId: string;
  amount: Money;
}): LedgerEntryPair {
  return [
    { accountId: params.creditCardAccountId, amount: params.amount },
    { accountId: params.fromAccountId, amount: params.amount.negated() },
  ];
}
