import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ReverseTransactionForm } from "@/components/ledger/ReverseTransactionForm";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastOnParam } from "@/components/ui/ToastOnParam";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { getTransactionWithEntries } from "@/lib/ledger/queries";
import {
  MANUAL_TRANSACTION_TYPE_LABELS,
  MANUAL_TRANSACTION_TYPES,
  type TransactionType,
} from "@/lib/ledger/transaction-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOneOf } from "@/lib/types/literal";

type TransactionDetailPageProps = {
  params: Promise<{ transactionId: string }>;
  searchParams: Promise<{ created?: string; reversed?: string }>;
};

export const metadata: Metadata = {
  title: "Transaction — PENRA Money OS",
};

function transactionTypeLabel(transactionType: TransactionType): string {
  return isOneOf(transactionType, MANUAL_TRANSACTION_TYPES)
    ? MANUAL_TRANSACTION_TYPE_LABELS[transactionType]
    : transactionType.replace(/_/g, " ");
}

export default async function TransactionDetailPage({
  params,
  searchParams,
}: Readonly<TransactionDetailPageProps>) {
  const { transactionId } = await params;
  const { created, reversed } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/transactions/${transactionId}`);
  }

  const supabase = await createSupabaseServerClient();
  const detail = await getTransactionWithEntries(supabase, transactionId);

  if (!detail) {
    notFound();
  }

  const { transaction, entries } = detail;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {created === "1" ? (
        <ToastOnParam param="created" message="Transaction recorded." />
      ) : null}
      {reversed === "1" ? (
        <ToastOnParam param="reversed" message="Transaction reversed." />
      ) : null}

      <PageHeader
        eyebrow={<BackLink href="/app/accounts">Back to accounts</BackLink>}
        title={transaction.description}
        description={`${transactionTypeLabel(transaction.transactionType)} · ${formatIstDateTime(transaction.occurredAt)}`}
        actions={<StatusBadge status={transaction.status} />}
      />

      {transaction.notes ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm whitespace-pre-wrap text-muted-foreground">
          {transaction.notes}
        </p>
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

      {transaction.status === "posted" ? (
        <div className="border-t border-border pt-6">
          <ReverseTransactionForm transactionId={transaction.id} />
        </div>
      ) : null}
    </div>
  );
}
