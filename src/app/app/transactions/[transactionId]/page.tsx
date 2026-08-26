import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EditTransactionForm } from "@/components/ledger/EditTransactionForm";
import { ReverseTransactionForm } from "@/components/ledger/ReverseTransactionForm";
import { ApplyIncomeAllocationPlanForm } from "@/components/wallets/ApplyIncomeAllocationPlanForm";
import { AssignWalletForm } from "@/components/wallets/AssignWalletForm";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastOnParam } from "@/components/ui/ToastOnParam";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/queries";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { getTransactionWithEntries } from "@/lib/ledger/queries";
import {
  MANUAL_TRANSACTION_TYPE_LABELS,
  MANUAL_TRANSACTION_TYPES,
  type TransactionType,
} from "@/lib/ledger/transaction-types";
import { listPayees } from "@/lib/payees/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOneOf } from "@/lib/types/literal";
import {
  getTransactionPurposeAllocation,
  listIncomeAllocationApplications,
  listIncomeAllocationPlans,
  listPurposeWallets,
} from "@/lib/wallets/queries";

type TransactionDetailPageProps = {
  params: Promise<{ transactionId: string }>;
  searchParams: Promise<{
    created?: string;
    reversed?: string;
    edited?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Transaction — PENRA Money OS",
};

function transactionTypeLabel(transactionType: TransactionType): string {
  return isOneOf(transactionType, MANUAL_TRANSACTION_TYPES)
    ? MANUAL_TRANSACTION_TYPE_LABELS[transactionType]
    : transactionType.replace(/_/g, " ");
}

/** Categories only ever apply to income/expense/credit_card_purchase — see validate_ledger_transaction_refs in supabase/migrations. */
function categoryTypeForTransaction(
  transactionType: TransactionType,
): "income" | "expense" | null {
  if (transactionType === "income") return "income";
  if (
    transactionType === "expense" ||
    transactionType === "credit_card_purchase"
  ) {
    return "expense";
  }
  return null;
}

export default async function TransactionDetailPage({
  params,
  searchParams,
}: Readonly<TransactionDetailPageProps>) {
  const { transactionId } = await params;
  const { created, reversed, edited } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/transactions/${transactionId}`);
  }

  const supabase = await createSupabaseServerClient();
  const detail = await getTransactionWithEntries(supabase, transactionId);

  if (!detail) {
    notFound();
  }

  const { transaction, entries, categoryName, payeeName } = detail;
  const categoryType = categoryTypeForTransaction(transaction.transactionType);
  const isEditable =
    transaction.status === "posted" && transaction.reversalOf === null;
  const isWalletAssignable =
    transaction.status === "posted" &&
    (transaction.transactionType === "expense" ||
      transaction.transactionType === "credit_card_purchase");
  const isIncomeAllocatable =
    transaction.status === "posted" && transaction.transactionType === "income";

  const [
    editCategories,
    payees,
    walletAllocation,
    wallets,
    allocationPlans,
    appliedAllocations,
  ] = await Promise.all([
    categoryType ? listCategories(supabase, categoryType) : Promise.resolve([]),
    isEditable ? listPayees(supabase) : Promise.resolve([]),
    isWalletAssignable
      ? getTransactionPurposeAllocation(supabase, transactionId)
      : Promise.resolve(null),
    isWalletAssignable
      ? listPurposeWallets(supabase, { includeArchived: true })
      : Promise.resolve([]),
    isIncomeAllocatable
      ? listIncomeAllocationPlans(supabase)
      : Promise.resolve([]),
    isIncomeAllocatable
      ? listIncomeAllocationApplications(supabase)
      : Promise.resolve([]),
  ]);
  const assignedWallet = walletAllocation
    ? wallets.find((w) => w.id === walletAllocation.walletId)
    : undefined;
  const assignableWallets = wallets.filter((w) => w.status === "active");
  const appliedToThisTransaction = appliedAllocations.filter(
    (a) => a.transactionId === transactionId && a.status === "applied",
  );
  const appliedPlanNames = appliedToThisTransaction
    .map((a) => allocationPlans.find((p) => p.id === a.planId)?.name)
    .filter((name): name is string => !!name);
  const applicablePlans = allocationPlans.filter(
    (p) => !appliedToThisTransaction.some((a) => a.planId === p.id),
  );

  const primaryEntryAmount =
    entries
      .find((entry) => !entry.amount.isZero())
      ?.amount.abs()
      .toString() ?? "0";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {created === "1" ? (
        <ToastOnParam param="created" message="Transaction recorded." />
      ) : null}
      {reversed === "1" ? (
        <ToastOnParam param="reversed" message="Transaction reversed." />
      ) : null}
      {edited === "1" ? (
        <ToastOnParam param="edited" message="Transaction corrected." />
      ) : null}

      <PageHeader
        eyebrow={
          <BackLink href="/app/transactions">Back to transactions</BackLink>
        }
        title={transaction.description}
        description={`${transactionTypeLabel(transaction.transactionType)} · ${formatIstDateTime(transaction.occurredAt)}`}
        actions={<StatusBadge status={transaction.status} />}
      />

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-border bg-surface p-5 text-sm sm:grid-cols-2">
        {categoryName ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-medium text-foreground">{categoryName}</dd>
          </div>
        ) : null}
        {payeeName ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Payee</dt>
            <dd className="font-medium text-foreground">{payeeName}</dd>
          </div>
        ) : null}
      </dl>

      {transaction.notes ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm whitespace-pre-wrap text-muted-foreground">
          {transaction.notes}
        </p>
      ) : null}

      {isWalletAssignable ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <AssignWalletForm
            transactionId={transaction.id}
            wallets={assignableWallets.map((w) => ({ id: w.id, name: w.name }))}
            assignedWalletName={assignedWallet?.name ?? null}
          />
        </div>
      ) : null}

      {isIncomeAllocatable ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <ApplyIncomeAllocationPlanForm
            transactionId={transaction.id}
            plans={applicablePlans.map((p) => ({ id: p.id, name: p.name }))}
            alreadyAppliedPlanNames={appliedPlanNames}
          />
        </div>
      ) : null}

      <section
        aria-labelledby="entries-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="entries-heading"
          className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Accounts affected
        </h2>
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
            >
              <span className="font-medium text-foreground">
                {entry.accountName}
              </span>
              <AmountDisplay value={entry.amount} variant="signed" />
            </li>
          ))}
        </ul>
      </section>

      {transaction.reversalOf ? (
        <p className="text-sm text-muted-foreground">
          Reverses{" "}
          <Link
            href={`/app/transactions/${transaction.reversalOf}`}
            className="font-medium text-primary hover:underline"
          >
            this transaction
          </Link>
          .
        </p>
      ) : null}

      {transaction.reversedBy ? (
        <p className="text-sm text-muted-foreground">
          Reversed by{" "}
          <Link
            href={`/app/transactions/${transaction.reversedBy}`}
            className="font-medium text-primary hover:underline"
          >
            this transaction
          </Link>
          .
        </p>
      ) : null}

      {transaction.replacesTransactionId ? (
        <p className="text-sm text-muted-foreground">
          Corrects{" "}
          <Link
            href={`/app/transactions/${transaction.replacesTransactionId}`}
            className="font-medium text-primary hover:underline"
          >
            an earlier transaction
          </Link>
          .
        </p>
      ) : null}

      {isEditable ? (
        <div className="flex flex-wrap gap-3 border-t border-border pt-6">
          <EditTransactionForm
            transactionId={transaction.id}
            defaultAmount={primaryEntryAmount}
            defaultOccurredOn={transaction.occurredAt.slice(0, 10)}
            defaultDescription={transaction.description}
            defaultNotes={transaction.notes}
            categories={
              categoryType
                ? editCategories.map((c) => ({ id: c.id, name: c.name }))
                : null
            }
            defaultCategoryId={transaction.categoryId}
            payees={payees.map((p) => ({ id: p.id, name: p.name }))}
            defaultPayee={
              payeeName && transaction.payeeId
                ? { id: transaction.payeeId, name: payeeName }
                : null
            }
          />
          <ReverseTransactionForm transactionId={transaction.id} />
        </div>
      ) : null}
    </div>
  );
}
