"use client";

import { useActionState } from "react";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_BANK_IMPORT_ACTION_STATE } from "@/lib/bank-import/action-state";
import {
  postImportBatchAction,
  saveReconciliationBalancesAction,
} from "@/lib/bank-import/actions";
import type { ReconciliationSummary } from "@/lib/bank-import/types";

type ReconciliationPanelProps = {
  importId: string;
  summary: ReconciliationSummary;
  defaultOpeningBalance: string;
  defaultClosingBalance: string;
  canPost: boolean;
};

const STATUS_COPY: Record<ReconciliationSummary["status"], string> = {
  not_started:
    "Enter the statement's opening and closing balance to reconcile.",
  incomplete:
    "One of the balances is missing — reconciliation can't be finalized yet.",
  in_progress: "The numbers line up. This will show as balanced once posted.",
  balanced:
    "Balanced — the posted total matches the statement's closing balance.",
  difference:
    "There's a difference between what was imported and the statement's closing balance.",
};

export function ReconciliationPanel({
  importId,
  summary,
  defaultOpeningBalance,
  defaultClosingBalance,
  canPost,
}: Readonly<ReconciliationPanelProps>) {
  const [balancesState, balancesAction] = useActionState(
    saveReconciliationBalancesAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );
  const [postState, postAction] = useActionState(
    postImportBatchAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={balancesAction} className="flex flex-col gap-4">
        <input type="hidden" name="importId" value={importId} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="opening-balance"
            name="openingBalance"
            label="Statement opening balance"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={defaultOpeningBalance}
            error={
              balancesState.status === "error"
                ? balancesState.fieldErrors?.openingBalance
                : undefined
            }
          />
          <Field
            id="closing-balance"
            name="closingBalance"
            label="Statement closing balance"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={defaultClosingBalance}
            error={
              balancesState.status === "error"
                ? balancesState.fieldErrors?.closingBalance
                : undefined
            }
          />
        </div>
        {balancesState.status === "error" ? (
          <FormMessage message={balancesState.message} tone="error" />
        ) : null}
        <SubmitButton className="w-fit" pendingText="Saving…">
          Save balances
        </SubmitButton>
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-elevated p-3">
          <p className="text-xs text-muted-foreground">Included amount</p>
          <AmountDisplay value={summary.importedAmount} size="lg" />
        </div>
        <div className="rounded-lg border border-border bg-elevated p-3">
          <p className="text-xs text-muted-foreground">Matched to existing</p>
          <AmountDisplay value={summary.matchedAmount} size="lg" />
        </div>
        <div className="rounded-lg border border-border bg-elevated p-3">
          <p className="text-xs text-muted-foreground">Excluded amount</p>
          <AmountDisplay value={summary.excludedAmount} size="lg" />
        </div>
      </div>

      {summary.expectedClosingBalance ? (
        <div className="rounded-lg border border-border bg-elevated p-3">
          <p className="text-xs text-muted-foreground">
            Opening + net movement = expected closing
          </p>
          <AmountDisplay value={summary.expectedClosingBalance} size="lg" />
          {summary.difference ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Difference from statement closing balance:{" "}
              <AmountDisplay
                value={summary.difference}
                size="sm"
                variant="signed"
              />
            </p>
          ) : null}
        </div>
      ) : null}

      <FormMessage
        tone={
          summary.status === "balanced" || summary.status === "in_progress"
            ? "success"
            : "error"
        }
        message={STATUS_COPY[summary.status]}
      />

      {summary.invalidRowCount > 0 ? (
        <p className="text-sm text-warning">
          {summary.invalidRowCount} row(s) still have validation issues and
          won&rsquo;t post until fixed or excluded — see the review screen.
        </p>
      ) : null}

      <form action={postAction} className="flex flex-col gap-2">
        <input type="hidden" name="importId" value={importId} />
        {postState.status === "error" ? (
          <FormMessage message={postState.message} tone="error" />
        ) : null}
        <SubmitButton
          className="w-fit"
          pendingText="Posting…"
          disabled={!canPost}
        >
          Post confirmed transactions
        </SubmitButton>
      </form>
    </div>
  );
}
