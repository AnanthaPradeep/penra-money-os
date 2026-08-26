"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_WALLET_ACTION_STATE } from "@/lib/wallets/action-state";
import { reallocatePurposeWalletAction } from "@/lib/wallets/actions";

type ReallocateWalletFormProps = {
  currentWalletId: string;
  wallets: { id: string; name: string }[];
};

/** Moves an already-allocated amount from one wallet to another — never creates a ledger transaction, never touches a real account balance. Defaults "from" to the wallet this form is shown on. */
export function ReallocateWalletForm({
  currentWalletId,
  wallets,
}: Readonly<ReallocateWalletFormProps>) {
  const [state, formAction] = useActionState(
    reallocatePurposeWalletAction,
    INITIAL_WALLET_ACTION_STATE,
  );

  if (wallets.length < 2) {
    return null;
  }

  const walletOptions = wallets.map((w) => ({ value: w.id, label: w.name }));
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Move money between wallets</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <Select
            id="reallocate-from-wallet"
            name="fromWalletId"
            label="From"
            options={walletOptions}
            defaultValue={currentWalletId}
            required
            error={fieldError("fromWalletId")}
          />
          <Select
            id="reallocate-to-wallet"
            name="toWalletId"
            label="To"
            options={walletOptions}
            placeholder="Choose a wallet"
            required
            error={fieldError("toWalletId")}
          />
          <Field
            id="reallocate-amount"
            name="amount"
            label="Amount"
            required
            inputMode="decimal"
            error={fieldError("amount")}
          />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Moving…">Move money</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
