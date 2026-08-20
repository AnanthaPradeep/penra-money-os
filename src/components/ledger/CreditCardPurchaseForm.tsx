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
import { createCreditCardPurchaseAction } from "@/lib/ledger/actions";
import { formatINR } from "@/lib/money/format";

type CreditCardPurchaseFormProps = {
  creditCardAccounts: AccountOption[];
  categories: CategoryOption[];
  payees: PayeeOption[];
  idempotencyKey: string;
  defaultAccountId?: string | undefined;
  defaultDate?: string | undefined;
};

export function CreditCardPurchaseForm({
  creditCardAccounts,
  categories,
  payees,
  idempotencyKey,
  defaultAccountId,
  defaultDate,
}: Readonly<CreditCardPurchaseFormProps>) {
  const [state, formAction] = useActionState(
    createCreditCardPurchaseAction,
    INITIAL_TRANSACTION_ACTION_STATE,
  );
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const accountOptions = creditCardAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));
  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
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
        id="cc-purchase-account"
        name="creditCardAccountId"
        label="Credit card"
        options={accountOptions}
        defaultValue={defaultAccountId}
        placeholder="Choose a credit card"
        required
        error={fieldError("creditCardAccountId")}
      />
      <Select
        id="cc-purchase-category"
        name="categoryId"
        label="Category"
        options={categoryOptions}
        placeholder="Choose a category"
        required
        error={fieldError("categoryId")}
      />
      <Field
        id="cc-purchase-amount"
        name="amount"
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        required
        error={fieldError("amount")}
      />
      <Field
        id="cc-purchase-date"
        name="occurredOn"
        label="Date"
        type="date"
        defaultValue={defaultDate}
        required
        error={fieldError("occurredOn")}
      />
      <Field
        id="cc-purchase-description"
        name="description"
        label="Description"
        placeholder="e.g. Online order"
        required
        error={fieldError("description")}
      />
      <PayeeCombobox
        payees={payees}
        name="payeeId"
        label="Merchant (optional)"
      />
      <Field id="cc-purchase-notes" name="notes" label="Notes (optional)" />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Recording…">Record purchase</SubmitButton>
    </form>
  );
}
