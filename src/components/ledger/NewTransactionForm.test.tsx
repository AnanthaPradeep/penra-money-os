import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ledger/actions", () => ({
  createIncomeTransactionAction: vi.fn(),
  createExpenseTransactionAction: vi.fn(),
  createTransferTransactionAction: vi.fn(),
  createCreditCardPurchaseAction: vi.fn(),
  createCreditCardPaymentAction: vi.fn(),
}));

import { NewTransactionForm } from "@/components/ledger/NewTransactionForm";

const ACCOUNTS = [
  {
    id: "acct-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "1000",
  },
  {
    id: "cc-1",
    name: "ICICI Platinum",
    accountType: "credit_card",
    displayBalance: "-2000",
  },
];

describe("NewTransactionForm", () => {
  it("defaults to the expense form", () => {
    render(<NewTransactionForm accounts={ACCOUNTS} />);

    expect(screen.getByLabelText("Paid from")).toBeInTheDocument();
  });

  it("exposes the transaction type switcher as an accessible radiogroup", () => {
    render(<NewTransactionForm accounts={ACCOUNTS} />);

    expect(
      screen.getByRole("radiogroup", { name: "Transaction type" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Expense" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("switches to the income form", async () => {
    const user = userEvent.setup();
    render(<NewTransactionForm accounts={ACCOUNTS} />);

    await user.click(screen.getByRole("radio", { name: "Income" }));

    expect(screen.getByLabelText("Deposit into")).toBeInTheDocument();
    expect(screen.queryByLabelText("Paid from")).not.toBeInTheDocument();
  });

  it("switches to the transfer form", async () => {
    const user = userEvent.setup();
    render(<NewTransactionForm accounts={ACCOUNTS} />);

    await user.click(screen.getByRole("radio", { name: "Transfer" }));

    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });

  it("switches to the credit card purchase form, passing only credit card accounts", async () => {
    const user = userEvent.setup();
    render(<NewTransactionForm accounts={ACCOUNTS} />);

    await user.click(
      screen.getByRole("radio", { name: "Credit card purchase" }),
    );

    expect(screen.getByLabelText("Credit card")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /ICICI Platinum/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /HDFC Savings/ }),
    ).not.toBeInTheDocument();
  });

  it("switches to the credit card payment form", async () => {
    const user = userEvent.setup();
    render(<NewTransactionForm accounts={ACCOUNTS} />);

    await user.click(
      screen.getByRole("radio", { name: "Credit card payment" }),
    );

    expect(screen.getByLabelText("Credit card")).toBeInTheDocument();
    expect(screen.getByLabelText("Paid from")).toBeInTheDocument();
  });

  it("supports arrow-key navigation between transaction types", async () => {
    const user = userEvent.setup();
    render(<NewTransactionForm accounts={ACCOUNTS} />);

    const expenseRadio = screen.getByRole("radio", { name: "Expense" });
    expenseRadio.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Transfer" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
