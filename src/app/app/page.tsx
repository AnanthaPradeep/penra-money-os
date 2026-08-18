import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusCircle, Wallet } from "lucide-react";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { listRecentTransactionsForUser } from "@/lib/ledger/queries";
import { getProfileForUser } from "@/lib/profile/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Home — PENRA Money OS",
};

/**
 * Already gated by src/proxy.ts and src/app/app/layout.tsx for
 * unauthenticated requests, but Server Functions/layouts are not
 * guaranteed to be covered by every Proxy matcher change, so this page
 * independently re-verifies the session rather than assuming that already
 * handled it — defence in depth, per Next.js's own guidance.
 */
export default async function AppHomePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app");
  }

  const supabase = await createSupabaseServerClient();
  const [profile, accounts, recentActivity] = await Promise.all([
    getProfileForUser(user.id),
    listAccountsWithBalances(supabase),
    listRecentTransactionsForUser(supabase, 6),
  ]);

  const displayName = profile?.display_name;
  const hasAccounts = accounts.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={displayName ? `Welcome back, ${displayName}` : "Welcome back"}
        description="Here's where things stand."
        actions={
          hasAccounts ? (
            <Button asChild>
              <Link href="/app/transactions/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                New transaction
              </Link>
            </Button>
          ) : null
        }
      />

      {!hasAccounts ? (
        <EmptyState
          icon={<Wallet aria-hidden="true" className="size-6" />}
          title="Add your first account"
          description="Bank, cash, wallet, credit card, or loan — once an account exists you can start recording transactions against it."
          action={
            <Button asChild>
              <Link href="/app/accounts/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                Add an account
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <section
            aria-labelledby="accounts-summary-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="accounts-summary-heading"
              title={`${accounts.length} active ${accounts.length === 1 ? "account" : "accounts"}`}
              actions={
                <Link
                  href="/app/accounts"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              }
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.slice(0, 6).map((account) => (
                <Card key={account.id}>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="truncate text-sm text-muted-foreground">
                      {account.name}
                    </p>
                    <AmountDisplay value={account.displayBalance} size="lg" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="recent-activity-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="recent-activity-heading"
              title="Recent activity"
            />
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No transactions recorded yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentActivity.map(({ transaction, primaryEntry }) => (
                  <li key={transaction.id}>
                    <Link
                      href={`/app/transactions/${transaction.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm transition-colors hover:border-input-border"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium text-foreground">
                          {transaction.description}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {primaryEntry.accountName} &middot;{" "}
                          {formatIstDateTime(transaction.occurredAt)}
                        </span>
                      </span>
                      <AmountDisplay
                        value={primaryEntry.amount}
                        variant="signed"
                        size="sm"
                        className="shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
