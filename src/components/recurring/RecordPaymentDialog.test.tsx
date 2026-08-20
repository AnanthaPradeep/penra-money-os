import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/recurring/actions", () => ({
  recordOccurrencePaymentAction: vi.fn(),
}));

// PayeeCombobox transitively imports createPayeeAction, which imports the
// server-only Supabase client factory — mock it out so it never loads here.
vi.mock("@/lib/payees/actions", () => ({
  createPayeeAction: vi.fn(),
}));

import { RecordPaymentDialog } from "@/components/recurring/RecordPaymentDialog";

const ACCOUNTS = [
  {
    id: "acct-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "1000",
  },
];
const CATEGORIES = [{ id: "cat-1", name: "Bills" }];
const PAYEES: never[] = [];

describe("RecordPaymentDialog", () => {
  it("starts closed, requiring a deliberate trigger click", () => {
    render(
      <RecordPaymentDialog
        occurrenceId="occ-1"
        itemKind="bill"
        itemName="Electricity"
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        defaultAccountId={null}
        defaultCategoryId={null}
        defaultPayeeId={null}
        defaultAmount="1500"
        defaultDate="2026-08-15"
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with account, amount, date, and category fields prefilled for a bill", async () => {
    const user = userEvent.setup();
    render(
      <RecordPaymentDialog
        occurrenceId="occ-1"
        itemKind="bill"
        itemName="Electricity"
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        defaultAccountId="acct-1"
        defaultCategoryId="cat-1"
        defaultPayeeId={null}
        defaultAmount="1500"
        defaultDate="2026-08-15"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(
      screen.getByRole("dialog", {
        name: "Record payment for “Electricity”",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Paid from")).toHaveValue("acct-1");
    expect(screen.getByLabelText("Amount")).toHaveValue("1500");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-08-15");
    expect(screen.getByLabelText("Category")).toHaveValue("cat-1");
  });

  it("labels the account field 'Received into' for income", async () => {
    const user = userEvent.setup();
    render(
      <RecordPaymentDialog
        occurrenceId="occ-2"
        itemKind="income"
        itemName="Salary"
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        defaultAccountId="acct-1"
        defaultCategoryId={null}
        defaultPayeeId={null}
        defaultAmount="50000"
        defaultDate="2026-08-01"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(screen.getByLabelText("Received into")).toBeInTheDocument();
  });

  it("shows a fixed source-to-destination summary and no account selector for a transfer", async () => {
    const user = userEvent.setup();
    render(
      <RecordPaymentDialog
        occurrenceId="occ-3"
        itemKind="transfer"
        itemName="Move to savings"
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        defaultAccountId={null}
        defaultCategoryId={null}
        defaultPayeeId={null}
        defaultAmount="2000"
        defaultDate="2026-08-01"
        transferSourceAccount={{ id: "acct-1", name: "HDFC Savings" }}
        transferDestinationAccount={{ id: "acct-2", name: "SBI Savings" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(screen.getByText(/HDFC Savings/)).toBeInTheDocument();
    expect(screen.getByText(/SBI Savings/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Paid from")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
  });

  it("closes without submitting when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <RecordPaymentDialog
        occurrenceId="occ-1"
        itemKind="bill"
        itemName="Electricity"
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        payees={PAYEES}
        defaultAccountId={null}
        defaultCategoryId={null}
        defaultPayeeId={null}
        defaultAmount="1500"
        defaultDate="2026-08-15"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Record payment" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
