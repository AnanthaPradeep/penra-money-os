import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import type { Money } from "@/lib/money/decimal";
import {
  isValidFinancialYearId,
  parseFinancialYearId,
} from "@/lib/tax/financial-year";
import { getRegimeComparisonForYear } from "@/lib/tax/regime-comparison-data";
import { getTaxRuleSet } from "@/lib/tax/rules/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ financialYear: string }> };

export const metadata: Metadata = {
  title: "Old vs new regime — PENRA Money OS",
};

function RegimeCard({
  title,
  estimate,
}: Readonly<{
  title: string;
  estimate: {
    status: string;
    taxableOrdinaryIncome: Money;
    ordinaryTax: { totalOrdinaryTax: Money };
    specialRateTax: Money;
    totalTaxLiability: Money;
    balancePayableOrRefund: Money;
  };
}>) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-4 text-sm">
        <dl className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxable ordinary income</dt>
            <dd>{estimate.taxableOrdinaryIncome.toString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ordinary tax + cess</dt>
            <dd>{estimate.ordinaryTax.totalOrdinaryTax.toString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Capital-gains tax</dt>
            <dd>{estimate.specialRateTax.toString()}</dd>
          </div>
          <div className="flex justify-between font-medium text-foreground">
            <dt>Total estimated liability</dt>
            <dd>
              <AmountDisplay value={estimate.totalTaxLiability} size="sm" />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {estimate.balancePayableOrRefund.isNegative()
                ? "Estimated refund"
                : "Estimated balance payable"}
            </dt>
            <dd>
              <AmountDisplay
                value={estimate.balancePayableOrRefund.abs()}
                size="sm"
              />
            </dd>
          </div>
        </dl>
        {estimate.status !== "available" ? (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle aria-hidden="true" className="size-3.5" />
            {estimate.status === "partial"
              ? "Partial — surcharge above ₹50,00,000 is not yet supported."
              : "Unavailable."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function CompareRegimesPage({
  params,
}: Readonly<PageProps>) {
  const { financialYear } = await params;
  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}/compare`);
  }

  const fy = parseFinancialYearId(financialYear);
  const ruleSetLookup = getTaxRuleSet(financialYear);
  const supabase = await createSupabaseServerClient();

  const comparison = ruleSetLookup.available
    ? await getRegimeComparisonForYear(supabase, ruleSetLookup.ruleSet, fy)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={
          <BackLink href={`/app/tax/${financialYear}`}>
            {`Back to ${fy.label}`}
          </BackLink>
        }
        title="Old vs new regime"
        description="Both regimes are shown neutrally, side by side. PENRA never recommends or automatically selects a regime for you."
      />

      {!ruleSetLookup.available ? (
        <EmptyState
          icon={<AlertTriangle aria-hidden="true" className="size-6" />}
          title="Unavailable for this financial year"
          description={`No versioned tax rule set is published for ${fy.label} yet.`}
        />
      ) : !comparison?.available ? (
        <EmptyState
          icon={<AlertTriangle aria-hidden="true" className="size-6" />}
          title="Unavailable"
          description={
            comparison?.reasonCode === "no_profile"
              ? "Set up your tax profile first."
              : "Your profile is outside this workspace's supported scope (resident individual, no business/professional income)."
          }
          action={
            <Link
              href="/app/tax/profile"
              className="text-sm font-medium text-primary underline underline-offset-2"
            >
              Go to tax profile
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RegimeCard title="Old regime" estimate={comparison.result.old} />
            <RegimeCard title="New regime" estimate={comparison.result.new} />
          </div>
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
            Difference (old − new):{" "}
            {comparison.result.differenceOldMinusNew.toString()}. This is an
            arithmetic difference only — it is not a recommendation. Calculated{" "}
            {comparison.result.calculatedAt} using rule set{" "}
            {comparison.result.ruleSetVersion}.
          </p>
        </>
      )}
    </div>
  );
}
