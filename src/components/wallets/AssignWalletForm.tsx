"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_WALLET_ACTION_STATE } from "@/lib/wallets/action-state";
import {
  assignTransactionToPurposeWalletAction,
  unassignTransactionPurposeWalletAction,
} from "@/lib/wallets/actions";

type AssignWalletFormProps = {
  transactionId: string;
  wallets: { id: string; name: string }[];
  assignedWalletName: string | null;
};

/** Lets the caller tag an already-posted expense or credit-card purchase to one purpose wallet, or remove that tag — never available for other transaction types (see assign_transaction_to_purpose_wallet's own check). */
export function AssignWalletForm({
  transactionId,
  wallets,
  assignedWalletName,
}: Readonly<AssignWalletFormProps>) {
  const [assignState, assignAction] = useActionState(
    assignTransactionToPurposeWalletAction,
    INITIAL_WALLET_ACTION_STATE,
  );
  const [unassignState, unassignAction] = useActionState(
    unassignTransactionPurposeWalletAction,
    INITIAL_WALLET_ACTION_STATE,
  );

  if (assignedWalletName) {
    return (
      <form action={unassignAction} className="flex flex-col gap-2">
        <input type="hidden" name="transactionId" value={transactionId} />
        <p className="text-sm text-muted-foreground">
          Assigned to wallet:{" "}
          <span className="font-medium text-foreground">
            {assignedWalletName}
          </span>
        </p>
        {unassignState.status === "error" ? (
          <FormMessage message={unassignState.message} tone="error" />
        ) : null}
        <SubmitButton
          pendingText="Removing…"
          variant="outline"
          className="w-fit"
        >
          Remove wallet assignment
        </SubmitButton>
      </form>
    );
  }

  if (wallets.length === 0) {
    return null;
  }

  return (
    <form action={assignAction} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="transactionId" value={transactionId} />
      <Select
        id="assign-wallet"
        name="walletId"
        label="Assign to a purpose wallet (optional)"
        options={wallets.map((w) => ({ value: w.id, label: w.name }))}
        placeholder="No wallet"
        error={
          assignState.status === "error"
            ? assignState.fieldErrors?.walletId
            : undefined
        }
      />
      {assignState.status === "error" ? (
        <FormMessage message={assignState.message} tone="error" />
      ) : null}
      <SubmitButton
        pendingText="Assigning…"
        variant="outline"
        className="w-fit"
      >
        Assign wallet
      </SubmitButton>
    </form>
  );
}
