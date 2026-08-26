import { CreditCard, PlusCircle, Route } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { DEBT_TYPE_LABELS } from "@/lib/debts/mapping";
import { getDebtCurrentPrincipal, listDebts } from "@/lib/debts/queries";
import { Decimal } from "@/lib/money/decimal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Debts — PENRA Money OS" };

export default async function DebtsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/debts");
  }

  const supabase = await createSupabaseServerClient();
  const debts = await listDebts(supabase, { includeClosed: true });
  const principals = await Promise.all(
    debts.map((d) => getDebtCurrentPrincipal(supabase, d.id)),
  );

  const totalOutstanding = principals.reduce(
    (sum, p) => sum.plus(p),
    new Decimal(0),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Debts"
        description="Every loan, credit card, or borrowed amount you're tracking — principal is always derived live from your ledger, never a separate mutable figure."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/app/debts/strategy">
                <Route aria-hidden="true" className="size-4" />
                Compare payoff strategies
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/debts/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                New debt
              </Link>
            </Button>
          </>
        }
      />

      {debts.length === 0 ? (
        <EmptyState
          icon={<CreditCard aria-hidden="true" className="size-6" />}
          title="No debts yet"
          description="Add a loan, credit card, or borrowed amount to track its payoff."
          action={
            <Button asChild>
              <Link href="/app/debts/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                Add your first debt
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface p-5">
            <span className="text-sm text-muted-foreground">
              Total outstanding
            </span>
            <AmountDisplay value={totalOutstanding} size="xl" />
          </div>
          <ul className="flex flex-col gap-2">
            {debts.map((debt, index) => (
              <li key={debt.id}>
                <Link
                  href={`/app/debts/${debt.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 transition-colors hover:border-input-border"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                      {debt.name}
                      <StatusBadge status={debt.status} />
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {DEBT_TYPE_LABELS[debt.debtType]} ·{" "}
                      {debt.annualInterestRate.toString()}% p.a.
                    </span>
                  </div>
                  <AmountDisplay value={principals[index] ?? "0"} size="md" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
