import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getDebtCurrentPrincipal, listDebts } from "@/lib/debts/queries";
import { Decimal } from "@/lib/money/decimal";
import {
  comparePayoffStrategies,
  PAYOFF_STRATEGY_LABELS,
} from "@/lib/planning/payoff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payoff strategy — PENRA Money OS" };

export default async function DebtStrategyPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ extra?: string }> }>) {
  const { extra } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/debts/strategy");
  }

  const supabase = await createSupabaseServerClient();
  const debts = await listDebts(supabase, { includeClosed: false });
  const activeDebts = debts.filter((d) => d.status === "active");

  const principals = await Promise.all(
    activeDebts.map((d) => getDebtCurrentPrincipal(supabase, d.id)),
  );

  const comparableDebts = activeDebts
    .map((debt, index) => ({
      debt,
      principal: principals[index] ?? new Decimal(0),
    }))
    .filter(
      ({ debt, principal }) => debt.minimumPayment !== null && principal.gt(0),
    );
  const excludedDebts = activeDebts.filter((d) => d.minimumPayment === null);

  let extraAmount = new Decimal(0);
  try {
    if (extra) {
      extraAmount = new Decimal(extra);
    }
  } catch {
    extraAmount = new Decimal(0);
  }
  if (extraAmount.isNegative() || !extraAmount.isFinite()) {
    extraAmount = new Decimal(0);
  }

  const results =
    comparableDebts.length === 0
      ? []
      : comparePayoffStrategies(
          comparableDebts.map(({ debt, principal }) => ({
            id: debt.id,
            name: debt.name,
            currentPrincipal: principal,
            annualInterestRate: debt.annualInterestRate,
            minimumPayment: debt.minimumPayment ?? new Decimal(0),
          })),
          extraAmount,
        );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow={<BackLink href="/app/debts">Back to debts</BackLink>}
        title="Compare payoff strategies"
        description="An estimate, not a guarantee — minimum payments, snowball, and avalanche compared side by side. No strategy here is ever labelled 'best'; the numbers speak for themselves."
      />

      <form method="GET" className="flex items-end gap-3">
        <div className="w-56">
          <Field
            id="strategy-extra"
            name="extra"
            label="Extra monthly payment"
            inputMode="decimal"
            defaultValue={extra ?? "0"}
            description="Beyond every debt's own minimum."
          />
        </div>
        <Button type="submit" variant="outline">
          Recalculate
        </Button>
      </form>

      {excludedDebts.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Excluded (no minimum payment set):{" "}
          {excludedDebts.map((d) => d.name).join(", ")}
        </p>
      ) : null}

      {results.length === 0 ? (
        <EmptyState
          title="Nothing to compare yet"
          description="Add an active debt with an outstanding balance and a minimum payment to compare payoff strategies."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {results.map((result) => (
            <Card key={result.strategy}>
              <CardHeader className="pb-0">
                <CardTitle className="text-base">
                  {PAYOFF_STRATEGY_LABELS[result.strategy]}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-4">
                <p className="text-sm text-muted-foreground">
                  {result.orderingExplanation}
                </p>
                <div className="flex flex-wrap gap-6">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Debt-free in
                    </span>
                    <span className="font-medium text-foreground">
                      {result.totalMonths !== null
                        ? `${result.totalMonths} months`
                        : "Not within 30 years at this payment"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Total interest
                    </span>
                    <AmountDisplay value={result.totalInterestPaid} size="sm" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Total paid
                    </span>
                    <AmountDisplay value={result.totalPaid} size="sm" />
                  </div>
                </div>
                {result.negativeAmortizationDebtIds.length > 0 ? (
                  <p className="text-sm font-medium text-negative">
                    Warning: the minimum payment on{" "}
                    {result.negativeAmortizationDebtIds
                      .map(
                        (id) =>
                          comparableDebts.find((c) => c.debt.id === id)?.debt
                            .name ?? id,
                      )
                      .join(", ")}{" "}
                    doesn&apos;t cover its accruing interest — the balance will
                    grow.
                  </p>
                ) : null}
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {result.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
