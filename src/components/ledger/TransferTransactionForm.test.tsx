import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { createTransferTransactionAction } from "@/lib/ledger/actions";

const createTransferTransactionActionMock =
  vi.fn<typeof createTransferTransactionAction>();
vi.mock("@/lib/ledger/actions", () => ({
  createTransferTransactionAction: (
    ...args: Parameters<typeof createTransferTransactionAction>
  ) => createTransferTransactionActionMock(...args),
}));

import { TransferTransactionForm } from "@/components/ledger/TransferTransactionForm";

const ACCOUNTS = [
  {
    id: "acct-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "1000",
  },
  {
    id: "acct-2",
    name: "Cash Wallet",
    accountType: "wallet",
    displayBalance: "500",
  },
];

describe("TransferTransactionForm", () => {
  it("renders From and To selects with both accounts", () => {
    render(<TransferTransactionForm accounts={ACCOUNTS} />);

    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(
      screen.getAllByRole("option", { name: /HDFC Savings/ }),
    ).toHaveLength(2);
    expect(screen.getAllByRole("option", { name: /Cash Wallet/ })).toHaveLength(
      2,
    );
  });

  it("shows a same-account field error returned by the Server Action", async () => {
    createTransferTransactionActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { toAccountId: "Choose two different accounts." },
    });

    const user = userEvent.setup();
    render(<TransferTransactionForm accounts={ACCOUNTS} />);

    await user.click(screen.getByRole("button", { name: "Record transfer" }));

    expect(
      await screen.findByText("Choose two different accounts."),
    ).toBeInTheDocument();
  });
});
