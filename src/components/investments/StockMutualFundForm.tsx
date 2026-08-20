"use client";

import { useActionState } from "react";

import type { InvestmentAccountOption } from "@/components/investments/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { createInvestmentHoldingAction } from "@/lib/investments/actions";
import type { InvestmentAssetKind } from "@/lib/investments/types";
import { formatINR } from "@/lib/money/format";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

type StockMutualFundFormProps = {
  assetKind: Extract<
    InvestmentAssetKind,
    "stock" | "mutual_fund" | "other_investment"
  >;
  investmentAccounts: InvestmentAccountOption[];
};

const KIND_COPY: Record<
  StockMutualFundFormProps["assetKind"],
  { namePlaceholder: string; submitLabel: string }
> = {
  stock: {
    namePlaceholder: "e.g. HDFC Bank Ltd",
    submitLabel: "Create stock holding",
  },
  mutual_fund: {
    namePlaceholder: "e.g. Parag Parikh Flexi Cap Fund",
    submitLabel: "Create mutual fund holding",
  },
  other_investment: {
    namePlaceholder: "e.g. Gold ETF",
    submitLabel: "Create holding",
  },
};

/** Creates a stock/mutual-fund/other-investment asset and its first holding together (see createInvestmentHoldingAction). Purchases, sales, and valuations are recorded afterward from the holding detail page — this form only establishes the position's identity. */
export function StockMutualFundForm({
  assetKind,
  investmentAccounts,
}: Readonly<StockMutualFundFormProps>) {
  const [state, formAction] = useActionState(
    createInvestmentHoldingAction,
    INITIAL_INVESTMENT_ACTION_STATE,
  );
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const accountOptions = investmentAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));
  const copy = KIND_COPY[assetKind];

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="assetKind" value={assetKind} />
      <Field
        id="investment-display-name"
        name="displayName"
        label="Name"
        placeholder={copy.namePlaceholder}
        required
        error={fieldError("displayName")}
      />
      {assetKind === "stock" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="investment-symbol"
            name="symbol"
            label="Symbol (optional)"
            placeholder="e.g. HDFCBANK"
            error={fieldError("symbol")}
          />
          <Field
            id="investment-exchange"
            name="exchange"
            label="Exchange (optional)"
            placeholder="e.g. NSE"
            error={fieldError("exchange")}
          />
        </div>
      ) : null}
      {assetKind === "mutual_fund" ? (
        <Field
          id="investment-scheme-code"
          name="schemeCode"
          label="Scheme code (optional)"
          error={fieldError("schemeCode")}
        />
      ) : null}
      <Field
        id="investment-isin"
        name="isin"
        label="ISIN (optional)"
        error={fieldError("isin")}
      />
      <Select
        id="investment-account"
        name="investmentAccountId"
        label="Investment account (optional)"
        options={accountOptions}
        placeholder="None yet — link one now or later"
        description="An investment-type account keeps this holding's cash movements reconciled with your ledger. Create one from Accounts if you don't have one yet."
        error={fieldError("investmentAccountId")}
      />
      <Field
        id="investment-opened-date"
        name="openedDate"
        label="Opened on"
        type="date"
        defaultValue={nowAsIstCalendarDate()}
        required
        error={fieldError("openedDate")}
      />
      <Field
        id="investment-notes"
        name="notes"
        label="Notes (optional)"
        error={fieldError("notes")}
      />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Creating…">{copy.submitLabel}</SubmitButton>
    </form>
  );
}
