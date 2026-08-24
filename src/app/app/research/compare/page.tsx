import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompareSelector } from "@/components/research/CompareSelector";
import { CompareTable } from "@/components/research/CompareTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getPriceHistoryForInstrument,
  listMarketInstrumentsByIds,
} from "@/lib/market-data/queries";
import {
  listCompanyFinancialMetricsForPeriods,
  listCompanyFinancialPeriods,
} from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MIN_COMPANIES = 2;
const MAX_COMPANIES = 5;

type ComparePageProps = {
  searchParams: Promise<{ ids?: string }>;
};

export const metadata: Metadata = {
  title: "Compare companies — PENRA Money OS",
};

export default async function ComparePage({
  searchParams,
}: Readonly<ComparePageProps>) {
  const { ids } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/research/compare");
  }

  const requestedIds = (ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPANIES);

  const supabase = await createSupabaseServerClient();

  if (requestedIds.length < MIN_COMPANIES) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Compare companies"
          description="Compare 2-5 companies side by side using normalized, period-labelled metrics — never a ranked winner when data is incomplete."
        />
        <CompareSelector />
      </div>
    );
  }

  const instruments = await listMarketInstrumentsByIds(supabase, requestedIds);
  const stockInstruments = instruments.filter(
    (i) => i.instrumentKind === "stock",
  );

  const companies = await Promise.all(
    stockInstruments.map(async (instrument) => {
      const periods = await listCompanyFinancialPeriods(
        supabase,
        instrument.id,
      );
      const metrics = await listCompanyFinancialMetricsForPeriods(
        supabase,
        periods.map((p) => p.id),
      );
      const priceHistory = await getPriceHistoryForInstrument(
        supabase,
        instrument.id,
      );
      const latestPrice = priceHistory.at(-1) ?? null;
      return {
        instrument,
        periods,
        metrics,
        latestPrice: latestPrice
          ? { value: latestPrice.price, currency: latestPrice.currency }
          : null,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Compare companies"
        description="Compare 2-5 companies side by side using normalized, period-labelled metrics — never a ranked winner when data is incomplete."
      />
      <CompareSelector initial={stockInstruments} />
      {companies.length >= MIN_COMPANIES ? (
        <CompareTable companies={companies} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Pick at least {MIN_COMPANIES} valid companies above to compare.
        </p>
      )}
    </div>
  );
}
