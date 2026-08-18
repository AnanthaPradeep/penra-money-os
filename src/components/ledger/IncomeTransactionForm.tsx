"use client";

import { useActionState } from "react";

import type { AccountOption } from "@/components/ledger/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TRANSACTION_ACTION_STATE } from "@/lib/ledger/action-state";
import { createIncomeTransactionAction } from "@/lib/ledger/actions";
import { formatINR } from "@/lib/money/format";

type IncomeTransactionFormProps = {
  accounts: AccountOption[];
  defaultAccountId?: string | undefined;
  defaultDate?: string | undefined;
};

export function IncomeTransactionForm({
  accounts,
  defaultAccountId,
  defaultDate,
}: Readonly<IncomeTransactionFormProps>) {
  const [state, formAction] = useActionState(
    createIncomeTransactionAction,
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
        id="income-to-account"
        name="toAccountId"
        label="Deposit into"
        options={accountOptions}
        defaultValue={defaultAccountId}
        placeholder="Choose an account"
        required
        error={fieldError("toAccountId")}
      />
      <Field
        id="income-amount"
        name="amount"
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        required
        error={fieldError("amount")}
      />
      <Field
        id="income-date"
        name="occurredOn"
        label="Date"
        type="date"
        defaultValue={defaultDate}
        required
        error={fieldError("occurredOn")}
      />
      <Field
        id="income-description"
        name="description"
        label="Description"
        placeholder="e.g. Salary"
        required
        error={fieldError("description")}
      />
      <Field id="income-notes" name="notes" label="Notes (optional)" />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Recording…">Record income</SubmitButton>
    </form>
  );
}
