import Link from "next/link";

import { OccurrenceActionsCell } from "@/components/recurring/OccurrenceActionsCell";
import type {
  RecurringAccountOption,
  RecurringCategoryOption,
} from "@/components/recurring/types";
import type { PayeeOption } from "@/components/ledger/PayeeCombobox";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RECURRING_ITEM_KIND_LABELS } from "@/lib/recurring/types";
import type {
  OccurrenceWithItem,
  RecurringItem,
} from "@/lib/recurring/mapping";
import type { LinkableTransaction } from "@/lib/recurring/queries";

type OccurrenceRowProps = {
  occurrence: OccurrenceWithItem;
  item: RecurringItem | undefined;
  accounts: RecurringAccountOption[];
  incomeCategories: RecurringCategoryOption[];
  expenseCategories: RecurringCategoryOption[];
  payees: PayeeOption[];
  linkableTransactions: LinkableTransaction[];
};

function formatCalendarDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  }).format(new Date(`${isoDate}T00:00:00+05:30`));
}

export function OccurrenceRow({
  occurrence,
  item,
  accounts,
  incomeCategories,
  expenseCategories,
  payees,
  linkableTransactions,
}: Readonly<OccurrenceRowProps>) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              href={`/app/recurring/${occurrence.recurringItemId}`}
              className="truncate font-medium text-foreground hover:underline"
            >
              {occurrence.itemName}
            </Link>
            <span className="text-xs text-muted-foreground">
              {RECURRING_ITEM_KIND_LABELS[occurrence.itemKind]} &middot;{" "}
              {formatCalendarDate(occurrence.scheduledDate)}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <AmountDisplay value={occurrence.amount} size="md" />
            <StatusBadge status={occurrence.status} />
          </div>
        </div>
        <OccurrenceActionsCell
          occurrence={occurrence}
          item={item}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          payees={payees}
          linkableTransactions={linkableTransactions}
        />
      </CardContent>
    </Card>
  );
}
