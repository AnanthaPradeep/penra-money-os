import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { addInvestmentValuationAction as AddInvestmentValuationAction } from "@/lib/investments/actions";

const addInvestmentValuationAction =
  vi.fn<typeof AddInvestmentValuationAction>();
vi.mock("@/lib/investments/actions", () => ({
  addInvestmentValuationAction: (
    ...args: Parameters<typeof AddInvestmentValuationAction>
  ) => addInvestmentValuationAction(...args),
}));

import { AddValuationForm } from "@/components/investments/AddValuationForm";

describe("AddValuationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts closed, requiring a deliberate trigger click", () => {
    render(<AddValuationForm holdingId="holding-1" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with a total-value field labelled as a manual estimate, never live/market", async () => {
    const user = userEvent.setup();
    render(<AddValuationForm holdingId="holding-1" />);

    await user.click(
      screen.getByRole("button", { name: "Add manual valuation" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Add a manual valuation" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never a live market price/)).toBeInTheDocument();
    expect(screen.getByLabelText("Total value")).toBeInTheDocument();
  });

  it("submits the holding id and entered value", async () => {
    addInvestmentValuationAction.mockResolvedValue({
      status: "success",
      message: "Manual valuation saved.",
    });
    const user = userEvent.setup();
    render(<AddValuationForm holdingId="holding-1" />);

    await user.click(
      screen.getByRole("button", { name: "Add manual valuation" }),
    );
    await user.type(screen.getByLabelText("Total value"), "5500");
    await user.click(screen.getByRole("button", { name: "Save valuation" }));

    await waitFor(() =>
      expect(addInvestmentValuationAction).toHaveBeenCalled(),
    );
    const call = addInvestmentValuationAction.mock.calls[0];
    if (!call) {
      throw new Error("addInvestmentValuationAction was not called");
    }
    const formData = call[1];
    expect(formData.get("holdingId")).toBe("holding-1");
    expect(formData.get("totalValue")).toBe("5500");
  });

  it("closes without submitting when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<AddValuationForm holdingId="holding-1" />);

    await user.click(
      screen.getByRole("button", { name: "Add manual valuation" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(addInvestmentValuationAction).not.toHaveBeenCalled();
  });
});
