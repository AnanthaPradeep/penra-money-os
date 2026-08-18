import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { createCreditCardPurchaseAction } from "@/lib/ledger/actions";

const createCreditCardPurchaseActionMock =
  vi.fn<typeof createCreditCardPurchaseAction>();
vi.mock("@/lib/ledger/actions", () => ({
  createCreditCardPurchaseAction: (
    ...args: Parameters<typeof createCreditCardPurchaseAction>
  ) => createCreditCardPurchaseActionMock(...args),
}));

import { CreditCardPurchaseForm } from "@/components/ledger/CreditCardPurchaseForm";

const CREDIT_CARD_ACCOUNTS = [
  {
    id: "cc-1",
    name: "ICICI Platinum",
    accountType: "credit_card",
    displayBalance: "-2000",
  },
];

describe("CreditCardPurchaseForm", () => {
  it("renders the credit card select and every required field", () => {
    render(
      <CreditCardPurchaseForm creditCardAccounts={CREDIT_CARD_ACCOUNTS} />,
    );

    expect(screen.getByLabelText("Credit card")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("shows a helpful message instead of a form when there are no credit card accounts", () => {
    render(<CreditCardPurchaseForm creditCardAccounts={[]} />);

    expect(
      screen.getByText("You don't have any credit card accounts yet."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Credit card")).not.toBeInTheDocument();
  });

  it("shows a field error returned by the Server Action", async () => {
    createCreditCardPurchaseActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { amount: "Amount must be greater than zero." },
    });

    const user = userEvent.setup();
    render(
      <CreditCardPurchaseForm creditCardAccounts={CREDIT_CARD_ACCOUNTS} />,
    );

    await user.click(screen.getByRole("button", { name: "Record purchase" }));

    expect(
      await screen.findByText("Amount must be greater than zero."),
    ).toBeInTheDocument();
  });
});
