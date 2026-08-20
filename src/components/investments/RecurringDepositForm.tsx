"use client";

import { useActionState } from "react";

import type { InvestmentAccountOption } from "@/components/investments/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { createRecurringDepositAction } from "@/lib/investments/actions";
import { RECURRENCE_FREQUENCIES } from "@/lib/recurring/schedule";
import {
  PROCESSING_MODE_LABELS,
  PROCESSING_MODES,
} from "@/lib/recurring/types";
import { formatINR } from "@/lib/money/format";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

type RecurringDepositFormProps = {
  investmentAccounts: InvestmentAccountOption[];
  fundingAccounts: InvestmentAccountOption[];
};

const FREQUENCY_LABELS: Record<
  (typeof RECURRENCE_FREQUENCIES)[number],
  string
> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly",
};
const FREQUENCY_OPTIONS = RECURRENCE_FREQUENCIES.map((value) => ({
  value,
  label: FREQUENCY_LABELS[value],
}));
const PROCESSING_MODE_OPTIONS = PROCESSING_MODES.map((value) => ({
  value,
  label: PROCESSING_MODE_LABELS[value],
}));

/** Creates a recurring deposit — internally links a Phase 6 recurring_items row (kind "transfer") so every installment reuses the existing generation/processing/reminder infrastructure rather than a second recurrence engine (see createRecurringDepositAction / public.create_recurring_deposit). */
export function RecurringDepositForm({
  investmentAccounts,
  fundingAccounts,
}: Readonly<RecurringDepositFormProps>) {
  const [state, formAction] = useActionState(
    createRecurringDepositAction,
    INITIAL_INVESTMENT_ACTION_STATE,
  );
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const investmentAccountOptions = investmentAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));
  const fundingAccountOptions = fundingAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field
        id="rd-display-name"
        name="displayName"
        label="Name"
        placeholder="e.g. HDFC RD"
        required
        error={fieldError("displayName")}
      />
      <Select
        id="rd-investment-account"
        name="investmentAccountId"
        label="Investment account"
        options={investmentAccountOptions}
        placeholder="Choose an investment account"
        required
        error={fieldError("investmentAccountId")}
      />
      <Select
        id="rd-funding-account"
        name="fundingAccountId"
        label="Installments paid from"
        options={fundingAccountOptions}
        placeholder="Choose an account"
        required
        error={fieldError("fundingAccountId")}
      />
      <Field
        id="rd-installment-amount"
        name="installmentAmount"
        label="Installment amount"
        inputMode="decimal"
        required
        error={fieldError("installmentAmount")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          id="rd-frequency"
          name="frequency"
          label="Frequency"
          options={FREQUENCY_OPTIONS}
          defaultValue="monthly"
          required
          error={fieldError("frequency")}
        />
        <Field
          id="rd-planned-installments"
          name="plannedInstallments"
          label="Planned installments (optional)"
          inputMode="numeric"
          error={fieldError("plannedInstallments")}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="rd-start-date"
          name="startDate"
          label="Start date"
          type="date"
          defaultValue={nowAsIstCalendarDate()}
          required
          error={fieldError("startDate")}
        />
        <Field
          id="rd-maturity-date"
          name="maturityDate"
          label="Maturity date"
          type="date"
          required
          error={fieldError("maturityDate")}
        />
      </div>
      <Field
        id="rd-provider"
        name="provider"
        label="Provider (optional)"
        placeholder="e.g. HDFC Bank"
        error={fieldError("provider")}
      />
      <Field
        id="rd-interest-rate"
        name="interestRate"
        label="Interest rate % (optional, reference only)"
        inputMode="decimal"
        error={fieldError("interestRate")}
      />
      <Field
        id="rd-expected-maturity"
        name="expectedMaturityAmount"
        label="Expected maturity amount (optional)"
        inputMode="decimal"
        error={fieldError("expectedMaturityAmount")}
      />
      <Select
        id="rd-processing-mode"
        name="processingMode"
        label="How should installments be handled?"
        options={PROCESSING_MODE_OPTIONS}
        defaultValue="reminder_only"
        required
        error={fieldError("processingMode")}
      />
      <Field
        id="rd-notes"
        name="notes"
        label="Notes (optional)"
        error={fieldError("notes")}
      />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">
        Create recurring deposit
      </SubmitButton>
    </form>
  );
}
