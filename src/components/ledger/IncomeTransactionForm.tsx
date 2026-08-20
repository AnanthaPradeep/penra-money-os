"use client";

import { useActionState } from "react";

import {
  PayeeCombobox,
  type PayeeOption,
} from "@/components/ledger/PayeeCombobox";
import type { AccountOption, CategoryOption } from "@/components/ledger/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TRANSACTION_ACTION_STATE } from "@/lib/ledger/action-state";
import { createIncomeTransactionAction } from "@/lib/ledger/actions";
import { formatINR } from "@/lib/money/format";

type IncomeTransactionFormProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  payees: PayeeOption[];
  idempotencyKey: string;
  defaultAccountId?: string | undefined;
  defaultDate?: string | undefined;
};

export function IncomeTransactionForm({
  accounts,
  categories,
  payees,
  idempotencyKey,
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
  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
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
      <Select
        id="income-category"
        name="categoryId"
        label="Category"
        options={categoryOptions}
        placeholder="Choose a category"
        required
        error={fieldError("categoryId")}
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
      <PayeeCombobox payees={payees} name="payeeId" label="Payer (optional)" />
      <Field id="income-notes" name="notes" label="Notes (optional)" />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Recording…">Record income</SubmitButton>
    </form>
  );
}
