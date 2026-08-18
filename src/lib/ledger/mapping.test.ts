import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import {
  mapLedgerEntryRow,
  mapLedgerTransactionRow,
} from "@/lib/ledger/mapping";
import type { LedgerEntryRow, LedgerTransactionRow } from "@/lib/ledger/types";

describe("mapLedgerTransactionRow", () => {
  it("maps a database row to a domain LedgerTransaction", () => {
    const row: LedgerTransactionRow = {
      id: "txn-1",
      user_id: "user-1",
      transaction_type: "income",
      status: "posted",
      occurred_at: "2026-08-16T00:00:00Z",
      description: "Salary",
      notes: null,
      source_type: "manual",
      source_reference: null,
      reversal_of: null,
      reversed_by: null,
      created_at: "2026-08-16T00:00:00Z",
      updated_at: "2026-08-16T00:00:00Z",
    };

    expect(mapLedgerTransactionRow(row)).toEqual({
      id: "txn-1",
      transactionType: "income",
      status: "posted",
      occurredAt: "2026-08-16T00:00:00Z",
      description: "Salary",
      notes: null,
      reversalOf: null,
      reversedBy: null,
    });
  });
});

describe("mapLedgerEntryRow", () => {
  it("converts the amount into a Decimal", () => {
    const row: LedgerEntryRow = {
      id: "entry-1",
      user_id: "user-1",
      transaction_id: "txn-1",
      account_id: "acct-1",
      amount: -500,
      currency: "INR",
      memo: null,
      created_at: "2026-08-16T00:00:00Z",
    };

    const entry = mapLedgerEntryRow(row);
    expect(entry.amount).toBeInstanceOf(Decimal);
    expect(entry.amount.toString()).toBe("-500");
    expect(entry.accountId).toBe("acct-1");
  });
});
