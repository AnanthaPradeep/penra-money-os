import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/investments/actions", () => ({
  createInvestmentHoldingAction: vi.fn(),
  createPpfAccountAction: vi.fn(),
  createFixedDepositAction: vi.fn(),
  createRecurringDepositAction: vi.fn(),
}));

import { NewInvestmentForm } from "@/components/investments/NewInvestmentForm";

const INVESTMENT_ACCOUNTS = [
  {
    id: "inv-1",
    name: "Zerodha Demat",
    accountType: "investment",
    displayBalance: "0",
  },
];
const FUNDING_ACCOUNTS = [
  {
    id: "bank-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "50000",
  },
];

function renderForm() {
  return render(
    <NewInvestmentForm
      investmentAccounts={INVESTMENT_ACCOUNTS}
      fundingAccounts={FUNDING_ACCOUNTS}
      fixedDepositIdempotencyKey="11111111-1111-4111-8111-111111111111"
      ppfOpeningContributionIdempotencyKey="22222222-2222-4222-8222-222222222222"
    />,
  );
}

describe("NewInvestmentForm", () => {
  it("defaults to the stock form", () => {
    renderForm();

    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "placeholder",
      "e.g. HDFC Bank Ltd",
    );
    expect(
      screen.getByRole("button", { name: "Create stock holding" }),
    ).toBeInTheDocument();
  });

  it("exposes the kind switcher as an accessible radiogroup", () => {
    renderForm();

    expect(
      screen.getByRole("radiogroup", { name: "What are you tracking?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Stock" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("switches to the mutual fund form, showing a scheme code field instead of symbol/exchange", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "Mutual fund" }));

    expect(
      screen.getByRole("button", { name: "Create mutual fund holding" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Scheme code (optional)")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Symbol (optional)"),
    ).not.toBeInTheDocument();
  });

  it("switches to the PPF form, showing an opening-contribution fieldset", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "PPF" }));

    expect(
      screen.getByRole("button", { name: "Create PPF account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Opening contribution (optional)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Investment account")).toBeInTheDocument();
  });

  it("switches to the fixed deposit form, requiring principal, dates, and a funding account", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "Fixed deposit" }));

    expect(
      screen.getByRole("button", { name: "Create fixed deposit" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Funded from")).toBeInTheDocument();
    expect(screen.getByLabelText("Maturity date")).toBeInTheDocument();
  });

  it("switches to the recurring deposit form, showing installment and frequency fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "Recurring deposit" }));

    expect(
      screen.getByRole("button", { name: "Create recurring deposit" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Installment amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Frequency")).toBeInTheDocument();
    expect(
      screen.getByLabelText("How should installments be handled?"),
    ).toBeInTheDocument();
  });

  it("switches to the other-investment form", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "Other investment" }));

    expect(
      screen.getByRole("button", { name: "Create holding" }),
    ).toBeInTheDocument();
  });
});
