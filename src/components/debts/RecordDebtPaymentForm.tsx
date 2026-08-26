"use client";

import { useActionState, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_DEBT_ACTION_STATE } from "@/lib/debts/action-state";
import { recordDebtPaymentAction } from "@/lib/debts/actions";
import { PREPAYMENT_ASSUMPTIONS } from "@/lib/debts/mapping";

const PAYMENT_TYPE_OPTIONS = [
  { value: "scheduled", label: "Scheduled payment" },
  { value: "prepayment", label: "Prepayment (extra, ahead of schedule)" },
];

const PREPAYMENT_ASSUMPTION_OPTIONS = PREPAYMENT_ASSUMPTIONS.map((a) => ({
  value: a,
  label: a.replace("_", " "),
}));

type RecordDebtPaymentFormProps = {
  debtId: string;
  paymentAccounts: { id: string; name: string }[];
  idempotencyKey: string;
};

export function RecordDebtPaymentForm({
  debtId,
  paymentAccounts,
  idempotencyKey,
}: Readonly<RecordDebtPaymentFormProps>) {
  const [state, formAction] = useActionState(
    recordDebtPaymentAction,
    INITIAL_DEBT_ACTION_STATE,
  );
  const [paymentType, setPaymentType] = useState("scheduled");

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Record a payment</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="mb-3 text-xs text-muted-foreground">
          The principal portion reduces what you owe; interest and fees are
          recorded as an expense. Principal is never itself an expense.
        </p>
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="debtId" value={debtId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <Select
            id="payment-type"
            name="paymentType"
            label="Payment type"
            options={PAYMENT_TYPE_OPTIONS}
            defaultValue="scheduled"
            onChange={(e) => setPaymentType(e.target.value)}
          />
          {paymentType === "prepayment" ? (
            <Select
              id="payment-prepayment-assumption"
              name="prepaymentAssumption"
              label="After this prepayment"
              options={PREPAYMENT_ASSUMPTION_OPTIONS}
              placeholder="Choose an assumption"
              description="Your lender's actual recalculation may differ — this only labels your intent."
              error={fieldError("prepaymentAssumption")}
            />
          ) : null}
          <Field
            id="payment-principal"
            name="principalAmount"
            label="Principal amount"
            inputMode="decimal"
            error={fieldError("principalAmount")}
          />
          <Field
            id="payment-interest"
            name="interestAmount"
            label="Interest amount"
            inputMode="decimal"
            error={fieldError("interestAmount")}
          />
          <Field
            id="payment-fees"
            name="feesAmount"
            label="Fees amount"
            inputMode="decimal"
            error={fieldError("feesAmount")}
          />
          <Select
            id="payment-account"
            name="paymentAccountId"
            label="Paid from"
            options={paymentAccounts.map((a) => ({
              value: a.id,
              label: a.name,
            }))}
            placeholder="Choose an account"
            required
            error={fieldError("paymentAccountId")}
          />
          <Field
            id="payment-effective-date"
            name="effectiveDate"
            label="Date"
            type="date"
            required
            error={fieldError("effectiveDate")}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="allowOverpayment"
              value="true"
              className="size-4"
            />
            Allow this to exceed the outstanding principal
          </label>
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
