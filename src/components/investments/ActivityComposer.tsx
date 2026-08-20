"use client";

import { useActionState, useState } from "react";

import type {
  InvestmentAccountOption,
  InvestmentCategoryOption,
} from "@/components/investments/types";
import {
  PayeeCombobox,
  type PayeeOption,
} from "@/components/ledger/PayeeCombobox";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_INVESTMENT_ACTION_STATE } from "@/lib/investments/action-state";
import { recordInvestmentActivityAction } from "@/lib/investments/actions";
import {
  INVESTMENT_ACTIVITY_KIND_LABELS,
  type InvestmentActivityKind,
} from "@/lib/investments/types";
import { formatINR } from "@/lib/money/format";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

const COMPOSER_KINDS: InvestmentActivityKind[] = [
  "buy",
  "sell",
  "contribution",
  "withdrawal",
  "dividend",
  "interest",
  "fee",
  "adjustment",
];

type ActivityComposerProps = {
  holdingId: string;
  /** Which activity kinds this holding's asset kind supports — e.g. a PPF holding never buys/sells units. */
  supportedKinds: InvestmentActivityKind[];
  accounts: InvestmentAccountOption[];
  incomeCategories: InvestmentCategoryOption[];
  expenseCategories: InvestmentCategoryOption[];
  payees: PayeeOption[];
  idempotencyKey: string;
  /** Currently-held quantity, shown as a hint and used to disable "sell" when there is nothing to sell. Null for non-unit holdings. */
  availableQuantity: string | null;
  /** Currently-available cost basis/balance, shown as a hint for withdrawals. */
  availableBalance: string;
};

/** Dynamic activity composer — one form, fields change by activityKind, all routed through recordInvestmentActivityAction so cost-basis/idempotency/currency rules are enforced in exactly one place server-side. */
export function ActivityComposer({
  holdingId,
  supportedKinds,
  accounts,
  incomeCategories,
  expenseCategories,
  payees,
  idempotencyKey,
  availableQuantity,
  availableBalance,
}: Readonly<ActivityComposerProps>) {
  const [state, formAction] = useActionState(
    recordInvestmentActivityAction,
    INITIAL_INVESTMENT_ACTION_STATE,
  );
  const initialKind = supportedKinds[0] ?? "contribution";
  const [kind, setKind] = useState<InvestmentActivityKind>(initialKind);
  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${formatINR(account.displayBalance)})`,
  }));
  const incomeCategoryOptions = incomeCategories.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const expenseCategoryOptions = expenseCategories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const kindOptions = COMPOSER_KINDS.filter((k) =>
    supportedKinds.includes(k),
  ).map((k) => ({
    value: k,
    label: INVESTMENT_ACTIVITY_KIND_LABELS[k],
  }));

  const cannotSell =
    kind === "sell" &&
    (availableQuantity === null || availableQuantity === "0");

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="holdingId" value={holdingId} />
      <input type="hidden" name="activityKind" value={kind} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <SegmentedControl
        label="Activity type"
        options={kindOptions}
        value={kind}
        onChange={setKind}
      />

      {(kind === "buy" || kind === "sell") && availableQuantity !== null ? (
        <p className="text-sm text-muted-foreground">
          Currently held:{" "}
          <span className="font-medium text-foreground">
            {availableQuantity}
          </span>{" "}
          units
        </p>
      ) : null}
      {kind === "withdrawal" ? (
        <p className="text-sm text-muted-foreground">
          Available balance:{" "}
          <span className="font-medium text-foreground">
            {formatINR(availableBalance)}
          </span>
        </p>
      ) : null}

      {kind === "buy" ? (
        <Select
          id="activity-funding-account"
          name="fundingAccountId"
          label="Paid from"
          options={accountOptions}
          placeholder="Choose an account"
          required
          error={fieldError("fundingAccountId")}
        />
      ) : null}
      {kind === "sell" ? (
        <Select
          id="activity-receiving-account"
          name="receivingAccountId"
          label="Proceeds to"
          options={accountOptions}
          placeholder="Choose an account"
          required
          error={fieldError("receivingAccountId")}
        />
      ) : null}
      {kind === "contribution" || kind === "fee" ? (
        <Select
          id="activity-funding-account-2"
          name="fundingAccountId"
          label="Paid from"
          options={accountOptions}
          placeholder="Choose an account"
          required
          error={fieldError("fundingAccountId")}
        />
      ) : null}
      {kind === "withdrawal" || kind === "dividend" || kind === "interest" ? (
        <Select
          id="activity-receiving-account-2"
          name="receivingAccountId"
          label="Received into"
          options={accountOptions}
          placeholder="Choose an account"
          required
          error={fieldError("receivingAccountId")}
        />
      ) : null}

      <Field
        id="activity-trade-date"
        name="tradeDate"
        label="Date"
        type="date"
        defaultValue={nowAsIstCalendarDate()}
        required
        error={fieldError("tradeDate")}
      />

      {kind === "buy" || kind === "sell" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="activity-quantity"
            name="quantity"
            label="Quantity"
            inputMode="decimal"
            required
            error={fieldError("quantity")}
          />
          <Field
            id="activity-unit-price"
            name="unitPrice"
            label="Unit price"
            inputMode="decimal"
            required
            error={fieldError("unitPrice")}
          />
        </div>
      ) : null}
      {kind === "buy" ? (
        <Field
          id="activity-fee"
          name="feeAmount"
          label="Fee (optional)"
          inputMode="decimal"
          description="Added to cost basis."
          error={fieldError("feeAmount")}
        />
      ) : null}
      {kind === "sell" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="activity-fee-sell"
            name="feeAmount"
            label="Fee (optional)"
            inputMode="decimal"
            error={fieldError("feeAmount")}
          />
          <Field
            id="activity-tax"
            name="taxAmount"
            label="Tax (optional)"
            inputMode="decimal"
            error={fieldError("taxAmount")}
          />
        </div>
      ) : null}

      {kind === "contribution" ||
      kind === "withdrawal" ||
      kind === "dividend" ||
      kind === "interest" ||
      kind === "fee" ? (
        <Field
          id="activity-gross-amount"
          name="grossAmount"
          label="Amount"
          inputMode="decimal"
          required
          error={fieldError("grossAmount")}
        />
      ) : null}

      {kind === "dividend" || kind === "interest" ? (
        <>
          <Select
            id="activity-category"
            name="categoryId"
            label="Category"
            options={incomeCategoryOptions}
            placeholder="Choose an income category"
            required
            error={fieldError("categoryId")}
          />
          <PayeeCombobox
            payees={payees}
            name="payeeId"
            label="Payer (optional)"
          />
        </>
      ) : null}
      {kind === "fee" ? (
        <Select
          id="activity-category-fee"
          name="categoryId"
          label="Category (optional)"
          options={expenseCategoryOptions}
          placeholder="Choose an expense category"
          error={fieldError("categoryId")}
        />
      ) : null}

      {kind === "adjustment" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="activity-quantity-delta"
            name="quantityDelta"
            label="Quantity delta (optional)"
            inputMode="decimal"
            description="Positive or negative, e.g. -2."
            error={fieldError("quantityDelta")}
          />
          <Field
            id="activity-cost-basis-delta"
            name="costBasisDelta"
            label="Cost basis delta (optional)"
            inputMode="decimal"
            error={fieldError("costBasisDelta")}
          />
        </div>
      ) : null}

      {kind === "buy" || kind === "sell" ? (
        <Field
          id="activity-settlement-date"
          name="settlementDate"
          label="Settlement date (optional)"
          type="date"
          error={fieldError("settlementDate")}
        />
      ) : null}

      <Field
        id="activity-notes"
        name="notes"
        label={kind === "adjustment" ? "Explanation" : "Notes (optional)"}
        required={kind === "adjustment"}
        error={fieldError("notes")}
      />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Recording…" disabled={cannotSell}>
        {`Record ${INVESTMENT_ACTIVITY_KIND_LABELS[kind].toLowerCase()}`}
      </SubmitButton>
    </form>
  );
}
