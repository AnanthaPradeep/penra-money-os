import { Decimal, type Money } from "@/lib/money/decimal";
import {
  TRANSACTION_STATUSES,
  MANUAL_TRANSACTION_TYPES,
  SYSTEM_TRANSACTION_TYPES,
  type TransactionStatus,
  type TransactionType,
} from "@/lib/ledger/transaction-types";
import type { LedgerEntryRow, LedgerTransactionRow } from "@/lib/ledger/types";
import { assertLiteral } from "@/lib/types/literal";

const TRANSACTION_TYPES = [
  ...MANUAL_TRANSACTION_TYPES,
  ...SYSTEM_TRANSACTION_TYPES,
] as const;

export type LedgerTransaction = {
  id: string;
  transactionType: TransactionType;
  status: TransactionStatus;
  occurredAt: string;
  description: string;
  notes: string | null;
  reversalOf: string | null;
  reversedBy: string | null;
};

export function mapLedgerTransactionRow(
  row: LedgerTransactionRow,
): LedgerTransaction {
  return {
    id: row.id,
    transactionType: assertLiteral(
      row.transaction_type,
      TRANSACTION_TYPES,
      "ledger_transactions.transaction_type",
    ),
    status: assertLiteral(
      row.status,
      TRANSACTION_STATUSES,
      "ledger_transactions.status",
    ),
    occurredAt: row.occurred_at,
    description: row.description,
    notes: row.notes,
    reversalOf: row.reversal_of,
    reversedBy: row.reversed_by,
  };
}

export type LedgerEntry = {
  id: string;
  transactionId: string;
  accountId: string;
  amount: Money;
  currency: string;
  memo: string | null;
};

export function mapLedgerEntryRow(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    accountId: row.account_id,
    amount: new Decimal(row.amount),
    currency: row.currency,
    memo: row.memo,
  };
}
