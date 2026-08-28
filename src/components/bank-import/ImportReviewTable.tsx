"use client";

import { useActionState, useState } from "react";

import {
  ImportRowCard,
  type ReviewRow,
} from "@/components/bank-import/ImportRowCard";
import { FormMessage } from "@/components/ui/FormMessage";
import { INITIAL_BANK_IMPORT_ACTION_STATE } from "@/lib/bank-import/action-state";
import { bulkUpdateImportRowsAction } from "@/lib/bank-import/actions";
import type { RowMatch } from "@/lib/bank-import/mapping";

type OptionItem = { value: string; label: string };

type ImportReviewTableProps = {
  importId: string;
  rows: ReviewRow[];
  matchesByRowId: Record<string, RowMatch[]>;
  incomeCategoryOptions: OptionItem[];
  expenseCategoryOptions: OptionItem[];
  walletOptions: OptionItem[];
};

export function ImportReviewTable({
  importId,
  rows,
  matchesByRowId,
  incomeCategoryOptions,
  expenseCategoryOptions,
  walletOptions,
}: Readonly<ImportReviewTableProps>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkState, bulkAction] = useActionState(
    bulkUpdateImportRowsAction,
    INITIAL_BANK_IMPORT_ACTION_STATE,
  );

  function toggle(rowId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        action={bulkAction}
        className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-elevated p-3"
      >
        <input type="hidden" name="importId" value={importId} />
        {[...selected].map((rowId) => (
          <input key={rowId} type="hidden" name="rowIds" value={rowId} />
        ))}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={selected.size > 0 && selected.size === rows.length}
            onChange={toggleAll}
          />
          {selected.size} selected
        </label>
        <button
          type="submit"
          name="userDecision"
          value="include"
          disabled={selected.size === 0}
          className="h-9 rounded-md border border-input-border px-3 text-sm font-medium text-foreground hover:bg-muted-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          Include
        </button>
        <button
          type="submit"
          name="userDecision"
          value="exclude"
          disabled={selected.size === 0}
          className="h-9 rounded-md border border-input-border px-3 text-sm font-medium text-foreground hover:bg-muted-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          Exclude
        </button>
      </form>
      {bulkState.status === "error" ? (
        <FormMessage message={bulkState.message} tone="error" />
      ) : null}

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <ImportRowCard
            key={row.id}
            row={row}
            matches={matchesByRowId[row.id] ?? []}
            incomeCategoryOptions={incomeCategoryOptions}
            expenseCategoryOptions={expenseCategoryOptions}
            walletOptions={walletOptions}
            selected={selected.has(row.id)}
            onToggleSelected={toggle}
          />
        ))}
      </div>
    </div>
  );
}
