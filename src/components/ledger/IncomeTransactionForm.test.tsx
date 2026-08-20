import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { createIncomeTransactionAction } from "@/lib/ledger/actions";

const createIncomeTransactionActionMock =
  vi.fn<typeof createIncomeTransactionAction>();
vi.mock("@/lib/ledger/actions", () => ({
  createIncomeTransactionAction: (
    ...args: Parameters<typeof createIncomeTransactionAction>
  ) => createIncomeTransactionActionMock(...args),
}));

// PayeeCombobox (rendered by this form) imports createPayeeAction, which
// transitively imports the server-only Supabase client factory — mock it
// out so that real chain never loads in this jsdom test.
vi.mock("@/lib/payees/actions", () => ({
  createPayeeAction: vi.fn(),
}));

import { IncomeTransactionForm } from "@/components/ledger/IncomeTransactionForm";

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

describe("IncomeTransactionForm", () => {
  it("renders every required field", () => {
    render(
      <IncomeTransactionForm
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        idempotencyKey={IDEMPOTENCY_KEY}
      />,
    );

    expect(screen.getByLabelText("Deposit into")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("lists the given accounts with their formatted balance", () => {
    render(
      <IncomeTransactionForm
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        idempotencyKey={IDEMPOTENCY_KEY}
      />,
    );

    expect(
      screen.getByRole("option", { name: /HDFC Savings.*₹1,000\.00/ }),
    ).toBeInTheDocument();
  });

  it("shows a field error returned by the Server Action", async () => {
    createIncomeTransactionActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { amount: "Amount must be greater than zero." },
    });

    const user = userEvent.setup();
    render(
      <IncomeTransactionForm
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        idempotencyKey={IDEMPOTENCY_KEY}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Record income" }));

    expect(
      await screen.findByText("Amount must be greater than zero."),
    ).toBeInTheDocument();
  });

  it("shows a safe error message, never a raw database error", async () => {
    createIncomeTransactionActionMock.mockResolvedValue({
      status: "error",
      message: "We couldn't record that transaction. Please try again.",
    });

    const user = userEvent.setup();
    render(
      <IncomeTransactionForm
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        idempotencyKey={IDEMPOTENCY_KEY}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Record income" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/postgres|sql|constraint/i);
  });
});
