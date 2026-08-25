import { Info } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CORPORATE_EVENT_STATUS_VARIANTS } from "@/components/corporate-events/statusVariants";
import { Badge } from "@/components/ui/Badge";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getCorporateEventById } from "@/lib/corporate-events/queries";
import {
  CORPORATE_EVENT_STATUS_LABELS,
  CORPORATE_EVENT_TYPE_LABELS,
} from "@/lib/corporate-events/types";
import { listInvestmentAssets } from "@/lib/investments/queries";
import { getMarketInstrumentById } from "@/lib/market-data/queries";
import { getCurrentThesisForInstrument } from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EventDetailPageProps = {
  params: Promise<{ eventId: string }>;
};

export const metadata: Metadata = {
  title: "Event detail — PENRA Money OS",
};

function DateField({
  label,
  value,
}: Readonly<{ label: string; value: string | null }>) {
  if (!value) {
    return null;
  }
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

export default async function EventDetailPage({
  params,
}: Readonly<EventDetailPageProps>) {
  const { eventId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/events/${eventId}`);
  }

  const supabase = await createSupabaseServerClient();
  const event = await getCorporateEventById(supabase, eventId);
  if (!event) {
    notFound();
  }

  const [instrument, investmentAssets, thesis] = await Promise.all([
    getMarketInstrumentById(supabase, event.instrumentId),
    listInvestmentAssets(supabase),
    getCurrentThesisForInstrument(supabase, event.instrumentId),
  ]);

  const holdsInstrument = investmentAssets.some(
    (a) => a.status === "active" && a.marketInstrumentId === event.instrumentId,
  );
  const hasUpcomingRecordDate =
    event.recordDate !== null &&
    event.recordDate >= new Date().toISOString().slice(0, 10);
  const detailEntries = Object.entries(event.details).filter(
    ([, value]) => value !== null && value !== undefined,
  );

  const relevancePoints: string[] = [];
  if (holdsInstrument) {
    relevancePoints.push(
      `You hold ${instrument?.name ?? "this company"} in an active investment.`,
    );
  }
  if (hasUpcomingRecordDate) {
    relevancePoints.push(
      `This event has an upcoming record date (${event.recordDate}).`,
    );
  }
  if (thesis) {
    relevancePoints.push(
      `You have an active investment thesis on this company that may be worth reviewing given this event.`,
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<BackLink href="/app/events">Events</BackLink>}
        title={event.title}
        {...(instrument?.name ? { description: instrument.name } : {})}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              {CORPORATE_EVENT_TYPE_LABELS[event.eventType]}
            </Badge>
            <Badge variant={CORPORATE_EVENT_STATUS_VARIANTS[event.status]}>
              {CORPORATE_EVENT_STATUS_LABELS[event.status]}
            </Badge>
          </div>
        }
      />

      {relevancePoints.length > 0 ? (
        <section
          aria-labelledby="relevance-heading"
          className="flex flex-col gap-3"
        >
          <SectionHeader
            id="relevance-heading"
            title="Why this may be relevant to your portfolio"
          />
          <Card className="border-info/30 bg-info-surface">
            <CardContent className="flex flex-col gap-2 p-4 text-sm text-info">
              {relevancePoints.map((point) => (
                <p key={point} className="flex items-start gap-2">
                  <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {point}
                </p>
              ))}
              <p className="text-xs text-info/80">
                This is informational only — it never recommends buying,
                selling, or any other action.
              </p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="dates-heading" className="flex flex-col gap-3">
        <SectionHeader id="dates-heading" title="Dates" />
        <Card>
          <CardContent className="p-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <DateField
                label="Announced"
                value={event.announcementAt?.slice(0, 10) ?? null}
              />
              <DateField label="Effective" value={event.effectiveDate} />
              <DateField label="Ex-date" value={event.exDate} />
              <DateField label="Record date" value={event.recordDate} />
              <DateField label="Payment date" value={event.paymentDate} />
              <DateField
                label="Meeting / result date"
                value={event.meetingOrResultDate}
              />
            </dl>
          </CardContent>
        </Card>
      </section>

      {detailEntries.length > 0 ? (
        <section
          aria-labelledby="details-heading"
          className="flex flex-col gap-3"
        >
          <SectionHeader id="details-heading" title="Structured details" />
          <Card>
            <CardContent className="p-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {detailEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="text-foreground">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="source-heading" className="flex flex-col gap-3">
        <SectionHeader id="source-heading" title="Provenance" />
        <Card>
          <CardContent className="flex flex-col gap-2 p-4 text-sm">
            <p className="text-muted-foreground">
              Source: {event.source} · received {event.receivedAt.slice(0, 10)}
            </p>
            {event.officialUrl ? (
              <a
                href={event.officialUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="w-fit text-primary hover:underline"
              >
                View official source
              </a>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
