import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import {
  buildCreditCardPaymentEntries,
  buildCreditCardPurchaseEntries,
  buildExpenseEntries,
  buildIncomeEntries,
  buildTransferEntries,
  toEntriesPayload,
} from "@/lib/ledger/entry-builder";

function sum(entries: { amount: Decimal }[]): Decimal {
  return entries.reduce(
    (total, entry) => total.plus(entry.amount),
    new Decimal(0),
  );
}

describe("buildIncomeEntries", () => {
  it("debits the destination asset account and credits Uncategorized Income", () => {
    const entries = buildIncomeEntries({
      toAccountId: "bank-1",
      uncategorizedIncomeAccountId: "income-sys",
      amount: new Decimal("50000"),
    });

    expect(entries[0].accountId).toBe("bank-1");
    expect(entries[0].amount.toString()).toBe("50000");
    expect(entries[1].accountId).toBe("income-sys");
    expect(entries[1].amount.toString()).toBe("-50000");
    expect(sum(entries).isZero()).toBe(true);
  });
});

describe("buildExpenseEntries", () => {
  it("debits Uncategorized Expense and credits the source asset account", () => {
    const entries = buildExpenseEntries({
      fromAccountId: "bank-1",
      uncategorizedExpenseAccountId: "expense-sys",
      amount: new Decimal("1200.5"),
    });

    expect(entries[0].accountId).toBe("expense-sys");
    expect(entries[0].amount.toString()).toBe("1200.5");
    expect(entries[1].accountId).toBe("bank-1");
    expect(entries[1].amount.toString()).toBe("-1200.5");
    expect(sum(entries).isZero()).toBe(true);
  });
});

describe("buildTransferEntries", () => {
  it("debits the destination account and credits the source account", () => {
    const entries = buildTransferEntries({
      fromAccountId: "bank-1",
      toAccountId: "wallet-1",
      amount: new Decimal("2000"),
    });

    expect(entries[0].accountId).toBe("wallet-1");
    expect(entries[0].amount.toString()).toBe("2000");
    expect(entries[1].accountId).toBe("bank-1");
    expect(entries[1].amount.toString()).toBe("-2000");
    expect(sum(entries).isZero()).toBe(true);
  });
});

describe("buildCreditCardPurchaseEntries", () => {
  it("debits Uncategorized Expense and credits the credit card (increasing what is owed)", () => {
    const entries = buildCreditCardPurchaseEntries({
      creditCardAccountId: "cc-1",
      uncategorizedExpenseAccountId: "expense-sys",
      amount: new Decimal("999.99"),
    });

    expect(entries[0].accountId).toBe("expense-sys");
    expect(entries[0].amount.toString()).toBe("999.99");
    expect(entries[1].accountId).toBe("cc-1");
    expect(entries[1].amount.toString()).toBe("-999.99");
    expect(sum(entries).isZero()).toBe(true);
  });
});

describe("buildCreditCardPaymentEntries", () => {
  it("debits the credit card and credits the paying asset account (asset -> liability)", () => {
    const entries = buildCreditCardPaymentEntries({
      creditCardAccountId: "cc-1",
      fromAccountId: "bank-1",
      amount: new Decimal("5000"),
    });

    expect(entries[0].accountId).toBe("cc-1");
    expect(entries[0].amount.toString()).toBe("5000");
    expect(entries[1].accountId).toBe("bank-1");
    expect(entries[1].amount.toString()).toBe("-5000");
    expect(sum(entries).isZero()).toBe(true);
  });
});

describe("toEntriesPayload", () => {
  it("converts Decimal amounts to fixed 4-decimal DB strings", () => {
    const payload = toEntriesPayload([
      { accountId: "a", amount: new Decimal("500") },
      { accountId: "b", amount: new Decimal("-500") },
    ]);

    expect(payload).toEqual([
      { account_id: "a", amount: "500.0000", currency: "INR" },
      { account_id: "b", amount: "-500.0000", currency: "INR" },
    ]);
  });

  it("includes memo only when provided", () => {
    const payload = toEntriesPayload([
      { accountId: "a", amount: new Decimal("1"), memo: "note" },
      { accountId: "b", amount: new Decimal("-1") },
    ]);

    expect(payload[0]).toHaveProperty("memo", "note");
    expect(payload[1]).not.toHaveProperty("memo");
  });
});
