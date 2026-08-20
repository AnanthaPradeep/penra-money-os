"use client";

import { useActionState } from "react";

import type { AccountOption } from "@/components/ledger/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TRANSACTION_ACTION_STATE } from "@/lib/ledger/action-state";
import { createTransferTransactionAction } from "@/lib/ledger/actions";
import { formatINR } from "@/lib/money/format";

type TransferTransactionFormProps = {
  accounts: AccountOption[];
  idempotencyKey: string;
  defaultAccountId?: string | undefined;
  defaultDate?: string | undefined;
};

export function TransferTransactionForm({
  accounts,
  idempotencyKey,
  defaultAccountId,
  defaultDate,
}: Readonly<TransferTransactionFormProps>) {
  const [state, formAction] = useActionState(
    createTransferTransactionAction,
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
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Select
        id="transfer-from-account"
        name="fromAccountId"
        label="From"
        options={accountOptions}
        defaultValue={defaultAccountId}
        placeholder="Choose an account"
        required
        error={fieldError("fromAccountId")}
      />
      <Select
        id="transfer-to-account"
        name="toAccountId"
        label="To"
        options={accountOptions}
        placeholder="Choose an account"
        required
        description="Must be different from the account above."
        error={fieldError("toAccountId")}
      />
      <Field
        id="transfer-amount"
        name="amount"
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        required
        error={fieldError("amount")}
      />
      <Field
        id="transfer-date"
        name="occurredOn"
        label="Date"
        type="date"
        defaultValue={defaultDate}
        required
        error={fieldError("occurredOn")}
      />
      <Field
        id="transfer-description"
        name="description"
        label="Description"
        placeholder="e.g. Move to savings"
        required
        error={fieldError("description")}
      />
      <Field id="transfer-notes" name="notes" label="Notes (optional)" />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Recording…">Record transfer</SubmitButton>
    </form>
  );
}
