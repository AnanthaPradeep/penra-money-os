import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TaxDeductionForm } from "@/components/tax/TaxDeductionForm";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";
import {
  isValidFinancialYearId,
  parseFinancialYearId,
} from "@/lib/tax/financial-year";
import { listTaxDeductions } from "@/lib/tax/queries";
import { getTaxRuleSet } from "@/lib/tax/rules/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ financialYear: string }> };

export const metadata: Metadata = { title: "Deductions — PENRA Money OS" };

export default async function TaxDeductionsPage({
  params,
}: Readonly<PageProps>) {
  const { financialYear } = await params;
  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}/deductions`);
  }

  const fy = parseFinancialYearId(financialYear);
  const supabase = await createSupabaseServerClient();
  const deductions = await listTaxDeductions(supabase, financialYear);
  const ruleSetLookup = getTaxRuleSet(financialYear);

  const total = deductions.reduce(
    (sum, d) => sum.plus(d.claimedAmount),
    new Decimal(0),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={
          <BackLink href={`/app/tax/${financialYear}`}>
            {`Back to ${fy.label}`}
          </BackLink>
        }
        title="Deductions"
        description="Your own entered evidence — eligibility and regime-specific caps are applied only at calculation time, never here."
      />

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-xs text-muted-foreground">Total claimed</p>
        <AmountDisplay value={total} size="lg" />
      </div>

      <section
        aria-labelledby="deductions-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="deductions-heading" title="Your deductions" />
        {deductions.length === 0 ? (
          <EmptyState
            title="No deductions recorded yet"
            description="Add a deduction with evidence below."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {deductions.map((d) => {
              const ruleEntry = ruleSetLookup.available
                ? ruleSetLookup.ruleSet.deductionCatalog.find(
                    (c) => c.section === d.section,
                  )
                : undefined;
              return (
                <li
                  key={d.id}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-foreground">
                      Section {d.section}
                    </span>
                    <AmountDisplay value={d.claimedAmount} size="sm" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {d.evidenceLabel ?? "No evidence noted"}
                    {ruleEntry
                      ? ` · ${ruleEntry.label}${ruleEntry.maxAmount ? ` · cap ${ruleEntry.maxAmount.toString()}` : ""} · ${ruleEntry.regimes.join("/")} regime`
                      : " · no matching rule for this financial year — shown as entered, not yet applied to a calculation"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <TaxDeductionForm financialYearId={financialYear} />
    </div>
  );
}
