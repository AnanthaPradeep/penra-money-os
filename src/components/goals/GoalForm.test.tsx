import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { createFinancialGoalAction } from "@/lib/goals/actions";

const createFinancialGoalActionMock = vi.fn<typeof createFinancialGoalAction>();
vi.mock("@/lib/goals/actions", () => ({
  createFinancialGoalAction: (
    ...args: Parameters<typeof createFinancialGoalAction>
  ) => createFinancialGoalActionMock(...args),
}));

import { GoalForm } from "@/components/goals/GoalForm";

describe("GoalForm", () => {
  it("renders the core goal fields", () => {
    render(<GoalForm wallets={[]} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Goal type")).toBeInTheDocument();
    expect(screen.getByLabelText("Target amount")).toBeInTheDocument();
  });

  it("hides emergency-fund and sinking-fund fields for a custom goal by default", () => {
    render(<GoalForm wallets={[]} />);

    expect(screen.queryByLabelText("Target method")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Contribution frequency"),
    ).not.toBeInTheDocument();
  });

  it("shows emergency-fund target-method fields once that goal type is chosen", async () => {
    const user = userEvent.setup();
    render(<GoalForm wallets={[]} />);

    await user.selectOptions(
      screen.getByLabelText("Goal type"),
      "Emergency fund",
    );

    expect(screen.getByLabelText("Target method")).toBeInTheDocument();
  });

  it("shows the months-of-expenses fields only once that method is selected", async () => {
    const user = userEvent.setup();
    render(<GoalForm wallets={[]} />);

    await user.selectOptions(
      screen.getByLabelText("Goal type"),
      "Emergency fund",
    );
    expect(
      screen.queryByLabelText("Months of expenses"),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Target method"),
      "A number of months of essential expenses",
    );

    expect(screen.getByLabelText("Months of expenses")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Your confirmed essential monthly expense"),
    ).toBeInTheDocument();
  });

  it("shows the sinking-fund contribution frequency once that goal type is chosen", async () => {
    const user = userEvent.setup();
    render(<GoalForm wallets={[]} />);

    await user.selectOptions(
      screen.getByLabelText("Goal type"),
      "Sinking fund",
    );

    expect(screen.getByLabelText("Contribution frequency")).toBeInTheDocument();
  });

  it("locks the goal type to a fixed value and hides the picker when defaultGoalType is given", () => {
    render(<GoalForm wallets={[]} defaultGoalType="emergency_fund" />);

    expect(screen.queryByLabelText("Goal type")).not.toBeInTheDocument();
    expect(screen.getByText("Emergency fund")).toBeInTheDocument();
    expect(screen.getByLabelText("Target method")).toBeInTheDocument();
  });

  it("lists given wallets in the linked-wallet select", () => {
    render(<GoalForm wallets={[{ id: "w1", name: "Travel wallet" }]} />);

    expect(
      screen.getByRole("option", { name: "Travel wallet" }),
    ).toBeInTheDocument();
  });
});
