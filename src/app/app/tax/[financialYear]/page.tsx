import { AlertTriangle, FileText, Landmark, Receipt, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FinancialYearSelector } from "@/components/tax/FinancialYearSelector";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  isValidFinancialYearId,
  listRecentFinancialYearIds,
  parseFinancialYearId,
} from "@/lib/tax/financial-year";
import { getTaxRuleSet } from "@/lib/tax/rules/registry";
import {
  getLatestDraftTaxReportSnapshot,
  getLatestFinalizedTaxReportSnapshot,
  getTaxProfile,
  listTaxDeductions,
  listTaxIncomeAdjustments,
  listTaxPayments,
  listTaxReconciliationItems,
  listTaxWithholdings,
} from "@/lib/tax/queries";
import { isProfileWithinSupportedScope } from "@/lib/tax/mapping";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type TaxWorkspacePageProps = {
  params: Promise<{ financialYear: string }>;
};

export const metadata: Metadata = { title: "Tax workspace — PENRA Money OS" };

const SUB_ROUTES = [
  { href: "income", label: "Income", icon: Landmark },
  { href: "capital-gains", label: "Capital gains", icon: FileText },
  { href: "interest-dividends", label: "Interest & dividends", icon: Landmark },
  { href: "deductions", label: "Deductions", icon: ShieldCheck },
  { href: "payments", label: "TDS & payments", icon: Receipt },
  { href: "reconciliation", label: "AIS/26AS reconciliation", icon: AlertTriangle },
  { href: "compare", label: "Old vs new regime", icon: FileText },
  { href: "reports", label: "Reports & exports", icon: FileText },
];

export default async function TaxWorkspacePage({
  params,
}: Readonly<TaxWorkspacePageProps>) {
  const { financialYear } = await params;

  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}`);
  }

  const fy = parseFinancialYearId(financialYear);
  const ruleSetLookup = getTaxRuleSet(financialYear);

  const supabase = await createSupabaseServerClient();
  const [
    profile,
    incomeAdjustments,
    deductions,
    withholdings,
    payments,
    reconciliationItems,
    latestFinalized,
    latestDraft,
  ] = await Promise.all([
    getTaxProfile(supabase),
    listTaxIncomeAdjustments(supabase, financialYear),
    listTaxDeductions(supabase, financialYear),
    listTaxWithholdings(supabase, financialYear),
    listTaxPayments(supabase, financialYear),
    listTaxReconciliationItems(supabase, financialYear),
    getLatestFinalizedTaxReportSnapshot(supabase, financialYear),
    getLatestDraftTaxReportSnapshot(supabase, financialYear),
  ]);

  const unreviewedIncome = incomeAdjustments.filter(
    (a) => a.status === "draft",
  ).length;
  const reconciliationDifferences = reconciliationItems.filter(
    (r) => r.status === "difference" || r.status === "missing_in_penra" || r.status === "missing_in_statement",
  ).length;
  const unreviewedWithholdings = withholdings.filter(
    (w) => w.reconciliationStatus === "unreviewed",
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader
        title={`Tax workspace — ${fy.label}`}
        description={`${fy.assessmentYearLabel}. Every figure here is for review and planning — not an income-tax return, and not a substitute for professional advice.`}
        actions={
          <FinancialYearSelector
            financialYearId={financialYear}
            options={listRecentFinancialYearIds(6)}
          />
        }
      />

      {!ruleSetLookup.available ? (
        <Card>
          <CardContent className="flex items-start gap-3 pt-5 text-sm">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-warning"
            />
            <p>
              No versioned tax rule set is published for {fy.label} yet.
              Income classification, deductions, TDS, and reconciliation can
              still be recorded, but slab-tax, capital-gains, and regime
              estimates are unavailable for this year until a rule set is
              added.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!profile ? (
        <Card>
          <CardContent className="flex items-start justify-between gap-4 pt-5 text-sm">
            <p>
              Set up your tax profile to see which automated estimates apply
              to you.
            </p>
            <Link href="/app/tax/profile" className="font-medium text-primary underline underline-offset-2">
              Set up profile
            </Link>
          </CardContent>
        </Card>
      ) : !isProfileWithinSupportedScope(profile) ? (
        <Card>
          <CardContent className="flex items-start gap-3 pt-5 text-sm">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-warning"
            />
            <p>
              Your profile falls outside this workspace&apos;s supported
              scope (resident individual, no business/professional income).
              Manual records can still be kept, but automated slab and
              capital-gains estimates are unavailable — verify your figures
              with a professional.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">Income items</p>
            <p className="text-2xl font-semibold text-foreground">
              {incomeAdjustments.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {unreviewedIncome} awaiting confirmation
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">Deductions</p>
            <p className="text-2xl font-semibold text-foreground">
              {deductions.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">TDS/TCS records</p>
            <p className="text-2xl font-semibold text-foreground">
              {withholdings.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {unreviewedWithholdings} unreviewed · {payments.length} payments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">
              AIS/26AS differences
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {reconciliationDifferences}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 pt-5 text-sm">
          <p className="font-medium text-foreground">Latest report</p>
          {latestFinalized ? (
            <div className="flex items-center gap-2">
              <StatusBadge status="posted" />
              <span className="text-muted-foreground">
                Finalized {latestFinalized.finalizedAt}
              </span>
            </div>
          ) : latestDraft ? (
            <div className="flex items-center gap-2">
              <StatusBadge status="draft" />
              <span className="text-muted-foreground">
                Draft generated {latestDraft.generatedAt}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground">
              No report generated yet for this financial year.
            </p>
          )}
          <Link
            href={`/app/tax/${financialYear}/reports`}
            className="w-fit font-medium text-primary underline underline-offset-2"
          >
            Go to reports & exports
          </Link>
        </CardContent>
      </Card>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SUB_ROUTES.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={`/app/tax/${financialYear}/${href}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm font-medium text-foreground transition-colors hover:border-input-border"
            >
              <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
