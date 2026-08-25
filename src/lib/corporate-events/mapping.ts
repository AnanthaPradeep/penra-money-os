import {
  CORPORATE_EVENT_STATUSES,
  CORPORATE_EVENT_TYPES,
  type CorporateEventRow,
  type CorporateEventStatus,
  type CorporateEventType,
} from "@/lib/corporate-events/types";
import { assertLiteral } from "@/lib/types/literal";

export type CorporateEvent = {
  id: string;
  instrumentId: string;
  eventType: CorporateEventType;
  title: string;
  announcementAt: string | null;
  effectiveDate: string | null;
  exDate: string | null;
  recordDate: string | null;
  paymentDate: string | null;
  meetingOrResultDate: string | null;
  /**
   * Event-type-specific structured values (dividend amount, split/bonus
   * ratio, rights price, buyback size, ...) — typed at the app layer per
   * the migration's design; never used to alter the ledger or a holding.
   */
  details: Record<string, unknown>;
  status: CorporateEventStatus;
  source: string;
  officialUrl: string | null;
  providerEventId: string | null;
  receivedAt: string;
  createdAt: string;
};

function toDetails(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function mapCorporateEventRow(row: CorporateEventRow): CorporateEvent {
  return {
    id: row.id,
    instrumentId: row.instrument_id,
    eventType: assertLiteral(
      row.event_type,
      CORPORATE_EVENT_TYPES,
      "corporate_events.event_type",
    ),
    title: row.title,
    announcementAt: row.announcement_at,
    effectiveDate: row.effective_date,
    exDate: row.ex_date,
    recordDate: row.record_date,
    paymentDate: row.payment_date,
    meetingOrResultDate: row.meeting_or_result_date,
    details: toDetails(row.details),
    status: assertLiteral(
      row.status,
      CORPORATE_EVENT_STATUSES,
      "corporate_events.status",
    ),
    source: row.source,
    officialUrl: row.official_url,
    providerEventId: row.provider_event_id,
    receivedAt: row.received_at,
    createdAt: row.created_at,
  };
}
