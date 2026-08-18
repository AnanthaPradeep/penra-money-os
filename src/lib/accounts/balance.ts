import type { Money } from "@/lib/money/decimal";
import type { AccountClass } from "@/lib/accounts/classes";

/**
 * Converts a raw signed ledger balance (sum of entries; positive = net
 * debit) into the balance a user expects to see. Asset accounts are
 * debit-normal and display as-is; liability accounts are credit-normal, so
 * their display balance is the negation of the signed sum (a liability
 * with signed_balance = -5000 displays as "you owe 5000"). Mirrors
 * public.account_balances (see supabase/migrations).
 */
export function toDisplayBalance(
  accountClass: AccountClass,
  signedBalance: Money,
): Money {
  return accountClass === "liability" ? signedBalance.negated() : signedBalance;
}
