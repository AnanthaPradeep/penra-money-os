import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { WatchIpoControls } from "@/components/ipo/WatchIpoControls";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Card, CardContent } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getIpoIssueById,
  getIpoWatchlistItem,
  listIpoStatusHistory,
} from "@/lib/ipo/queries";
import {
  IPO_SOURCE_ORGANIZATION_LABELS,
  IPO_STATUS_LABELS,
} from "@/lib/ipo/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IpoOverviewPageProps = {
  params: Promise<{ ipoId: string }>;
};

export const metadata: Metadata = {
  title: "IPO overview — PENRA Money OS",
};

function DateField({
  label,
  value,
}: Readonly<{ label: string; value: string | null }>) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value ?? "Not yet confirmed"}</dd>
    </div>
  );
}

export default async function IpoOverviewPage({
  params,
}: Readonly<IpoOverviewPageProps>) {
  const { ipoId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/ipos/${ipoId}`);
  }

  const supabase = await createSupabaseServerClient();
  const ipo = await getIpoIssueById(supabase, ipoId);
  if (!ipo) {
    notFound();
  }

  const [watchlistItem, statusHistory] = await Promise.all([
    getIpoWatchlistItem(supabase, ipoId),
    listIpoStatusHistory(supabase, ipoId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="watch-heading" className="flex flex-col gap-3">
        <SectionHeader id="watch-heading" title="Your tracking" />
        <Card>
          <CardContent className="p-4">
            <WatchIpoControls
              ipoIssueId={ipoId}
              watchlistItem={watchlistItem}
            />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="dates-heading" className="flex flex-col gap-3">
        <SectionHeader id="dates-heading" title="Key dates" />
        <Card>
          <CardContent className="p-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <DateField label="Issue opens" value={ipo.issueOpenDate} />
              <DateField label="Issue closes" value={ipo.issueCloseDate} />
              <DateField
                label="Basis of allotment"
                value={ipo.basisOfAllotmentDate}
              />
              <DateField label="Refund" value={ipo.refundDate} />
              <DateField label="Demat credit" value={ipo.dematCreditDate} />
              <DateField label="Listing" value={ipo.listingDate} />
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="terms-heading" className="flex flex-col gap-3">
        <SectionHeader id="terms-heading" title="Issue terms" />
        <Card>
          <CardContent className="p-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Price band</dt>
                <dd className="text-foreground">
                  {ipo.priceBandMin && ipo.priceBandMax ? (
                    <>
                      <AmountDisplay value={ipo.priceBandMin} size="sm" /> –{" "}
                      <AmountDisplay value={ipo.priceBandMax} size="sm" />
                    </>
                  ) : (
                    "Not yet confirmed"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lot size</dt>
                <dd className="text-foreground">{ipo.lotSize ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Min. application qty</dt>
                <dd className="text-foreground">
                  {ipo.minApplicationQuantity ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fresh issue amount</dt>
                <dd className="text-foreground">
                  {ipo.freshIssueAmount ? (
                    <AmountDisplay value={ipo.freshIssueAmount} size="sm" />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Offer for sale amount</dt>
                <dd className="text-foreground">
                  {ipo.offerForSaleAmount ? (
                    <AmountDisplay value={ipo.offerForSaleAmount} size="sm" />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total issue size</dt>
                <dd className="text-foreground">
                  {ipo.totalIssueSize ? (
                    <AmountDisplay value={ipo.totalIssueSize} size="sm" />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="source-heading" className="flex flex-col gap-3">
        <SectionHeader id="source-heading" title="Provenance" />
        <Card>
          <CardContent className="flex flex-col gap-2 p-4 text-sm">
            <p className="text-muted-foreground">
              Source: {IPO_SOURCE_ORGANIZATION_LABELS[ipo.sourceOrganization]} ·
              last verified {ipo.lastVerifiedAt.slice(0, 10)}
            </p>
            <a
              href={ipo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex w-fit items-center gap-1.5 text-primary hover:underline"
            >
              View source document
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby="history-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="history-heading" title="Status history" />
        {statusHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No status changes yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {statusHistory.map((entry) => (
              <li key={entry.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="text-foreground">
                      {entry.previousStatus
                        ? `${IPO_STATUS_LABELS[entry.previousStatus]} → `
                        : ""}
                      {IPO_STATUS_LABELS[entry.newStatus]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.changedAt.slice(0, 10)}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
