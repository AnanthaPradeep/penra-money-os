import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { matureFixedDepositAction as MatureFixedDepositAction } from "@/lib/investments/actions";

const matureFixedDepositAction = vi.fn<typeof MatureFixedDepositAction>();
vi.mock("@/lib/investments/actions", () => ({
  matureFixedDepositAction: (
    ...args: Parameters<typeof MatureFixedDepositAction>
  ) => matureFixedDepositAction(...args),
}));

import { MatureFixedDepositDialog } from "@/components/investments/MatureFixedDepositDialog";

const ACCOUNTS = [
  {
    id: "bank-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "50000",
  },
];

describe("MatureFixedDepositDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the expected maturity amount as a labelled estimate, not a guarantee", async () => {
    const user = userEvent.setup();
    render(
      <MatureFixedDepositDialog
        holdingId="holding-1"
        accounts={ACCOUNTS}
        expectedMaturityAmount="107500"
        idempotencyKey="11111111-1111-4111-8111-111111111111"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark matured" }));

    expect(screen.getByText(/Expected:/)).toBeInTheDocument();
    expect(screen.getByText(/can only be done once/)).toBeInTheDocument();
    expect(screen.getByLabelText("Actual amount received")).toBeInTheDocument();
  });

  it("submits the holding id and actual amount received", async () => {
    matureFixedDepositAction.mockResolvedValue({
      status: "success",
      message: "Marked as matured.",
    });
    const user = userEvent.setup();
    render(
      <MatureFixedDepositDialog
        holdingId="holding-1"
        accounts={ACCOUNTS}
        expectedMaturityAmount="107500"
        idempotencyKey="11111111-1111-4111-8111-111111111111"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark matured" }));
    await user.selectOptions(screen.getByLabelText("Received into"), "bank-1");
    await user.type(screen.getByLabelText("Actual amount received"), "108000");
    await user.click(screen.getByRole("button", { name: "Confirm maturity" }));

    await waitFor(() => expect(matureFixedDepositAction).toHaveBeenCalled());
    const call = matureFixedDepositAction.mock.calls[0];
    if (!call) {
      throw new Error("matureFixedDepositAction was not called");
    }
    const formData = call[1];
    expect(formData.get("holdingId")).toBe("holding-1");
    expect(formData.get("actualMaturityAmount")).toBe("108000");
    expect(formData.get("receivingAccountId")).toBe("bank-1");
  });

  it("shows an error message when maturing fails (e.g. already matured)", async () => {
    matureFixedDepositAction.mockResolvedValue({
      status: "error",
      message: "This has already matured.",
    });
    const user = userEvent.setup();
    render(
      <MatureFixedDepositDialog
        holdingId="holding-1"
        accounts={ACCOUNTS}
        expectedMaturityAmount={null}
        idempotencyKey="11111111-1111-4111-8111-111111111111"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark matured" }));
    await user.selectOptions(screen.getByLabelText("Received into"), "bank-1");
    await user.type(screen.getByLabelText("Actual amount received"), "108000");
    await user.click(screen.getByRole("button", { name: "Confirm maturity" }));

    expect(
      await screen.findByText("This has already matured."),
    ).toBeInTheDocument();
  });
});
