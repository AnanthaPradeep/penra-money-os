import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TaxReconciliationForm } from "@/components/tax/TaxReconciliationForm";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isValidFinancialYearId, parseFinancialYearId } from "@/lib/tax/financial-year";
import { RECONCILIATION_SOURCE_LABELS } from "@/lib/tax/mapping";
import { listTaxReconciliationItems } from "@/lib/tax/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ financialYear: string }> };

export const metadata: Metadata = { title: "AIS/26AS reconciliation — PENRA Money OS" };

export default async function TaxReconciliationPage({
  params,
}: Readonly<PageProps>) {
  const { financialYear } = await params;
  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}/reconciliation`);
  }

  const fy = parseFinancialYearId(financialYear);
  const supabase = await createSupabaseServerClient();
  const items = await listTaxReconciliationItems(supabase, financialYear);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={
          <BackLink href={`/app/tax/${financialYear}`}>
            {`Back to ${fy.label}`}
          </BackLink>
        }
        title="AIS/26AS reconciliation"
        description="A manual worksheet — PENRA never logs into the Income Tax portal, and AIS/TIS/Form 26AS data is never treated as automatically complete or correct. Enter what each source reports and compare it against PENRA's own figure yourself."
      />

      <section aria-labelledby="reconciliation-heading" className="flex flex-col gap-3">
        <SectionHeader id="reconciliation-heading" title="Reconciliation items" />
        {items.length === 0 ? (
          <EmptyState
            title="No reconciliation items yet"
            description="Add one below for each AIS/26AS line you want to compare."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-foreground">
                    {RECONCILIATION_SOURCE_LABELS[item.source]} ·{" "}
                    {item.incomeCategory}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    {item.status.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Reported {item.reportedAmount?.toString() ?? "—"} · PENRA{" "}
                  {item.penraAmount?.toString() ?? "—"} · Accepted{" "}
                  {item.acceptedAmount?.toString() ?? "—"}
                  {item.explanation ? ` · ${item.explanation}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TaxReconciliationForm financialYearId={financialYear} />
    </div>
  );
}
