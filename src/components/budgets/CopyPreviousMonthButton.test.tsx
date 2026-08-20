import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { copyBudgetPeriodAction as CopyBudgetPeriodAction } from "@/lib/budgets/actions";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const copyBudgetPeriodAction = vi.fn<typeof CopyBudgetPeriodAction>();
vi.mock("@/lib/budgets/actions", () => ({
  copyBudgetPeriodAction: (
    ...args: Parameters<typeof CopyBudgetPeriodAction>
  ) => copyBudgetPeriodAction(...args),
}));

import { CopyPreviousMonthButton } from "@/components/budgets/CopyPreviousMonthButton";

describe("CopyPreviousMonthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls copyBudgetPeriodAction with the source and target months, then refreshes on success", async () => {
    copyBudgetPeriodAction.mockResolvedValue({
      status: "success",
      message: "Copied",
    });
    const user = userEvent.setup();

    render(
      <CopyPreviousMonthButton
        sourcePeriodMonth="2026-07"
        targetPeriodMonth="2026-08"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Copy previous month" }),
    );

    await waitFor(() => expect(copyBudgetPeriodAction).toHaveBeenCalled());
    const call = copyBudgetPeriodAction.mock.calls[0];
    if (!call) {
      throw new Error("copyBudgetPeriodAction was not called");
    }
    const formData = call[1];
    expect(formData.get("sourcePeriodMonth")).toBe("2026-07");
    expect(formData.get("targetPeriodMonth")).toBe("2026-08");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("shows an error message and does not refresh when the copy fails", async () => {
    copyBudgetPeriodAction.mockResolvedValue({
      status: "error",
      message: "Nothing to copy from last month",
    });
    const user = userEvent.setup();

    render(
      <CopyPreviousMonthButton
        sourcePeriodMonth="2026-07"
        targetPeriodMonth="2026-08"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Copy previous month" }),
    );

    expect(
      await screen.findByText("Nothing to copy from last month"),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
