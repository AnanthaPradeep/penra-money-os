import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/recurring/actions", () => ({
  recordOccurrencePaymentAction: vi.fn(),
  linkExistingTransactionAction: vi.fn(),
  skipOccurrenceAction: vi.fn(),
  retryFailedOccurrenceAction: vi.fn(),
}));
vi.mock("@/lib/payees/actions", () => ({
  createPayeeAction: vi.fn(),
}));

import { OccurrenceRow } from "@/components/recurring/OccurrenceRow";
import type {
  OccurrenceWithItem,
  RecurringItem,
} from "@/lib/recurring/mapping";
import { Decimal } from "@/lib/money/decimal";
import type { OccurrenceStatus, ProcessingMode } from "@/lib/recurring/types";

const ACCOUNTS = [
  {
    id: "acct-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "1000",
  },
];

const ITEM: RecurringItem = {
  id: "item-1",
  name: "Electricity bill",
  kind: "bill",
  amount: new Decimal(1500),
  currency: "INR",
  sourceAccountId: "acct-1",
  destinationAccountId: null,
  categoryId: "cat-1",
  payeeId: null,
  notes: null,
  startDate: "2026-01-01",
  endDate: null,
  frequency: "monthly",
  intervalCount: 1,
  nextDueDate: "2026-08-15",
  processingMode: "reminder_only",
  status: "active",
  trialEndDate: null,
  cancellationDate: null,
};

function occurrence(
  status: OccurrenceStatus,
  processingMode: ProcessingMode = "reminder_only",
): OccurrenceWithItem {
  return {
    id: "occ-1",
    recurringItemId: "item-1",
    scheduledDate: "2026-08-15",
    amount: new Decimal(1500),
    currency: "INR",
    status,
    linkedTransactionId: null,
    failureReason: null,
    processedAt: null,
    itemName: "Electricity bill",
    itemKind: "bill",
    processingMode,
  };
}

function renderRow(occ: OccurrenceWithItem, item: RecurringItem | undefined) {
  return render(
    <OccurrenceRow
      occurrence={occ}
      item={item}
      accounts={ACCOUNTS}
      incomeCategories={[]}
      expenseCategories={[{ id: "cat-1", name: "Utilities" }]}
      payees={[]}
      linkableTransactions={[]}
    />,
  );
}

describe("OccurrenceRow", () => {
  it("shows the item name, kind, scheduled date, amount, and status badge", () => {
    renderRow(occurrence("due"), ITEM);

    expect(
      screen.getByRole("link", { name: "Electricity bill" }),
    ).toHaveAttribute("href", "/app/recurring/item-1");
    expect(screen.getByText(/Bill/)).toBeInTheDocument();
    expect(screen.getByText("Due")).toBeInTheDocument();
  });

  it("offers Record payment, Link existing, and Skip for a due reminder-only occurrence", () => {
    renderRow(occurrence("due", "reminder_only"), ITEM);

    expect(
      screen.getByRole("button", { name: "Record payment" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Link existing" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
  });

  it("offers the same actions for an overdue reminder-only occurrence", () => {
    renderRow(occurrence("overdue", "reminder_only"), ITEM);

    expect(
      screen.getByRole("button", { name: "Record payment" }),
    ).toBeInTheDocument();
  });

  it("offers the same actions for an upcoming reminder-only occurrence", () => {
    renderRow(occurrence("upcoming", "reminder_only"), ITEM);

    expect(
      screen.getByRole("button", { name: "Record payment" }),
    ).toBeInTheDocument();
  });

  it("shows only a Retry button for a failed occurrence, regardless of processing mode", () => {
    renderRow(occurrence("failed", "auto_post"), ITEM);

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Record payment" }),
    ).not.toBeInTheDocument();
  });

  it("offers no manual actions for a due auto_post occurrence (the processor handles it)", () => {
    renderRow(occurrence("due", "auto_post"), ITEM);

    expect(
      screen.queryByRole("button", { name: "Record payment" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Link existing" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Skip" }),
    ).not.toBeInTheDocument();
  });

  it("offers no actions for an already-posted occurrence", () => {
    renderRow(occurrence("posted", "reminder_only"), ITEM);

    expect(
      screen.queryByRole("button", { name: "Record payment" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Skip" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Posted")).toBeInTheDocument();
  });

  it("offers no actions when the parent item is unavailable", () => {
    renderRow(occurrence("due", "reminder_only"), undefined);

    expect(
      screen.queryByRole("button", { name: "Record payment" }),
    ).not.toBeInTheDocument();
  });
});
