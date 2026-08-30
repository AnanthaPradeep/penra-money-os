import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TaxPaymentForm } from "@/components/tax/TaxPaymentForm";
import { TaxWithholdingForm } from "@/components/tax/TaxWithholdingForm";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";
import {
  isValidFinancialYearId,
  parseFinancialYearId,
} from "@/lib/tax/financial-year";
import {
  TAX_PAYMENT_TYPE_LABELS,
  WITHHOLDING_TYPE_LABELS,
} from "@/lib/tax/mapping";
import { listTaxPayments, listTaxWithholdings } from "@/lib/tax/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ financialYear: string }> };

export const metadata: Metadata = { title: "TDS & payments — PENRA Money OS" };

const RECONCILIATION_STATUS_MAP: Record<
  string,
  "posted" | "draft" | "reversed" | "matured"
> = {
  unreviewed: "draft",
  matched: "matured",
  difference: "reversed",
  user_confirmed: "posted",
};

export default async function TaxPaymentsPage({ params }: Readonly<PageProps>) {
  const { financialYear } = await params;
  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}/payments`);
  }

  const fy = parseFinancialYearId(financialYear);
  const supabase = await createSupabaseServerClient();
  const [withholdings, payments] = await Promise.all([
    listTaxWithholdings(supabase, financialYear),
    listTaxPayments(supabase, financialYear),
  ]);

  const totalWithheld = withholdings.reduce(
    (sum, w) => sum.plus(w.taxWithheld),
    new Decimal(0),
  );
  const totalPaid = payments
    .filter((p) => p.paymentType !== "refund")
    .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
  const totalRefunded = payments
    .filter((p) => p.paymentType === "refund")
    .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={
          <BackLink href={`/app/tax/${financialYear}`}>
            {`Back to ${fy.label}`}
          </BackLink>
        }
        title="TDS, TCS & payments"
        description="Manual records of what's already been withheld or paid — never posted to your ledger automatically."
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">TDS/TCS withheld</p>
          <AmountDisplay value={totalWithheld} size="md" />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">
            Advance/self-assessment paid
          </p>
          <AmountDisplay value={totalPaid} size="md" />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted-foreground">Refunds received</p>
          <AmountDisplay value={totalRefunded} size="md" />
        </div>
      </div>

      <section
        aria-labelledby="withholdings-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="withholdings-heading" title="TDS/TCS records" />
        {withholdings.length === 0 ? (
          <EmptyState
            title="No TDS/TCS recorded yet"
            description="Add records below as you reconcile against Form 16 or Form 26AS."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {withholdings.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    {WITHHOLDING_TYPE_LABELS[w.withholdingType]}
                    <StatusBadge
                      status={
                        RECONCILIATION_STATUS_MAP[w.reconciliationStatus] ??
                        "draft"
                      }
                    />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {w.deductorName} · {w.withheldOn}
                  </span>
                </div>
                <AmountDisplay value={w.taxWithheld} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="payments-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="payments-heading" title="Tax payments & refunds" />
        {payments.length === 0 ? (
          <EmptyState
            title="No payments recorded yet"
            description="Add advance tax, self-assessment tax, or refunds below."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">
                    {TAX_PAYMENT_TYPE_LABELS[p.paymentType]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.paidOn}
                  </span>
                </div>
                <AmountDisplay
                  value={
                    p.paymentType === "refund" ? p.amount.negated() : p.amount
                  }
                  variant="signed"
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TaxWithholdingForm financialYearId={financialYear} />
        <TaxPaymentForm financialYearId={financialYear} />
      </div>
    </div>
  );
}
