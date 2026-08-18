import { CreditCard, PlusCircle, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  ACCOUNT_TYPE_LABELS,
  USER_ACCOUNT_TYPES,
} from "@/lib/accounts/classes";
import {
  listAccountsWithBalances,
  type AccountWithBalance,
} from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOneOf } from "@/lib/types/literal";

export const metadata: Metadata = {
  title: "Accounts — PENRA Money OS",
};

function AccountRow({ account }: Readonly<{ account: AccountWithBalance }>) {
  const typeLabel = isOneOf(account.accountType, USER_ACCOUNT_TYPES)
    ? ACCOUNT_TYPE_LABELS[account.accountType]
    : account.accountType;
  const isLiability = account.accountClass === "liability";

  return (
    <li>
      <Link
        href={`/app/accounts/${account.id}`}
        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 transition-colors hover:border-input-border"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted-surface text-muted-foreground"
          >
            {account.accountType === "credit_card" ? (
              <CreditCard className="size-4" />
            ) : (
              <Wallet className="size-4" />
            )}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {account.name}
              </span>
              {account.isArchived ? (
                <Badge variant="neutral">Archived</Badge>
              ) : null}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {typeLabel}
              {account.lastFour ? ` · •••• ${account.lastFour}` : ""}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <AmountDisplay value={account.displayBalance} size="md" />
          <span className="text-xs text-muted-foreground">
            {isLiability ? "you owe" : "balance"}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default async function AccountsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/accounts");
  }

  const supabase = await createSupabaseServerClient();
  const accounts = await listAccountsWithBalances(supabase);

  const active = accounts.filter((account) => !account.isArchived);
  const archived = accounts.filter((account) => account.isArchived);
  const assets = active.filter((account) => account.accountClass === "asset");
  const liabilities = active.filter(
    (account) => account.accountClass === "liability",
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Accounts"
        description="Every account you've added, with its current real balance."
        actions={
          <Button asChild>
            <Link href="/app/accounts/new">
              <PlusCircle aria-hidden="true" className="size-4" />
              New account
            </Link>
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Wallet aria-hidden="true" className="size-6" />}
          title="No accounts yet"
          description="Add a bank, cash, wallet, credit card, or loan account to start recording transactions."
          action={
            <Button asChild>
              <Link href="/app/accounts/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                Add your first account
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {assets.length > 0 ? (
            <section
              aria-labelledby="assets-heading"
              className="flex flex-col gap-3"
            >
              <SectionHeader id="assets-heading" title="Assets" />
              <ul className="flex flex-col gap-2">
                {assets.map((account) => (
                  <AccountRow key={account.id} account={account} />
                ))}
              </ul>
            </section>
          ) : null}

          {liabilities.length > 0 ? (
            <section
              aria-labelledby="liabilities-heading"
              className="flex flex-col gap-3"
            >
              <SectionHeader id="liabilities-heading" title="Liabilities" />
              <ul className="flex flex-col gap-2">
                {liabilities.map((account) => (
                  <AccountRow key={account.id} account={account} />
                ))}
              </ul>
            </section>
          ) : null}

          {archived.length > 0 ? (
            <details className="group flex flex-col gap-3">
              <summary className="w-fit cursor-pointer list-none text-sm font-semibold tracking-wide text-muted-foreground uppercase select-none">
                Archived ({archived.length})
              </summary>
              <ul className="mt-3 flex flex-col gap-2">
                {archived.map((account) => (
                  <AccountRow key={account.id} account={account} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
