import { LinkExistingTransactionDialog } from "@/components/recurring/LinkExistingTransactionDialog";
import { RecordPaymentDialog } from "@/components/recurring/RecordPaymentDialog";
import { RetryOccurrenceButton } from "@/components/recurring/RetryOccurrenceButton";
import { SkipOccurrenceButton } from "@/components/recurring/SkipOccurrenceButton";
import type {
  RecurringAccountOption,
  RecurringCategoryOption,
} from "@/components/recurring/types";
import type { PayeeOption } from "@/components/ledger/PayeeCombobox";
import type { OccurrenceWithItem } from "@/lib/recurring/mapping";
import type { LinkableTransaction } from "@/lib/recurring/queries";
import type { RecurringItem } from "@/lib/recurring/mapping";

type OccurrenceActionsCellProps = {
  occurrence: OccurrenceWithItem;
  item: RecurringItem | undefined;
  accounts: RecurringAccountOption[];
  incomeCategories: RecurringCategoryOption[];
  expenseCategories: RecurringCategoryOption[];
  payees: PayeeOption[];
  linkableTransactions: LinkableTransaction[];
};

/** Every action a due/overdue/failed occurrence can take — derived from the occurrence's own status/processing mode, per the recurring item it belongs to. */
export function OccurrenceActionsCell({
  occurrence,
  item,
  accounts,
  incomeCategories,
  expenseCategories,
  payees,
  linkableTransactions,
}: Readonly<OccurrenceActionsCellProps>) {
  if (occurrence.status === "failed") {
    return <RetryOccurrenceButton occurrenceId={occurrence.id} />;
  }

  if (
    occurrence.processingMode !== "reminder_only" ||
    !["upcoming", "due", "overdue"].includes(occurrence.status) ||
    !item
  ) {
    return null;
  }

  const isTransfer = item.kind === "transfer";
  const categories =
    item.kind === "income" ? incomeCategories : expenseCategories;
  const sourceAccount = accounts.find((a) => a.id === item.sourceAccountId);
  const destinationAccount = accounts.find(
    (a) => a.id === item.destinationAccountId,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RecordPaymentDialog
        occurrenceId={occurrence.id}
        itemKind={item.kind}
        itemName={item.name}
        accounts={accounts}
        categories={categories}
        payees={payees}
        defaultAccountId={
          isTransfer
            ? null
            : (item.sourceAccountId ?? item.destinationAccountId)
        }
        defaultCategoryId={item.categoryId}
        defaultPayeeId={item.payeeId}
        defaultAmount={occurrence.amount.toString()}
        defaultDate={occurrence.scheduledDate}
        transferSourceAccount={
          isTransfer && sourceAccount
            ? { id: sourceAccount.id, name: sourceAccount.name }
            : undefined
        }
        transferDestinationAccount={
          isTransfer && destinationAccount
            ? { id: destinationAccount.id, name: destinationAccount.name }
            : undefined
        }
      />
      <LinkExistingTransactionDialog
        occurrenceId={occurrence.id}
        candidates={linkableTransactions}
      />
      <SkipOccurrenceButton occurrenceId={occurrence.id} />
    </div>
  );
}
