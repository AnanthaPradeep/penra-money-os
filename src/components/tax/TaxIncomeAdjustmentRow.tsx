"use client";

import { useActionState } from "react";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  deleteTaxIncomeAdjustmentAction,
  setTaxIncomeAdjustmentStatusAction,
} from "@/lib/tax/actions";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import {
  INCOME_CATEGORY_LABELS,
  type TaxIncomeAdjustment,
} from "@/lib/tax/mapping";

export function TaxIncomeAdjustmentRow({
  item,
  financialYearId,
}: Readonly<{ item: TaxIncomeAdjustment; financialYearId: string }>) {
  const [, confirmAction] = useActionState(
    setTaxIncomeAdjustmentStatusAction,
    INITIAL_TAX_ACTION_STATE,
  );
  const [, deleteAction] = useActionState(
    deleteTaxIncomeAdjustmentAction,
    INITIAL_TAX_ACTION_STATE,
  );

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 font-medium text-foreground">
          {INCOME_CATEGORY_LABELS[item.category]}
          <StatusBadge
            status={item.status === "confirmed" ? "posted" : "draft"}
          />
          {item.isExemptCandidate ? (
            <Badge variant="info">Exempt candidate</Badge>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">
          Gross {item.grossAmount.toString()} · TDS {item.tdsAmount.toString()}{" "}
          · Net {item.netAmount.toString()}
          {item.evidenceLabel ? ` · ${item.evidenceLabel}` : ""}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <AmountDisplay value={item.netAmount} size="sm" />
        {item.status === "draft" ? (
          <form action={confirmAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="status" value="confirmed" />
            <input
              type="hidden"
              name="financialYearId"
              value={financialYearId}
            />
            <Button type="submit" variant="outline" size="sm">
              Confirm
            </Button>
          </form>
        ) : null}
        <form action={deleteAction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="financialYearId" value={financialYearId} />
          <Button type="submit" variant="ghost" size="sm">
            Remove
          </Button>
        </form>
      </div>
    </li>
  );
}
