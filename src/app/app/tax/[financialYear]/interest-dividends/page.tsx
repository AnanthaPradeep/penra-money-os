import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  isValidFinancialYearId,
  parseFinancialYearId,
} from "@/lib/tax/financial-year";
import { INCOME_CATEGORY_LABELS, type IncomeCategory } from "@/lib/tax/mapping";
import { listTaxIncomeAdjustments } from "@/lib/tax/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ financialYear: string }> };

export const metadata: Metadata = {
  title: "Interest & dividends — PENRA Money OS",
};

const INTEREST_CATEGORIES: IncomeCategory[] = [
  "savings_interest",
  "fd_interest",
  "rd_interest",
  "refund_interest",
  "other_taxable_interest",
];

export default async function InterestDividendsPage({
  params,
}: Readonly<PageProps>) {
  const { financialYear } = await params;
  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}/interest-dividends`);
  }

  const fy = parseFinancialYearId(financialYear);
  const supabase = await createSupabaseServerClient();
  const items = await listTaxIncomeAdjustments(supabase, financialYear);

  const interestItems = items.filter((i) =>
    INTEREST_CATEGORIES.includes(i.category),
  );
  const dividendItems = items.filter((i) => i.category === "dividend");
  const ppfItems = items.filter((i) => i.category === "ppf_interest");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={
          <BackLink href={`/app/tax/${financialYear}`}>
            {`Back to ${fy.label}`}
          </BackLink>
        }
        title="Interest & dividends"
        description="Sourced from your income classifications. Gross, TDS, and net are always kept separate — net bank credit is never treated as gross taxable income."
      />

      <section
        aria-labelledby="interest-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="interest-heading" title="Taxable interest" />
        {interestItems.length === 0 ? (
          <EmptyState
            title="No interest classified yet"
            description="Classify savings, FD, RD, or other interest income."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {interestItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <span className="font-medium text-foreground">
                  {INCOME_CATEGORY_LABELS[item.category]}
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  Gross <AmountDisplay value={item.grossAmount} size="sm" /> ·
                  TDS {item.tdsAmount.toString()} · Net{" "}
                  <AmountDisplay value={item.netAmount} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="dividend-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="dividend-heading" title="Dividends" />
        {dividendItems.length === 0 ? (
          <EmptyState
            title="No dividends classified yet"
            description="Classify dividend income received on your investments."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {dividendItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <span className="font-medium text-foreground">
                  {item.evidenceLabel ?? "Dividend"}
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  Gross {item.grossAmount.toString()} · TDS{" "}
                  {item.tdsAmount.toString()} · Net{" "}
                  <AmountDisplay value={item.netAmount} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ppf-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="ppf-heading"
          title="PPF interest (exempt-income candidate)"
        />
        {ppfItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No PPF interest classified. Not every credit into a PPF-linked
            account is automatically exempt — classify it explicitly.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ppfItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <span className="font-medium text-foreground">
                  PPF interest
                </span>
                <AmountDisplay value={item.grossAmount} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href={`/app/tax/${financialYear}/income`}
        className="w-fit text-sm font-medium text-primary underline underline-offset-2"
      >
        Manage income classifications
      </Link>
    </div>
  );
}
