"use client";

import { useActionState } from "react";

import type { AccountOption } from "@/components/ledger/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TRANSACTION_ACTION_STATE } from "@/lib/ledger/action-state";
import { createCreditCardPaymentAction } from "@/lib/ledger/actions";
import { formatINR } from "@/lib/money/format";

type CreditCardPaymentFormProps = {
  creditCardAccounts: AccountOption[];
  fromAccounts: AccountOption[];
  idempotencyKey: string;
  defaultAccountId?: string | undefined;
  defaultDate?: string | undefined;
};

export function CreditCardPaymentForm({
  creditCardAccounts,
  fromAccounts,
  idempotencyKey,
  defaultAccountId,
  defaultDate,
}: Readonly<CreditCardPaymentFormProps>) {
  const [state, formAction] = useActionState(
    createCreditCardPaymentAction,
    INITIAL_TRANSACTION_ACTION_STATE,
  );
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const creditCardOptions = creditCardAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));
  const fromAccountOptions = fromAccounts
    .filter((account) => account.accountType !== "credit_card")
    .map((account) => ({
      value: account.id,
      label: `${account.name} (${formatINR(account.displayBalance)})`,
    }));

  if (creditCardAccounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You don&apos;t have any credit card accounts yet.
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Select
        id="cc-payment-card"
        name="creditCardAccountId"
        label="Credit card"
        options={creditCardOptions}
        defaultValue={
          defaultAccountId &&
          creditCardOptions.some((option) => option.value === defaultAccountId)
            ? defaultAccountId
            : undefined
        }
        placeholder="Choose a credit card"
        required
        error={fieldError("creditCardAccountId")}
      />
      <Select
        id="cc-payment-from"
        name="fromAccountId"
        label="Paid from"
        options={fromAccountOptions}
        defaultValue={
          defaultAccountId &&
          fromAccountOptions.some((option) => option.value === defaultAccountId)
            ? defaultAccountId
            : undefined
        }
        placeholder="Choose an account"
        required
        error={fieldError("fromAccountId")}
      />
      <Field
        id="cc-payment-amount"
        name="amount"
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        required
        error={fieldError("amount")}
      />
      <Field
        id="cc-payment-date"
        name="occurredOn"
        label="Date"
        type="date"
        defaultValue={defaultDate}
        required
        error={fieldError("occurredOn")}
      />
      <Field
        id="cc-payment-description"
        name="description"
        label="Description"
        placeholder="e.g. Card payment"
        required
        error={fieldError("description")}
      />
      <Field id="cc-payment-notes" name="notes" label="Notes (optional)" />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
    </form>
  );
}
