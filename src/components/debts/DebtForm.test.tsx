import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { createDebtAction } from "@/lib/debts/actions";

const createDebtActionMock = vi.fn<typeof createDebtAction>();
vi.mock("@/lib/debts/actions", () => ({
  createDebtAction: (...args: Parameters<typeof createDebtAction>) =>
    createDebtActionMock(...args),
}));

import { DebtForm } from "@/components/debts/DebtForm";

const LIABILITY_ACCOUNTS = [
  { id: "acct-1", name: "HDFC Credit Card" },
  { id: "acct-2", name: "Home Loan" },
];

describe("DebtForm", () => {
  it("shows a fallback message instead of a form when there are no liability accounts", () => {
    render(<DebtForm liabilityAccounts={[]} />);

    expect(
      screen.getByText(/create a liability account/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("renders the core debt fields, each debt mapped to exactly one liability account", () => {
    render(<DebtForm liabilityAccounts={LIABILITY_ACCOUNTS} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Debt type")).toBeInTheDocument();
    expect(screen.getByLabelText("Liability account")).toBeInTheDocument();
    expect(screen.getByLabelText("Original principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
  });

  it("lists every liability account as a choosable option", () => {
    render(<DebtForm liabilityAccounts={LIABILITY_ACCOUNTS} />);

    const select = screen.getByLabelText("Liability account");
    expect(
      screen.getByRole("option", { name: "HDFC Credit Card" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Home Loan" }),
    ).toBeInTheDocument();
    expect(select).toHaveValue("");
  });

  it("defaults the interest method to reducing balance and frequency to monthly", () => {
    render(<DebtForm liabilityAccounts={LIABILITY_ACCOUNTS} />);

    expect(screen.getByLabelText("Interest method")).toHaveValue(
      "reducing_balance",
    );
    expect(screen.getByLabelText("Payment frequency")).toHaveValue("monthly");
  });

  it("never pre-fills an interest rate, so 0% is a deliberate entry rather than a guessed default", () => {
    render(<DebtForm liabilityAccounts={LIABILITY_ACCOUNTS} />);

    expect(screen.getByLabelText("Annual interest rate (%)")).toHaveValue("");
  });

  it("submits the entered values through the create-debt action", async () => {
    createDebtActionMock.mockResolvedValue({
      status: "success",
      message: "Debt created.",
    });
    const user = userEvent.setup();
    render(<DebtForm liabilityAccounts={LIABILITY_ACCOUNTS} />);

    await user.type(screen.getByLabelText("Name"), "Car loan");
    await user.selectOptions(screen.getByLabelText("Debt type"), "vehicle_loan");
    await user.selectOptions(
      screen.getByLabelText("Liability account"),
      "Home Loan",
    );
    await user.type(screen.getByLabelText("Original principal"), "500000");
    await user.type(screen.getByLabelText("Start date"), "2026-04-01");
    await user.click(screen.getByRole("button", { name: "Create debt" }));

    expect(createDebtActionMock).toHaveBeenCalledTimes(1);
    const [, formData] = createDebtActionMock.mock.calls[0]!;
    expect(formData.get("name")).toBe("Car loan");
    expect(formData.get("debtType")).toBe("vehicle_loan");
    expect(formData.get("liabilityAccountId")).toBe("acct-2");
    expect(formData.get("originalPrincipal")).toBe("500000");
    expect(formData.get("currency")).toBe("INR");
  });
});
