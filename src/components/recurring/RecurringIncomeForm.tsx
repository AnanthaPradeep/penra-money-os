"use client";

import { useActionState } from "react";

import { RecurrenceScheduleFields } from "@/components/recurring/RecurrenceScheduleFields";
import type {
  RecurringAccountOption,
  RecurringCategoryOption,
} from "@/components/recurring/types";
import {
  PayeeCombobox,
  type PayeeOption,
} from "@/components/ledger/PayeeCombobox";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_RECURRING_ACTION_STATE } from "@/lib/recurring/action-state";
import { createRecurringItemAction } from "@/lib/recurring/actions";
import { formatINR } from "@/lib/money/format";

type RecurringIncomeFormProps = {
  accounts: RecurringAccountOption[];
  categories: RecurringCategoryOption[];
  payees: PayeeOption[];
  defaultStartDate: string;
};

export function RecurringIncomeForm({
  accounts,
  categories,
  payees,
  defaultStartDate,
}: Readonly<RecurringIncomeFormProps>) {
  const [state, formAction] = useActionState(
    createRecurringItemAction,
    INITIAL_RECURRING_ACTION_STATE,
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
      <input type="hidden" name="kind" value="income" />
      <Field
        id="recurring-income-name"
        name="name"
        label="Name"
        placeholder="e.g. Salary"
        required
        error={fieldError("name")}
      />
      <Select
        id="recurring-income-destination-account"
        name="destinationAccountId"
        label="Received into"
        options={accountOptions}
        placeholder="Choose an account"
        required
        error={fieldError("destinationAccountId")}
      />
      <Select
        id="recurring-income-category"
        name="categoryId"
        label="Category"
        options={categoryOptions}
        placeholder="Choose a category"
        required
        error={fieldError("categoryId")}
      />
      <PayeeCombobox payees={payees} name="payeeId" label="Payer (optional)" />
      <Field
        id="recurring-income-amount"
        name="amount"
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        required
        error={fieldError("amount")}
      />
      <RecurrenceScheduleFields
        idPrefix="recurring-income"
        fieldError={fieldError}
        defaultStartDate={defaultStartDate}
      />
      <Field
        id="recurring-income-notes"
        name="notes"
        label="Notes (optional)"
      />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">
        Create recurring income
      </SubmitButton>
    </form>
  );
}
