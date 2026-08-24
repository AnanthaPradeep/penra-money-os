import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FinancialStatementsView } from "@/components/research/FinancialStatementsView";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getMarketInstrumentById } from "@/lib/market-data/queries";
import {
  listCompanyFinancialMetricsForPeriods,
  listCompanyFinancialPeriods,
} from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CompanyFinancialsPageProps = {
  params: Promise<{ instrumentId: string }>;
};

export const metadata: Metadata = {
  title: "Financials — PENRA Money OS",
};

export default async function CompanyFinancialsPage({
  params,
}: Readonly<CompanyFinancialsPageProps>) {
  const { instrumentId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/research/companies/${instrumentId}/financials`);
  }

  const supabase = await createSupabaseServerClient();
  const instrument = await getMarketInstrumentById(supabase, instrumentId);
  if (!instrument || instrument.instrumentKind !== "stock") {
    notFound();
  }

  const periods = await listCompanyFinancialPeriods(supabase, instrumentId);
  const metrics = await listCompanyFinancialMetricsForPeriods(
    supabase,
    periods.map((p) => p.id),
  );

  if (periods.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No financial statement data available for this company yet. This is
        expected while the fundamentals provider is not configured, or before
        its first successful refresh.
      </p>
    );
  }

  return <FinancialStatementsView periods={periods} metrics={metrics} />;
}
