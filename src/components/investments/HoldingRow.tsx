import Link from "next/link";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { HoldingSummary } from "@/lib/investments/mapping";
import { INVESTMENT_ASSET_KIND_LABELS } from "@/lib/investments/types";

export function HoldingRow({ holding }: Readonly<{ holding: HoldingSummary }>) {
  return (
    <Card>
      <CardContent className="p-4">
        <Link
          href={`/app/investments/${holding.holdingId}`}
          className="flex items-start justify-between gap-4"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium text-foreground hover:underline">
              {holding.displayName}
            </span>
            <span className="text-xs text-muted-foreground">
              {INVESTMENT_ASSET_KIND_LABELS[holding.assetKind]}
              {holding.symbol ? ` · ${holding.symbol}` : ""}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {holding.hasValuation ? (
              <AmountDisplay value={holding.currentValue} size="md" />
            ) : (
              <span className="text-sm text-muted-foreground">
                No valuation
              </span>
            )}
            {holding.status === "archived" ? (
              <StatusBadge status="archived" />
            ) : null}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
