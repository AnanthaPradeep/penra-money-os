"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_DEBT_ACTION_STATE } from "@/lib/debts/action-state";
import { recordDebtProceedsAction } from "@/lib/debts/actions";

type RecordDebtProceedsFormProps = {
  debtId: string;
  receivingAccounts: { id: string; name: string }[];
  idempotencyKey: string;
};

/** Records a NEW loan's disbursement — the receiving account gets the cash, the liability increases by the same amount, in one balanced transaction. Only relevant before this debt has any ledger activity yet. */
export function RecordDebtProceedsForm({
  debtId,
  receivingAccounts,
  idempotencyKey,
}: Readonly<RecordDebtProceedsFormProps>) {
  const [state, formAction] = useActionState(
    recordDebtProceedsAction,
    INITIAL_DEBT_ACTION_STATE,
  );

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Record loan proceeds</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Use this only for a brand-new loan&apos;s disbursement. If this debt
          already existed before you started using PENRA, record its starting
          balance as the liability account&apos;s opening balance instead.
        </p>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="debtId" value={debtId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <Select
            id="proceeds-receiving-account"
            name="receivingAccountId"
            label="Receiving account"
            options={receivingAccounts.map((a) => ({
              value: a.id,
              label: a.name,
            }))}
            placeholder="Choose an account"
            required
            error={
              state.status === "error"
                ? state.fieldErrors?.receivingAccountId
                : undefined
            }
          />
          <Field
            id="proceeds-amount"
            name="amount"
            label="Amount"
            required
            inputMode="decimal"
            error={
              state.status === "error" ? state.fieldErrors?.amount : undefined
            }
          />
          <Field
            id="proceeds-occurred-on"
            name="occurredOn"
            label="Date"
            type="date"
            required
            error={
              state.status === "error"
                ? state.fieldErrors?.occurredOn
                : undefined
            }
          />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Recording…">Record proceeds</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
