import { PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArchiveAccountForm } from "@/components/accounts/ArchiveAccountForm";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastOnParam } from "@/components/ui/ToastOnParam";
import {
  ACCOUNT_TYPE_LABELS,
  USER_ACCOUNT_TYPES,
} from "@/lib/accounts/classes";
import {
  getAccountIntegrationSummary,
  getAccountWithBalance,
} from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getAccountImportSummary } from "@/lib/bank-import/queries";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { listEntriesForAccount } from "@/lib/ledger/queries";
import { Decimal } from "@/lib/money/decimal";
import { formatINR } from "@/lib/money/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOneOf } from "@/lib/types/literal";

type AccountDetailPageProps = {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ archived?: string }>;
};

export const metadata: Metadata = {
  title: "Account — PENRA Money OS",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00+05:30`));
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: Readonly<AccountDetailPageProps>) {
  const { accountId } = await params;
  const { archived } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/accounts/${accountId}`);
  }

  const supabase = await createSupabaseServerClient();
  const account = await getAccountWithBalance(supabase, accountId);

  // System accounts (Opening Balance Equity, Uncategorized Income/Expense)
  // are never shown in the UI — RLS would let the owner read the row, but
  // this page must not surface it regardless.
  if (!account || account.isSystem) {
    notFound();
  }

  const [history, importSummary, integrationSummary] = await Promise.all([
    listEntriesForAccount(supabase, accountId),
    getAccountImportSummary(supabase, accountId),
    getAccountIntegrationSummary(supabase, accountId, account),
  ]);

  const isLiability = account.accountClass === "liability";
  const typeLabel = isOneOf(account.accountType, USER_ACCOUNT_TYPES)
    ? ACCOUNT_TYPE_LABELS[account.accountType]
    : account.accountType;

  // Credit utilisation stays on Decimal end-to-end; only the final
  // percentage is converted to a number, and only for the progress bar's
  // CSS width and rounded display text — never for the underlying amounts.
  const owed = isLiability ? account.displayBalance : new Decimal(0);
  const creditLimit = account.creditLimit;
  const utilisationPercent =
    creditLimit !== null && creditLimit.greaterThan(0)
      ? Decimal.max(Decimal.min(owed.dividedBy(creditLimit).times(100), 100), 0)
      : null;

  return (
    <div className="flex flex-col gap-8">
      {archived === "1" ? (
        <ToastOnParam param="archived" message="Account archived." />
      ) : null}

      <PageHeader
        eyebrow={<BackLink href="/app/accounts">Back to accounts</BackLink>}
        title={account.name}
        description={`${typeLabel}${account.lastFour ? ` · •••• ${account.lastFour}` : ""}`}
        actions={
          <>
            {account.isArchived ? (
              <StatusBadge status="archived" />
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link href={`/app/import/new?account=${account.id}`}>
                    Import statement
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={`/app/transactions/new?account=${account.id}`}>
                    <PlusCircle aria-hidden="true" className="size-4" />
                    New transaction
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-1 p-5 pt-5">
            <p className="text-sm text-muted-foreground">
              {isLiability ? "You owe" : "Balance"}
            </p>
            <AmountDisplay value={account.displayBalance} size="xl" />
          </CardContent>
        </Card>

        {creditLimit !== null && utilisationPercent !== null ? (
          <Card>
            <CardContent className="flex flex-col gap-2 p-5 pt-5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-muted-foreground">Credit used</p>
                <p className="text-sm font-medium text-foreground tabular-nums">
                  {utilisationPercent.toFixed(0)}%
                </p>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Number(utilisationPercent.toFixed(0))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Credit utilisation"
                className="h-2 w-full overflow-hidden rounded-full bg-muted-surface"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${utilisationPercent.toFixed(2)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatINR(owed)} of {formatINR(creditLimit)} limit
              </p>
            </CardContent>
          </Card>
        ) : account.accountType === "credit_card" ? (
          <Card>
            <CardContent className="flex flex-col gap-1 p-5 pt-5">
              <p className="text-sm text-muted-foreground">Credit limit</p>
              <p className="text-sm text-foreground">Not set</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-border bg-surface p-5 text-sm sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Opened</dt>
          <dd className="font-medium text-foreground">
            {formatDate(account.openedOn)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium text-foreground">
            <StatusBadge status={account.isArchived ? "archived" : "active"} />
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Currency</dt>
          <dd className="font-medium text-foreground">{account.currency}</dd>
        </div>
      </div>

      {account.notes ? (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">
          {account.notes}
        </p>
      ) : null}

      {importSummary.lastImport ? (
        <Link
          href={`/app/import/${importSummary.lastImport.id}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 text-sm transition-colors hover:border-input-border"
        >
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">
              Last statement import: {importSummary.lastImport.originalFilename}
            </span>
            <span className="text-xs text-muted-foreground">
              {importSummary.lastImport.status === "completed" &&
              importSummary.lastImport.completedAt
                ? `Completed ${formatIstDateTime(importSummary.lastImport.completedAt)}`
                : `Uploaded ${formatIstDateTime(importSummary.lastImport.createdAt)}`}
            </span>
          </span>
          <StatusBadge
            status={
              importSummary.lastImport.status === "completed"
                ? importSummary.lastImport.reconciliationStatus === "balanced"
                  ? "balanced"
                  : "unreconciled"
                : (importSummary.lastImport.status as Parameters<
                    typeof StatusBadge
                  >[0]["status"])
            }
          />
        </Link>
      ) : null}

      <section
        aria-labelledby="integration-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader
          id="integration-heading"
          title="Linked elsewhere in PENRA"
        />
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-5 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Cash-flow forecast</dt>
            <dd className="font-medium text-foreground">
              {integrationSummary.forecastEligible
                ? "Included — counts toward eligible liquid balance"
                : "Not included — this account type isn't counted as spendable cash"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Purpose-wallet tagging</dt>
            <dd className="font-medium text-foreground">
              {integrationSummary.walletEligibleTransactionCount === 0
                ? "No expense transactions eligible yet"
                : `${integrationSummary.backedAllocations.reduce((n, b) => n + b.transactionCount, 0)} of ${integrationSummary.walletEligibleTransactionCount} eligible expense transactions tagged to a wallet`}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Linked debt</dt>
            <dd className="font-medium text-foreground">
              {integrationSummary.linkedDebt ? (
                <Link
                  href={`/app/debts/${integrationSummary.linkedDebt.debtId}`}
                  className="text-primary hover:underline"
                >
                  {integrationSummary.linkedDebt.name}
                </Link>
              ) : (
                "None"
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Linked goals</dt>
            <dd className="font-medium text-foreground">
              {integrationSummary.linkedGoals.length === 0 ? (
                "None"
              ) : (
                <span className="flex flex-col gap-0.5">
                  {integrationSummary.linkedGoals.map((g) => (
                    <Link
                      key={g.goalId}
                      href={`/app/goals/${g.goalId}`}
                      className="text-primary hover:underline"
                    >
                      {g.name}
                    </Link>
                  ))}
                </span>
              )}
            </dd>
          </div>
        </div>
        {integrationSummary.backedAllocations.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {integrationSummary.backedAllocations.map((b) => (
              <li
                key={b.walletId}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
              >
                <span className="text-foreground">
                  {b.walletName} · {b.transactionCount}{" "}
                  {b.transactionCount === 1 ? "transaction" : "transactions"}
                </span>
                <AmountDisplay value={b.totalAmount} size="sm" />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        aria-labelledby="activity-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader
          id="activity-heading"
          title="Recent activity"
          actions={
            history.length > 0 ? (
              <Link
                href={`/app/transactions?account=${account.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            ) : undefined
          }
        />
        {history.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Transactions on this account will appear here."
            action={
              !account.isArchived ? (
                <Button asChild variant="outline">
                  <Link href={`/app/transactions/new?account=${account.id}`}>
                    Record a transaction
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map(({ entry, transaction }) => (
              <li key={entry.id}>
                <Link
                  href={`/app/transactions/${transaction.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm transition-colors hover:border-input-border"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">
                        {transaction.description}
                      </span>
                      {transaction.status === "reversed" ? (
                        <StatusBadge status="reversed" />
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatIstDateTime(transaction.occurredAt)}
                    </span>
                  </span>
                  <AmountDisplay
                    value={entry.amount}
                    variant="signed"
                    className="shrink-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!account.isArchived ? (
        <div className="border-t border-border pt-6">
          <ArchiveAccountForm
            accountId={account.id}
            accountName={account.name}
          />
        </div>
      ) : null}
    </div>
  );
}
