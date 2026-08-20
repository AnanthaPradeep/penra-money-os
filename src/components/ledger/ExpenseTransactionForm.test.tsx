import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { createExpenseTransactionAction } from "@/lib/ledger/actions";

const createExpenseTransactionActionMock =
  vi.fn<typeof createExpenseTransactionAction>();
vi.mock("@/lib/ledger/actions", () => ({
  createExpenseTransactionAction: (
    ...args: Parameters<typeof createExpenseTransactionAction>
  ) => createExpenseTransactionActionMock(...args),
}));

// PayeeCombobox (rendered by this form) imports createPayeeAction, which
// transitively imports the server-only Supabase client factory — mock it
// out so that real chain never loads in this jsdom test.
vi.mock("@/lib/payees/actions", () => ({
  createPayeeAction: vi.fn(),
}));

import { ExpenseTransactionForm } from "@/components/ledger/ExpenseTransactionForm";

const ACCOUNTS = [
  {
    id: "acct-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "1000",
  },
];
const CATEGORIES: never[] = [];
const PAYEES: never[] = [];
const IDEMPOTENCY_KEY = "test-idempotency-key";

describe("ExpenseTransactionForm", () => {
  it("renders every required field", () => {
    render(
      <ExpenseTransactionForm
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        idempotencyKey={IDEMPOTENCY_KEY}
      />,
    );

    expect(screen.getByLabelText("Paid from")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("shows a field error returned by the Server Action", async () => {
    createExpenseTransactionActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { fromAccountId: "Choose a valid account." },
    });

    const user = userEvent.setup();
    render(
      <ExpenseTransactionForm
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        idempotencyKey={IDEMPOTENCY_KEY}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Record expense" }));

    expect(
      await screen.findByText("Choose a valid account."),
    ).toBeInTheDocument();
  });
});
