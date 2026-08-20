import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/recurring/actions", () => ({
  createRecurringItemAction: vi.fn(),
}));

// PayeeCombobox transitively imports createPayeeAction, which imports the
// server-only Supabase client factory — mock it out so it never loads here.
vi.mock("@/lib/payees/actions", () => ({
  createPayeeAction: vi.fn(),
}));

import { RecurringItemForm } from "@/components/recurring/RecurringItemForm";

const ACCOUNTS = [
  {
    id: "acct-1",
    name: "HDFC Savings",
    accountType: "bank_savings",
    displayBalance: "1000",
  },
  {
    id: "acct-2",
    name: "SBI Savings",
    accountType: "bank_savings",
    displayBalance: "500",
  },
];
const INCOME_CATEGORIES = [{ id: "cat-income-1", name: "Salary" }];
const EXPENSE_CATEGORIES = [{ id: "cat-expense-1", name: "Bills" }];
const PAYEES: never[] = [];
const DEFAULT_START_DATE = "2026-08-01";

describe("RecurringItemForm", () => {
  it("defaults to the bill form", () => {
    render(
      <RecurringItemForm
        accounts={ACCOUNTS}
        incomeCategories={INCOME_CATEGORIES}
        expenseCategories={EXPENSE_CATEGORIES}
        payees={PAYEES}
        defaultStartDate={DEFAULT_START_DATE}
      />,
    );

    expect(screen.getByLabelText("Paid from")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create bill" }),
    ).toBeInTheDocument();
  });

  it("exposes the kind switcher as an accessible radiogroup", () => {
    render(
      <RecurringItemForm
        accounts={ACCOUNTS}
        incomeCategories={INCOME_CATEGORIES}
        expenseCategories={EXPENSE_CATEGORIES}
        payees={PAYEES}
        defaultStartDate={DEFAULT_START_DATE}
      />,
    );

    expect(
      screen.getByRole("radiogroup", {
        name: "What kind of recurring item is this?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Bill" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("switches to the subscription form, including the trial-end-date field", async () => {
    const user = userEvent.setup();
    render(
      <RecurringItemForm
        accounts={ACCOUNTS}
        incomeCategories={INCOME_CATEGORIES}
        expenseCategories={EXPENSE_CATEGORIES}
        payees={PAYEES}
        defaultStartDate={DEFAULT_START_DATE}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Subscription" }));

    expect(
      screen.getByRole("button", { name: "Create subscription" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Trial ends (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider (optional)")).toBeInTheDocument();
  });

  it("switches to the recurring income form, dropping the amount-paid-from field", async () => {
    const user = userEvent.setup();
    render(
      <RecurringItemForm
        accounts={ACCOUNTS}
        incomeCategories={INCOME_CATEGORIES}
        expenseCategories={EXPENSE_CATEGORIES}
        payees={PAYEES}
        defaultStartDate={DEFAULT_START_DATE}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Recurring income" }));

    expect(screen.getByLabelText("Received into")).toBeInTheDocument();
    expect(screen.queryByLabelText("Paid from")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create recurring income" }),
    ).toBeInTheDocument();
  });

  it("switches to the recurring transfer form, showing From/To account fields and no category field", async () => {
    const user = userEvent.setup();
    render(
      <RecurringItemForm
        accounts={ACCOUNTS}
        incomeCategories={INCOME_CATEGORIES}
        expenseCategories={EXPENSE_CATEGORIES}
        payees={PAYEES}
        defaultStartDate={DEFAULT_START_DATE}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Recurring transfer" }));

    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create recurring transfer" }),
    ).toBeInTheDocument();
  });

  it("shows the shared recurrence schedule fields (frequency, interval, processing mode) on every kind", async () => {
    const user = userEvent.setup();
    render(
      <RecurringItemForm
        accounts={ACCOUNTS}
        incomeCategories={INCOME_CATEGORIES}
        expenseCategories={EXPENSE_CATEGORIES}
        payees={PAYEES}
        defaultStartDate={DEFAULT_START_DATE}
      />,
    );

    expect(screen.getByLabelText("Repeats")).toBeInTheDocument();
    expect(screen.getByLabelText("Every N periods")).toBeInTheDocument();
    expect(
      screen.getByLabelText("How should this be handled?"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Recurring transfer" }));

    expect(screen.getByLabelText("Repeats")).toBeInTheDocument();
    expect(
      screen.getByLabelText("How should this be handled?"),
    ).toBeInTheDocument();
  });

  it("respects an explicit defaultKind prop", () => {
    render(
      <RecurringItemForm
        accounts={ACCOUNTS}
        incomeCategories={INCOME_CATEGORIES}
        expenseCategories={EXPENSE_CATEGORIES}
        payees={PAYEES}
        defaultStartDate={DEFAULT_START_DATE}
        defaultKind="subscription"
      />,
    );

    expect(screen.getByRole("radio", { name: "Subscription" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
