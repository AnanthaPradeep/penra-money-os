"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import { saveTaxPaymentAction } from "@/lib/tax/actions";
import { TAX_PAYMENT_TYPES, TAX_PAYMENT_TYPE_LABELS } from "@/lib/tax/mapping";

const TYPE_OPTIONS = TAX_PAYMENT_TYPES.map((t) => ({
  value: t,
  label: TAX_PAYMENT_TYPE_LABELS[t],
}));

export function TaxPaymentForm({
  financialYearId,
}: Readonly<{ financialYearId: string }>) {
  const [state, formAction] = useActionState(
    saveTaxPaymentAction,
    INITIAL_TAX_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">
          Record a tax payment or refund
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="financialYearId" value={financialYearId} />
          <Select
            id="payment-type"
            name="paymentType"
            label="Type"
            options={TYPE_OPTIONS}
            required
            error={fieldError("paymentType")}
          />
          <Field
            id="payment-amount"
            name="amount"
            label="Amount"
            required
            inputMode="decimal"
            error={fieldError("amount")}
          />
          <Field
            id="payment-date"
            name="paidOn"
            label="Date"
            type="date"
            required
            error={fieldError("paidOn")}
          />
          <Field
            id="payment-challan"
            name="challanReference"
            label="Challan reference (optional)"
            error={fieldError("challanReference")}
          />
          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}
          {state.status === "success" ? (
            <FormMessage message={state.message} tone="success" />
          ) : null}
          <SubmitButton pendingText="Saving…" className="w-fit">
            Record payment
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
