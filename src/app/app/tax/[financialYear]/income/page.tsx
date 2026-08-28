import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TaxIncomeAdjustmentForm } from "@/components/tax/TaxIncomeAdjustmentForm";
import { TaxIncomeAdjustmentRow } from "@/components/tax/TaxIncomeAdjustmentRow";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";
import { isValidFinancialYearId, parseFinancialYearId } from "@/lib/tax/financial-year";
import { listTaxIncomeAdjustments } from "@/lib/tax/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IncomePageProps = { params: Promise<{ financialYear: string }> };

export const metadata: Metadata = { title: "Income — PENRA Money OS" };

export default async function TaxIncomePage({
  params,
}: Readonly<IncomePageProps>) {
  const { financialYear } = await params;
  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}/income`);
  }

  const fy = parseFinancialYearId(financialYear);
  const supabase = await createSupabaseServerClient();
  const items = await listTaxIncomeAdjustments(supabase, financialYear);

  const totalGross = items.reduce((sum, i) => sum.plus(i.grossAmount), new Decimal(0));
  const totalTds = items.reduce((sum, i) => sum.plus(i.tdsAmount), new Decimal(0));
  const totalNet = totalGross.minus(totalTds);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={
          <BackLink href={`/app/tax/${financialYear}`}>
            {`Back to ${fy.label}`}
          </BackLink>
        }
        title="Income"
        description="Every income item you've classified for this financial year — gross, TDS, and net are always shown separately."
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">Gross</p>
          <AmountDisplay value={totalGross} size="md" />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">TDS</p>
          <AmountDisplay value={totalTds} size="md" />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">Net</p>
          <AmountDisplay value={totalNet} size="md" />
        </div>
      </div>

      <section aria-labelledby="income-items-heading" className="flex flex-col gap-3">
        <SectionHeader id="income-items-heading" title="Income items" />
        {items.length === 0 ? (
          <EmptyState
            title="No income classified yet"
            description="Add salary, interest, dividend, or other income below."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <TaxIncomeAdjustmentRow
                key={item.id}
                item={item}
                financialYearId={financialYear}
              />
            ))}
          </ul>
        )}
      </section>

      <TaxIncomeAdjustmentForm financialYearId={financialYear} />
    </div>
  );
}
