import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { createCreditCardPaymentAction } from "@/lib/ledger/actions";

const createCreditCardPaymentActionMock =
  vi.fn<typeof createCreditCardPaymentAction>();
vi.mock("@/lib/ledger/actions", () => ({
  createCreditCardPaymentAction: (
    ...args: Parameters<typeof createCreditCardPaymentAction>
  ) => createCreditCardPaymentActionMock(...args),
}));

import { CreditCardPaymentForm } from "@/components/ledger/CreditCardPaymentForm";

const CREDIT_CARD_ACCOUNTS = [
  {
    id: "cc-1",
    name: "ICICI Platinum",
    accountType: "credit_card",
    displayBalance: "-2000",
  },
];
const FROM_ACCOUNTS = [
  {
    id: "acct-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "5000",
  },
  ...CREDIT_CARD_ACCOUNTS,
];

describe("CreditCardPaymentForm", () => {
  it("renders both selects and every required field", () => {
    render(
      <CreditCardPaymentForm
        creditCardAccounts={CREDIT_CARD_ACCOUNTS}
        fromAccounts={FROM_ACCOUNTS}
      />,
    );

    expect(screen.getByLabelText("Credit card")).toBeInTheDocument();
    expect(screen.getByLabelText("Paid from")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  });

  it("excludes credit card accounts from the 'Paid from' select", () => {
    render(
      <CreditCardPaymentForm
        creditCardAccounts={CREDIT_CARD_ACCOUNTS}
        fromAccounts={FROM_ACCOUNTS}
      />,
    );

    const fromSelect = screen.getByLabelText("Paid from");
    expect(fromSelect).toHaveTextContent("HDFC Savings");
    expect(fromSelect).not.toHaveTextContent("ICICI Platinum");
  });

  it("shows a helpful message instead of a form when there are no credit card accounts", () => {
    render(
      <CreditCardPaymentForm
        creditCardAccounts={[]}
        fromAccounts={FROM_ACCOUNTS}
      />,
    );

    expect(
      screen.getByText("You don't have any credit card accounts yet."),
    ).toBeInTheDocument();
  });

  it("shows a field error returned by the Server Action", async () => {
    createCreditCardPaymentActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { fromAccountId: "Choose two different accounts." },
    });

    const user = userEvent.setup();
    render(
      <CreditCardPaymentForm
        creditCardAccounts={CREDIT_CARD_ACCOUNTS}
        fromAccounts={FROM_ACCOUNTS}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(
      await screen.findByText("Choose two different accounts."),
    ).toBeInTheDocument();
  });
});
