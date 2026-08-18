import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { reverseTransactionAction } from "@/lib/ledger/actions";

const reverseTransactionActionMock = vi.fn<typeof reverseTransactionAction>();
vi.mock("@/lib/ledger/actions", () => ({
  reverseTransactionAction: (
    ...args: Parameters<typeof reverseTransactionAction>
  ) => reverseTransactionActionMock(...args),
}));

import { ReverseTransactionForm } from "@/components/ledger/ReverseTransactionForm";

describe("ReverseTransactionForm", () => {
  it("starts collapsed, requiring a deliberate second click to reveal the confirmation dialog", async () => {
    render(<ReverseTransactionForm transactionId="txn-1" />);

    expect(
      screen.getByRole("button", { name: "Reverse this transaction" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Reverse this transaction" }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Reverse this transaction?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm reversal" }),
    ).toBeInTheDocument();
  });

  it('explains that history is preserved, never calling the action "delete"', async () => {
    const user = userEvent.setup();
    render(<ReverseTransactionForm transactionId="txn-1" />);

    await user.click(
      screen.getByRole("button", { name: "Reverse this transaction" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/nothing is deleted/i);
    expect(dialog.textContent?.toLowerCase()).not.toContain("delete this");
  });

  it("submits the transactionId as a hidden field", async () => {
    const user = userEvent.setup();
    render(<ReverseTransactionForm transactionId="txn-42" />);

    await user.click(
      screen.getByRole("button", { name: "Reverse this transaction" }),
    );

    const hiddenField = document.querySelector('input[name="transactionId"]');
    expect(hiddenField).toHaveAttribute("value", "txn-42");
    expect(hiddenField).toHaveAttribute("type", "hidden");
  });

  it("shows a safe error message, never a raw database error", async () => {
    reverseTransactionActionMock.mockResolvedValue({
      status: "error",
      message: "We couldn't reverse that transaction. Please try again.",
    });

    const user = userEvent.setup();
    render(<ReverseTransactionForm transactionId="txn-1" />);

    await user.click(
      screen.getByRole("button", { name: "Reverse this transaction" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm reversal" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/postgres|sql|constraint|txn-1/i);
  });

  it("closes again when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ReverseTransactionForm transactionId="txn-1" />);

    await user.click(
      screen.getByRole("button", { name: "Reverse this transaction" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
