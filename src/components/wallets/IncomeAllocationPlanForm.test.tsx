import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { saveIncomeAllocationPlanAction } from "@/lib/wallets/actions";

const saveIncomeAllocationPlanActionMock =
  vi.fn<typeof saveIncomeAllocationPlanAction>();
vi.mock("@/lib/wallets/actions", () => ({
  saveIncomeAllocationPlanAction: (
    ...args: Parameters<typeof saveIncomeAllocationPlanAction>
  ) => saveIncomeAllocationPlanActionMock(...args),
}));

import { IncomeAllocationPlanForm } from "@/components/wallets/IncomeAllocationPlanForm";

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
    await user.click(removeButtons[0]!);
    expect(screen.getAllByLabelText("Wallet")).toHaveLength(1);
  });
});
