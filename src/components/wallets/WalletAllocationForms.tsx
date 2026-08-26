"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_WALLET_ACTION_STATE } from "@/lib/wallets/action-state";
import {
  allocateToPurposeWalletAction,
  releasePurposeWalletAllocationAction,
} from "@/lib/wallets/actions";

type WalletAllocationFormsProps = {
  walletId: string;
};

/** Two small forms — earmark more of your real money into this wallet, or release some of it back to unallocated. Neither ever creates a ledger transaction. */
export function WalletAllocationForms({
  walletId,
}: Readonly<WalletAllocationFormsProps>) {
  const [allocateState, allocateAction] = useActionState(
    allocateToPurposeWalletAction,
    INITIAL_WALLET_ACTION_STATE,
  );
  const [releaseState, releaseAction] = useActionState(
    releasePurposeWalletAllocationAction,
    INITIAL_WALLET_ACTION_STATE,
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Add money</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <form
            action={allocateAction}
            noValidate
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="walletId" value={walletId} />
            <Field
              id="allocate-amount"
              name="amount"
              label="Amount"
              required
              inputMode="decimal"
              error={
                allocateState.status === "error"
                  ? allocateState.fieldErrors?.amount
                  : undefined
              }
            />
            {allocateState.status === "error" ? (
              <FormMessage message={allocateState.message} tone="error" />
            ) : null}
            {allocateState.status === "success" ? (
              <FormMessage message={allocateState.message} tone="success" />
            ) : null}
            <SubmitButton pendingText="Adding…">Add to wallet</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Release money</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <form
            action={releaseAction}
            noValidate
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="walletId" value={walletId} />
            <Field
              id="release-amount"
              name="amount"
              label="Amount"
              required
              inputMode="decimal"
              error={
                releaseState.status === "error"
                  ? releaseState.fieldErrors?.amount
                  : undefined
              }
            />
            {releaseState.status === "error" ? (
              <FormMessage message={releaseState.message} tone="error" />
            ) : null}
            {releaseState.status === "success" ? (
              <FormMessage message={releaseState.message} tone="success" />
            ) : null}
            <SubmitButton pendingText="Releasing…" variant="outline">
              Release from wallet
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
