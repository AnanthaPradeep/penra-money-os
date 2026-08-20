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

type RecurringBillFormProps = {
  kind: "bill" | "subscription";
  accounts: RecurringAccountOption[];
  categories: RecurringCategoryOption[];
  payees: PayeeOption[];
  defaultStartDate: string;
};

/** Shared by both "bill" and "subscription" — a subscription is a bill with two extra, optional presentation fields (trial end date; cancellation is a separate lifecycle action, not a create-time field). */
export function RecurringBillForm({
  kind,
  accounts,
  categories,
  payees,
  defaultStartDate,
}: Readonly<RecurringBillFormProps>) {
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

  const idPrefix = kind === "subscription" ? "subscription" : "bill";

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      <Field
        id={`${idPrefix}-name`}
        name="name"
        label="Name"
        placeholder={
          kind === "subscription" ? "e.g. Netflix" : "e.g. Electricity bill"
        }
        required
        error={fieldError("name")}
      />
      <Select
        id={`${idPrefix}-source-account`}
        name="sourceAccountId"
        label="Paid from"
        options={accountOptions}
        placeholder="Choose an account"
        required
        error={fieldError("sourceAccountId")}
      />
      <Select
        id={`${idPrefix}-category`}
        name="categoryId"
        label="Category"
        options={categoryOptions}
        placeholder="Choose a category"
        required
        error={fieldError("categoryId")}
      />
      <PayeeCombobox
        payees={payees}
        name="payeeId"
        label={
          kind === "subscription" ? "Provider (optional)" : "Payee (optional)"
        }
      />
      <Field
        id={`${idPrefix}-amount`}
        name="amount"
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        required
        error={fieldError("amount")}
      />
      <RecurrenceScheduleFields
        idPrefix={idPrefix}
        fieldError={fieldError}
        defaultStartDate={defaultStartDate}
      />
      {kind === "subscription" ? (
        <Field
          id={`${idPrefix}-trial-end-date`}
          name="trialEndDate"
          label="Trial ends (optional)"
          type="date"
          error={fieldError("trialEndDate")}
        />
      ) : null}
      <Field id={`${idPrefix}-notes`} name="notes" label="Notes (optional)" />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">
        {kind === "subscription" ? "Create subscription" : "Create bill"}
      </SubmitButton>
    </form>
  );
}
