import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { recordInvestmentActivityAction as RecordInvestmentActivityAction } from "@/lib/investments/actions";

const recordInvestmentActivityAction =
  vi.fn<typeof RecordInvestmentActivityAction>();
vi.mock("@/lib/investments/actions", () => ({
  recordInvestmentActivityAction: (
    ...args: Parameters<typeof RecordInvestmentActivityAction>
  ) => recordInvestmentActivityAction(...args),
}));
vi.mock("@/lib/payees/actions", () => ({
  createPayeeAction: vi.fn(),
}));

import { ActivityComposer } from "@/components/investments/ActivityComposer";

const ACCOUNTS = [
  {
    id: "bank-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "50000",
  },
];
const INCOME_CATEGORIES = [{ id: "cat-inc-1", name: "Dividends" }];
const EXPENSE_CATEGORIES = [{ id: "cat-exp-1", name: "Brokerage fees" }];

function renderComposer(
  overrides: Partial<ComponentProps<typeof ActivityComposer>> = {},
) {
  return render(
    <ActivityComposer
      holdingId="holding-1"
      supportedKinds={[
        "buy",
        "sell",
        "dividend",
        "interest",
        "fee",
        "adjustment",
      ]}
      accounts={ACCOUNTS}
      incomeCategories={INCOME_CATEGORIES}
      expenseCategories={EXPENSE_CATEGORIES}
      payees={[]}
      idempotencyKey="11111111-1111-4111-8111-111111111111"
      availableQuantity="20"
      availableBalance="3010"
      {...overrides}
    />,
  );
}

describe("ActivityComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to the first supported kind, showing that kind's fields", () => {
    renderComposer();

    expect(screen.getByLabelText("Paid from")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
    expect(screen.getByLabelText("Unit price")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Record buy" }),
    ).toBeInTheDocument();
  });

  it("only shows activity kinds the holding's asset kind supports", () => {
    renderComposer({
      supportedKinds: ["contribution", "withdrawal", "fee", "adjustment"],
    });

    expect(
      screen.queryByRole("radio", { name: "Buy" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Sell" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Contribution" }),
    ).toBeInTheDocument();
  });

  it("switches to sell, showing quantity/unit price/fee/tax fields and a proceeds account", async () => {
    const user = userEvent.setup();
    const { container } = renderComposer();

    await user.click(screen.getByRole("radio", { name: "Sell" }));

    expect(screen.getByLabelText("Proceeds to")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax (optional)")).toBeInTheDocument();
    expect(container.textContent?.replace(/\s+/g, " ")).toContain(
      "Currently held: 20 units",
    );
  });

  it("switches to dividend, requiring an income category and dropping quantity/price fields", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole("radio", { name: "Dividend" }));

    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Received into")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantity")).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Dividends" }),
    ).toBeInTheDocument();
  });

  it("switches to fee, showing an optional expense category and paid-from account", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole("radio", { name: "Fee" }));

    expect(screen.getByLabelText("Category (optional)")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Brokerage fees" }),
    ).toBeInTheDocument();
  });

  it("switches to adjustment, requiring an explanation and offering signed deltas", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole("radio", { name: "Adjustment" }));

    expect(screen.getByLabelText("Explanation")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Quantity delta (optional)"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Cost basis delta (optional)"),
    ).toBeInTheDocument();
  });

  it("submits a buy with the holding id, activity kind, and idempotency key as hidden fields", async () => {
    recordInvestmentActivityAction.mockResolvedValue({
      status: "success",
      message: "Activity recorded.",
    });
    const user = userEvent.setup();
    renderComposer();

    await user.selectOptions(screen.getByLabelText("Paid from"), "bank-1");
    await user.type(screen.getByLabelText("Quantity"), "5");
    await user.type(screen.getByLabelText("Unit price"), "100");
    await user.click(screen.getByRole("button", { name: "Record buy" }));

    await waitFor(() =>
      expect(recordInvestmentActivityAction).toHaveBeenCalled(),
    );
    const call = recordInvestmentActivityAction.mock.calls[0];
    if (!call) {
      throw new Error("recordInvestmentActivityAction was not called");
    }
    const formData = call[1];
    expect(formData.get("holdingId")).toBe("holding-1");
    expect(formData.get("activityKind")).toBe("buy");
    expect(formData.get("idempotencyKey")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(formData.get("quantity")).toBe("5");
    expect(formData.get("unitPrice")).toBe("100");
    expect(formData.get("fundingAccountId")).toBe("bank-1");
  });

  it("disables the submit button for sell when nothing is currently held", async () => {
    const user = userEvent.setup();
    renderComposer({ availableQuantity: "0" });

    await user.click(screen.getByRole("radio", { name: "Sell" }));

    expect(screen.getByRole("button", { name: "Record sell" })).toBeDisabled();
  });
});
