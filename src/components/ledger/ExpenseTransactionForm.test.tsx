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

import { ExpenseTransactionForm } from "@/components/ledger/ExpenseTransactionForm";

const ACCOUNTS = [
  {
    id: "acct-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "1000",
  },
];

describe("ExpenseTransactionForm", () => {
  it("renders every required field", () => {
    render(<ExpenseTransactionForm accounts={ACCOUNTS} />);

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
    render(<ExpenseTransactionForm accounts={ACCOUNTS} />);

    await user.click(screen.getByRole("button", { name: "Record expense" }));

    expect(
      await screen.findByText("Choose a valid account."),
    ).toBeInTheDocument();
  });
});
