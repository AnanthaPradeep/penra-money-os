"use client";

import { useActionState } from "react";
import { Link2, Repeat } from "lucide-react";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_BANK_IMPORT_ACTION_STATE } from "@/lib/bank-import/action-state";
import {
  confirmTransferMatchAction,
  linkExistingTransactionAction,
  unlinkImportRowAction,
  updateImportRowAction,
} from "@/lib/bank-import/actions";
import type { RowMatch } from "@/lib/bank-import/mapping";
import { Decimal } from "@/lib/money/decimal";

export type ReviewRow = {
  id: string;
  transactionDate: string | null;
  description: string;
  reference: string | null;
  amount: string | null;
  direction: "debit" | "credit" | null;
  duplicateStatus: string;
  matchStatus: string;
  userDecision: "pending" | "include" | "exclude";
  resolvedTransactionType: string | null;
  suggestedCategoryId: string | null;
  linkedExistingTransactionId: string | null;
  transferGroupId: string | null;
  validationErrorCount: number;
};

type OptionItem = { value: string; label: string };

type ImportRowCardProps = {
  row: ReviewRow;
  matches: RowMatch[];
  categoryOptions: OptionItem[];
  selected: boolean;
  onToggleSelected: (rowId: string) => void;
};

const DUPLICATE_STATUS_LABEL: Partial<Record<string, string>> = {
  exact_row_duplicate: "Duplicate in this file",
  existing_transaction_match: "Matches an existing transaction",
  possible_duplicate: "Possible duplicate",
};

const RESOLVED_TYPE_OPTIONS: OptionItem[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "credit_card_purchase", label: "Credit card purchase" },
  { value: "credit_card_payment", label: "Credit card payment" },
];

const DECISION_OPTIONS: OptionItem[] = [
  { value: "pending", label: "Pending" },
  { value: "include", label: "Include" },
  { value: "exclude", label: "Exclude" },
];

export function ImportRowCard({
  row,
  matches,
  categoryOptions,
  selected,
  onToggleSelected,
}: Readonly<ImportRowCardProps>) {
  const [updateState, updateAction] = useActionState(
    updateImportRowAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );
  const [linkState, linkAction] = useActionState(
    linkExistingTransactionAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );
  const [unlinkState, unlinkAction] = useActionState(
    unlinkImportRowAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );
  const [transferState, transferAction] = useActionState(
    confirmTransferMatchAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );

  const existingCandidates = matches.filter(
    (m) => m.matchKind === "existing_transaction",
  );
  const transferCandidates = matches.filter(
    (m) => m.matchKind === "transfer_row",
  );
  const isInvalid = row.validationErrorCount > 0 && !row.transactionDate;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelected(row.id)}
          aria-label={`Select row: ${row.description}`}
          className="mt-1"
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium text-foreground">
              {row.description || "(no description)"}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.transactionDate ?? "no date"}
              {row.reference ? ` · Ref ${row.reference}` : ""}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {row.amount ? (
              <AmountDisplay
                value={
                  row.direction === "debit"
                    ? new Decimal(row.amount).negated()
                    : new Decimal(row.amount)
                }
                variant="signed"
                size="sm"
              />
            ) : (
              <span className="text-sm text-negative">No amount</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DUPLICATE_STATUS_LABEL[row.duplicateStatus] ? (
          <span className="rounded-full bg-warning-surface px-2 py-0.5 text-xs font-medium text-warning">
            {DUPLICATE_STATUS_LABEL[row.duplicateStatus]}
          </span>
        ) : null}
        {isInvalid ? (
          <span className="rounded-full bg-negative-surface px-2 py-0.5 text-xs font-medium text-negative">
            Invalid row — can&rsquo;t be posted as-is
          </span>
        ) : null}
        {row.transferGroupId ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-positive-surface px-2 py-0.5 text-xs font-medium text-positive">
            <Repeat aria-hidden="true" className="size-3" />
            Transfer confirmed
          </span>
        ) : null}
        {row.linkedExistingTransactionId ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-positive-surface px-2 py-0.5 text-xs font-medium text-positive">
            <Link2 aria-hidden="true" className="size-3" />
            Linked to existing transaction
          </span>
        ) : null}
      </div>

      {row.linkedExistingTransactionId ? (
        <form action={unlinkAction}>
          <input type="hidden" name="rowId" value={row.id} />
          <button
            type="submit"
            className="w-fit text-xs font-medium text-primary hover:underline"
          >
            Undo link
          </button>
        </form>
      ) : null}
      {unlinkState.status === "error" ? (
        <FormMessage message={unlinkState.message} tone="error" />
      ) : null}

      {!row.linkedExistingTransactionId && existingCandidates.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
          <p className="text-xs font-medium text-muted-foreground">
            Possible existing transaction match:
          </p>
          {existingCandidates.slice(0, 3).map((match) => (
            <form
              key={match.id}
              action={linkAction}
              className="flex items-center justify-between gap-2"
            >
              <input type="hidden" name="rowId" value={row.id} />
              <input
                type="hidden"
                name="transactionId"
                value={match.candidateTransactionId ?? ""}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {match.reasons.join(", ")} ({Math.round(match.score * 100)}%)
              </span>
              <button
                type="submit"
                className="shrink-0 rounded-md border border-input-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted-surface"
              >
                Link
              </button>
            </form>
          ))}
        </div>
      ) : null}
      {linkState.status === "error" ? (
        <FormMessage message={linkState.message} tone="error" />
      ) : null}

      {!row.transferGroupId && transferCandidates.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
          <p className="text-xs font-medium text-muted-foreground">
            Possible transfer counterpart:
          </p>
          {transferCandidates.slice(0, 3).map((match) => (
            <form
              key={match.id}
              action={transferAction}
              className="flex items-center justify-between gap-2"
            >
              <input type="hidden" name="rowId" value={row.id} />
              <input
                type="hidden"
                name="candidateRowId"
                value={match.candidateRowId ?? ""}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {match.reasons.join(", ")} ({Math.round(match.score * 100)}%)
              </span>
              <button
                type="submit"
                className="shrink-0 rounded-md border border-input-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted-surface"
              >
                Confirm transfer
              </button>
            </form>
          ))}
        </div>
      ) : null}
      {transferState.status === "error" ? (
        <FormMessage message={transferState.message} tone="error" />
      ) : null}

      <form
        action={updateAction}
        className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-end"
      >
        <input type="hidden" name="rowId" value={row.id} />
        <Select
          id={`decision-${row.id}`}
          name="userDecision"
          label="Decision"
          options={DECISION_OPTIONS}
          defaultValue={row.userDecision}
        />
        <Select
          id={`type-${row.id}`}
          name="resolvedTransactionType"
          label="Post as"
          options={RESOLVED_TYPE_OPTIONS}
          defaultValue={row.resolvedTransactionType ?? undefined}
          placeholder="Choose"
        />
        <Select
          id={`category-${row.id}`}
          name="categoryId"
          label="Category"
          options={categoryOptions}
          defaultValue={row.suggestedCategoryId ?? undefined}
          placeholder="None"
        />
        <SubmitButton pendingText="Saving…" className="h-11">
          Save
        </SubmitButton>
      </form>
      {updateState.status === "error" ? (
        <FormMessage message={updateState.message} tone="error" />
      ) : null}
    </div>
  );
}
