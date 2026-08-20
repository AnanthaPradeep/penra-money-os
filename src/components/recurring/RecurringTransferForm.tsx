"use client";

import { useActionState } from "react";

import { RecurrenceScheduleFields } from "@/components/recurring/RecurrenceScheduleFields";
import type { RecurringAccountOption } from "@/components/recurring/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_RECURRING_ACTION_STATE } from "@/lib/recurring/action-state";
import { createRecurringItemAction } from "@/lib/recurring/actions";
import { formatINR } from "@/lib/money/format";

type RecurringTransferFormProps = {
  accounts: RecurringAccountOption[];
  defaultStartDate: string;
};

export function RecurringTransferForm({
  accounts,
  defaultStartDate,
}: Readonly<RecurringTransferFormProps>) {
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

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="kind" value="transfer" />
      <Field
        id="recurring-transfer-name"
        name="name"
        label="Name"
        placeholder="e.g. Move to savings"
        required
        error={fieldError("name")}
      />
      <Select
        id="recurring-transfer-source-account"
        name="sourceAccountId"
        label="From"
        options={accountOptions}
        placeholder="Choose an account"
        required
        error={fieldError("sourceAccountId")}
      />
      <Select
        id="recurring-transfer-destination-account"
        name="destinationAccountId"
        label="To"
        options={accountOptions}
        placeholder="Choose an account"
        required
        description="Must be different from the account above."
        error={fieldError("destinationAccountId")}
      />
      <Field
        id="recurring-transfer-amount"
        name="amount"
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        required
        error={fieldError("amount")}
      />
      <RecurrenceScheduleFields
        idPrefix="recurring-transfer"
        fieldError={fieldError}
        defaultStartDate={defaultStartDate}
      />
      <Field
        id="recurring-transfer-notes"
        name="notes"
        label="Notes (optional)"
      />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">
        Create recurring transfer
      </SubmitButton>
    </form>
  );
}
