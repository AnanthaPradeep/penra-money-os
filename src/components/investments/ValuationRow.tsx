import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { formatIstDateTime } from "@/lib/dates/timezone";
import type { InvestmentValuation } from "@/lib/investments/mapping";

export function ValuationRow({
  valuation,
}: Readonly<{ valuation: InvestmentValuation }>) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-foreground">Manual valuation</span>
        <span className="truncate text-xs text-muted-foreground">
          {formatIstDateTime(valuation.valuedAt)}
          {valuation.note ? ` · ${valuation.note}` : ""}
        </span>
      </div>
      <AmountDisplay value={valuation.totalValue} size="sm" />
    </li>
  );
}
