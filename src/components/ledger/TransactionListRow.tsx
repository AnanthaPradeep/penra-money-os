import Link from "next/link";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatIstDateTime } from "@/lib/dates/timezone";
import type { TransactionListItem } from "@/lib/ledger/queries";
import {
  MANUAL_TRANSACTION_TYPE_LABELS,
  MANUAL_TRANSACTION_TYPES,
} from "@/lib/ledger/transaction-types";
import { isOneOf } from "@/lib/types/literal";

function transactionKindLabel(item: TransactionListItem): string {
  const type = item.transaction.transactionType;
  return isOneOf(type, MANUAL_TRANSACTION_TYPES)
    ? MANUAL_TRANSACTION_TYPE_LABELS[type]
    : type.replace(/_/g, " ");
}

export function TransactionListRow({
  item,
}: Readonly<{ item: TransactionListItem }>) {
  const { transaction, primaryEntry, categoryName, payeeName } = item;
  const isTransfer = transaction.transactionType === "transfer";
  const subtitle =
    categoryName ?? (isTransfer ? "Transfer" : transactionKindLabel(item));

  return (
    <li>
      <Link
        href={`/app/transactions/${transaction.id}`}
        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:bg-muted-surface"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">
            {payeeName ?? transaction.description}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {formatIstDateTime(transaction.occurredAt)} · {subtitle} ·{" "}
            {primaryEntry.accountName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {transaction.status === "reversed" ? (
            <StatusBadge status="reversed" />
          ) : null}
          <AmountDisplay
            value={isTransfer ? primaryEntry.amount.abs() : primaryEntry.amount}
            variant={isTransfer ? "neutral" : "signed"}
            size="sm"
          />
        </div>
      </Link>
    </li>
  );
}
