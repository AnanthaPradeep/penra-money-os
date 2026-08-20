"use client";

import { useActionState } from "react";

import type { InvestmentAccountOption } from "@/components/investments/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { createFixedDepositAction } from "@/lib/investments/actions";
import {
  COMPOUNDING_FREQUENCIES,
  COMPOUNDING_FREQUENCY_LABELS,
  INTEREST_PAYOUT_MODES,
  INTEREST_PAYOUT_MODE_LABELS,
} from "@/lib/investments/types";
import { formatINR } from "@/lib/money/format";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

type FixedDepositFormProps = {
  investmentAccounts: InvestmentAccountOption[];
  fundingAccounts: InvestmentAccountOption[];
  idempotencyKey: string;
};

const COMPOUNDING_OPTIONS = COMPOUNDING_FREQUENCIES.map((value) => ({
  value,
  label: COMPOUNDING_FREQUENCY_LABELS[value],
}));
const PAYOUT_OPTIONS = INTEREST_PAYOUT_MODES.map((value) => ({
  value,
  label: INTEREST_PAYOUT_MODE_LABELS[value],
}));

/** Creates a fixed deposit — the principal posts as an asset transfer from the funding account, never as an expense (see createFixedDepositAction / public.create_fixed_deposit). Expected maturity amount is a user-entered reference figure, never a fabricated bank calculation. */
export function FixedDepositForm({
  investmentAccounts,
  fundingAccounts,
  idempotencyKey,
}: Readonly<FixedDepositFormProps>) {
  const [state, formAction] = useActionState(
    createFixedDepositAction,
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
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Field
        id="fd-display-name"
        name="displayName"
        label="Name"
        placeholder="e.g. HDFC 1-year FD"
        required
        error={fieldError("displayName")}
      />
      <Select
        id="fd-investment-account"
        name="investmentAccountId"
        label="Investment account"
        options={investmentAccountOptions}
        placeholder="Choose an investment account"
        required
        error={fieldError("investmentAccountId")}
      />
      <Select
        id="fd-funding-account"
        name="fundingAccountId"
        label="Funded from"
        options={fundingAccountOptions}
        placeholder="Choose an account"
        required
        error={fieldError("fundingAccountId")}
      />
      <Field
        id="fd-principal"
        name="principalAmount"
        label="Principal"
        inputMode="decimal"
        required
        error={fieldError("principalAmount")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="fd-start-date"
          name="startDate"
          label="Start date"
          type="date"
          defaultValue={nowAsIstCalendarDate()}
          required
          error={fieldError("startDate")}
        />
        <Field
          id="fd-maturity-date"
          name="maturityDate"
          label="Maturity date"
          type="date"
          required
          error={fieldError("maturityDate")}
        />
      </div>
      <Field
        id="fd-provider"
        name="provider"
        label="Provider (optional)"
        placeholder="e.g. HDFC Bank"
        error={fieldError("provider")}
      />
      <Field
        id="fd-interest-rate"
        name="interestRate"
        label="Interest rate % (optional, reference only)"
        inputMode="decimal"
        error={fieldError("interestRate")}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          id="fd-compounding"
          name="compoundingFrequency"
          label="Compounding (optional)"
          options={COMPOUNDING_OPTIONS}
          placeholder="Not specified"
          error={fieldError("compoundingFrequency")}
        />
        <Select
          id="fd-payout-mode"
          name="interestPayoutMode"
          label="Interest payout (optional)"
          options={PAYOUT_OPTIONS}
          placeholder="Not specified"
          error={fieldError("interestPayoutMode")}
        />
      </div>
      <Field
        id="fd-expected-maturity"
        name="expectedMaturityAmount"
        label="Expected maturity amount (optional)"
        inputMode="decimal"
        description="Your own estimate — never calculated or guaranteed by this app."
        error={fieldError("expectedMaturityAmount")}
      />
      <Field
        id="fd-notes"
        name="notes"
        label="Notes (optional)"
        error={fieldError("notes")}
      />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">Create fixed deposit</SubmitButton>
    </form>
  );
}
