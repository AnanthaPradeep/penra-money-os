import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "@/test/assert";
import type { createPurposeWalletAction } from "@/lib/wallets/actions";

const createPurposeWalletActionMock = vi.fn<typeof createPurposeWalletAction>();
vi.mock("@/lib/wallets/actions", () => ({
  createPurposeWalletAction: (
    ...args: Parameters<typeof createPurposeWalletAction>
  ) => createPurposeWalletActionMock(...args),
}));

import { CreateWalletDialog } from "@/components/wallets/CreateWalletDialog";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateWalletDialog", () => {
  it("keeps the form closed until the trigger is clicked", () => {
    render(<CreateWalletDialog />);

    expect(
      screen.getByRole("button", { name: "New wallet" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("shows the core fields once opened, defaulting to earmarked funding", async () => {
    const user = userEvent.setup();
    render(<CreateWalletDialog />);

    await user.click(screen.getByRole("button", { name: "New wallet" }));

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Funding mode")).toHaveValue("earmarked");
    expect(
      screen.getByLabelText("Target amount (optional)"),
    ).toBeInTheDocument();
  });

  it("submits the entered values through the create-wallet action", async () => {
    createPurposeWalletActionMock.mockResolvedValue({
      status: "success",
      message: "Wallet created.",
    });
    const user = userEvent.setup();
    render(<CreateWalletDialog />);

    await user.click(screen.getByRole("button", { name: "New wallet" }));
    await user.type(screen.getByLabelText("Name"), "Travel");
    await user.selectOptions(
      screen.getByLabelText("Funding mode"),
      "Planning only — no real money set aside yet",
    );
    await user.type(screen.getByLabelText("Target amount (optional)"), "50000");
    await user.click(screen.getByRole("button", { name: "Create wallet" }));

    expect(createPurposeWalletActionMock).toHaveBeenCalledTimes(1);
    const [, formData] = assertDefined(
      createPurposeWalletActionMock.mock.calls[0],
    );
    expect(formData.get("name")).toBe("Travel");
    expect(formData.get("fundingMode")).toBe("planning_only");
    expect(formData.get("targetAmount")).toBe("50000");
    expect(formData.get("currency")).toBe("INR");
  });
});
