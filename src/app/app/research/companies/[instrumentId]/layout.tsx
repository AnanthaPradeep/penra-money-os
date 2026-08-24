import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { CompanySubNav } from "@/components/research/CompanySubNav";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getMarketInstrumentById } from "@/lib/market-data/queries";
import { getCompanyProfile } from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CompanyLayoutProps = {
  children: ReactNode;
  params: Promise<{ instrumentId: string }>;
};

/**
 * Shared shell for every /app/research/companies/[instrumentId]/* route —
 * fetches the instrument once and gates the whole subtree on it being a
 * real, active `instrument_kind: "stock"` row. A mutual-fund scheme id
 * here 404s rather than rendering a company page for it, mirroring the
 * database's own validate_..._instrument_is_stock() trigger (see the
 * Phase 9 migration) — company research is never available for a fund.
 */
export default async function CompanyLayout({
  children,
  params,
}: Readonly<CompanyLayoutProps>) {
  const { instrumentId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/research/companies/${instrumentId}`);
  }

  const supabase = await createSupabaseServerClient();
  const instrument = await getMarketInstrumentById(supabase, instrumentId);
  if (!instrument || instrument.instrumentKind !== "stock") {
    notFound();
  }

  const profile = await getCompanyProfile(supabase, instrumentId);
  const legalName = profile?.legalName ?? instrument.name;
  const descriptionParts = [
    instrument.symbol ?? instrument.providerInstrumentId,
    instrument.exchange,
    profile?.sector,
    profile?.industry,
  ].filter((part): part is string => Boolean(part));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/research">Research</BackLink>}
        title={legalName}
        {...(descriptionParts.length > 0
          ? { description: descriptionParts.join(" · ") }
          : {})}
      />
      <CompanySubNav instrumentId={instrumentId} />
      {children}
    </div>
  );
}
