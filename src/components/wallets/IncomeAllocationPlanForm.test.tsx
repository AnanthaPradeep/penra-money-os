import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import { assertDefined } from "@/test/assert";
import type { saveIncomeAllocationPlanAction } from "@/lib/wallets/actions";

const saveIncomeAllocationPlanActionMock =
  vi.fn<typeof saveIncomeAllocationPlanAction>();
vi.mock("@/lib/wallets/actions", () => ({
  saveIncomeAllocationPlanAction: (
    ...args: Parameters<typeof saveIncomeAllocationPlanAction>
  ) => saveIncomeAllocationPlanActionMock(...args),
}));

import { IncomeAllocationPlanForm } from "@/components/wallets/IncomeAllocationPlanForm";

beforeEach(() => {
  vi.clearAllMocks();
});

const WALLETS = [
  { id: "w1", name: "Groceries" },
  { id: "w2", name: "Travel" },
];

describe("IncomeAllocationPlanForm", () => {
  it("shows a fallback message instead of a form when there are no wallets", () => {
    render(<IncomeAllocationPlanForm wallets={[]} />);
    expect(screen.getByText(/create at least one wallet/i)).toBeInTheDocument();
  });

  it("shows a percentage field per line by default (percentage mode)", () => {
    render(<IncomeAllocationPlanForm wallets={WALLETS} />);
    expect(screen.getByLabelText("Percentage")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fixed amount")).not.toBeInTheDocument();
  });

  it("switches to showing a fixed-amount field in fixed_amount mode", async () => {
    const user = userEvent.setup();
    render(<IncomeAllocationPlanForm wallets={WALLETS} />);

    await user.selectOptions(
      screen.getByLabelText("Allocation mode"),
      "Fixed amount — a set amount per wallet",
    );

    expect(screen.queryByLabelText("Percentage")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Fixed amount")).toBeInTheDocument();
  });

  it("shows both fields in hybrid mode", async () => {
    const user = userEvent.setup();
    render(<IncomeAllocationPlanForm wallets={WALLETS} />);

    await user.selectOptions(
      screen.getByLabelText("Allocation mode"),
      "Hybrid — fixed amounts first, then percentages of what's left",
    );

    expect(screen.getByLabelText("Percentage")).toBeInTheDocument();
    expect(screen.getByLabelText("Fixed amount")).toBeInTheDocument();
  });

  it("adds a new line when 'Add line' is clicked", async () => {
    const user = userEvent.setup();
    render(<IncomeAllocationPlanForm wallets={WALLETS} />);

    expect(screen.getAllByLabelText("Wallet")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(screen.getAllByLabelText("Wallet")).toHaveLength(2);
  });

  it("removes a line when its remove button is clicked, but never below one line", async () => {
    const user = userEvent.setup();
    render(<IncomeAllocationPlanForm wallets={WALLETS} />);

    const removeButton = screen.getByRole("button", { name: "Remove line" });
    expect(removeButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Add line" }));
    const removeButtons = screen.getAllByRole("button", {
      name: "Remove line",
    });
    expect(removeButtons[0]).not.toBeDisabled();
    await user.click(assertDefined(removeButtons[0]));
    expect(screen.getAllByLabelText("Wallet")).toHaveLength(1);
  });

  it("always renders the optional trigger-field selects, even with no candidates", () => {
    render(<IncomeAllocationPlanForm wallets={WALLETS} />);

    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Payee")).toBeInTheDocument();
    expect(screen.getByLabelText("Account")).toBeInTheDocument();
  });

  it("pre-fills an edit form from an existing plan, including trigger fields", () => {
    render(
      <IncomeAllocationPlanForm
        wallets={WALLETS}
        categories={[{ id: "cat-1", name: "Salary" }]}
        editingPlan={{
          id: "plan-1",
          name: "Salary split",
          allocationMode: "percentage",
          triggerCategoryId: "cat-1",
          triggerPayeeId: null,
          triggerAccountId: null,
          currency: "INR",
          effectiveDate: "2026-04-01",
          endDate: null,
          status: "active",
        }}
        editingLines={[
          {
            id: "line-1",
            planId: "plan-1",
            walletId: "w1",
            lineOrder: 0,
            percentage: new Decimal(100),
            fixedAmount: null,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Edit Salary split" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Plan name")).toHaveValue("Salary split");
    expect(screen.getByLabelText("Category")).toHaveValue("cat-1");
  });
});
