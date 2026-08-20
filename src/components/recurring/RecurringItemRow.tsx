import Link from "next/link";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RECURRING_ITEM_KIND_LABELS } from "@/lib/recurring/types";
import type { RecurringItem } from "@/lib/recurring/mapping";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "weekly",
  monthly: "monthly",
  quarterly: "quarterly",
  half_yearly: "half-yearly",
  yearly: "yearly",
};

function formatCalendarDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  }).format(new Date(`${isoDate}T00:00:00+05:30`));
}

export function RecurringItemRow({ item }: Readonly<{ item: RecurringItem }>) {
  const frequencyLabel = FREQUENCY_LABELS[item.frequency] ?? item.frequency;
  const cadence =
    item.intervalCount > 1
      ? `every ${item.intervalCount} ${frequencyLabel.replace("ly", "s")}`
      : frequencyLabel;

  return (
    <Link
      href={`/app/recurring/${item.id}`}
      className="block rounded-lg transition-colors hover:border-input-border"
    >
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium text-foreground">
              {item.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {RECURRING_ITEM_KIND_LABELS[item.kind]} &middot; {cadence}
              {item.nextDueDate
                ? ` · next ${formatCalendarDate(item.nextDueDate)}`
                : ""}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <AmountDisplay value={item.amount} size="md" />
            <StatusBadge status={item.status} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
