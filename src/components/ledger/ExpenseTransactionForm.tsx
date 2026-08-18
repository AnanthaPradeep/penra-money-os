"use client";

import { useActionState } from "react";

import type { AccountOption } from "@/components/ledger/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TRANSACTION_ACTION_STATE } from "@/lib/ledger/action-state";
import { createExpenseTransactionAction } from "@/lib/ledger/actions";
import { formatINR } from "@/lib/money/format";

type ExpenseTransactionFormProps = {
  accounts: AccountOption[];
  defaultAccountId?: string | undefined;
  defaultDate?: string | undefined;
};

export function ExpenseTransactionForm({
  accounts,
  defaultAccountId,
  defaultDate,
}: Readonly<ExpenseTransactionFormProps>) {
  const [state, formAction] = useActionState(
    createExpenseTransactionAction,
    INITIAL_TRANSACTION_ACTION_STATE,
  );
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Select
        id="expense-from-account"
        name="fromAccountId"
        label="Paid from"
        options={accountOptions}
        defaultValue={defaultAccountId}
        placeholder="Choose an account"
        required
        error={fieldError("fromAccountId")}
      />
      <Field
        id="expense-amount"
        name="amount"
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        required
        error={fieldError("amount")}
      />
      <Field
        id="expense-date"
        name="occurredOn"
        label="Date"
        type="date"
        defaultValue={defaultDate}
        required
        error={fieldError("occurredOn")}
      />
      <Field
        id="expense-description"
        name="description"
        label="Description"
        placeholder="e.g. Groceries"
        required
        error={fieldError("description")}
      />
      <Field id="expense-notes" name="notes" label="Notes (optional)" />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Recording…">Record expense</SubmitButton>
    </form>
  );
}
