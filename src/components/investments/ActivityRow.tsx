import { ReverseActivityButton } from "@/components/investments/ReverseActivityButton";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatIstDateTime } from "@/lib/dates/timezone";
import type { InvestmentActivity } from "@/lib/investments/mapping";
import { INVESTMENT_ACTIVITY_KIND_LABELS } from "@/lib/investments/types";

export function ActivityRow({
  activity,
}: Readonly<{ activity: InvestmentActivity }>) {
  const canReverse =
    activity.status === "posted" &&
    activity.ledgerTransactionId !== null &&
    activity.reversedBy === null;

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-foreground">
          {INVESTMENT_ACTIVITY_KIND_LABELS[activity.activityKind]}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {formatIstDateTime(`${activity.tradeDate}T00:00:00+05:30`)}
          {activity.quantity ? ` · ${activity.quantity.toString()} units` : ""}
          {activity.notes ? ` · ${activity.notes}` : ""}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {activity.status === "reversed" ? (
          <StatusBadge status="reversed" />
        ) : null}
        <AmountDisplay value={activity.grossAmount} size="sm" />
        {canReverse ? <ReverseActivityButton activityId={activity.id} /> : null}
      </div>
    </li>
  );
}
