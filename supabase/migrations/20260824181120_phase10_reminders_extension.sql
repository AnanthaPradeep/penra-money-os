-- =======================================================================
-- Phase 10 (follow-up) — extend research_review_reminders() to also cover
-- IPO lifecycle dates and corporate-event dates, per outcome #11 ("in-app
-- reminders") and the "why this may be relevant to your portfolio" rule
-- (verifiable relationships only: holds instrument, upcoming record date,
-- may require thesis review — never advice language).
--
-- create or replace with an IDENTICAL signature preserves the existing
-- grant to authenticated and is forward-only (no drop, no data loss).
-- security invoker is kept so every branch is naturally scoped to the
-- caller's own rows via RLS — ipo_watchlist_items/investment_theses/
-- investment_assets are all owner-RLS-gated; ipo_issues/corporate_events
-- are shared-read tables joined only to filter down to what the caller
-- already watches/holds, never exposing another user's join key.
--
-- Deliberately NOT covered here: "failed/stale refresh" reminders. That
-- would require granting authenticated SELECT on research_sync_runs (a
-- fully-locked-down, zero-grant observability table by design) or a new
-- lightweight state-summary table (the market_data_provider_state
-- pattern from Phase 8). Out of scope for this pass — report as a known
-- gap rather than half-building it. AI job failures remain visible
-- per-user on their own ai_jobs rows (already SELECT-granted), which
-- covers the same need for that one surface without a new reminder type.
-- =======================================================================

create or replace function public.research_review_reminders()
returns table (
  reminder_type text,
  instrument_id uuid,
  related_id uuid,
  title text,
  due_date date
)
language sql
security invoker
set search_path = ''
stable
as $$
  select 'thesis_overdue'::text, t.instrument_id, t.id, t.title, t.expected_review_date
  from public.investment_theses t
  where t.status in ('active', 'needs_review') and t.expected_review_date < current_date

  union all

  select 'thesis_due_soon'::text, t.instrument_id, t.id, t.title, t.expected_review_date
  from public.investment_theses t
  where t.status = 'active' and t.expected_review_date >= current_date
    and t.expected_review_date <= current_date + interval '7 days'

  union all

  select 'watchlist_review_due'::text, w.instrument_id, w.id, mi.name, w.target_review_date
  from public.watchlist_items w
  join public.market_instruments mi on mi.id = w.instrument_id
  where w.target_review_date is not null and w.target_review_date <= current_date
    and w.research_status not in ('rejected', 'archived')

  union all

  -- IPO watchlist: the caller's own target_review_date, same pattern as watchlist_review_due.
  select 'ipo_watchlist_review_due'::text, ii.linked_instrument_id, iw.id, ii.issuer_name, iw.target_review_date
  from public.ipo_watchlist_items iw
  join public.ipo_issues ii on ii.id = iw.ipo_issue_id
  where iw.target_review_date is not null and iw.target_review_date <= current_date
    and iw.research_status not in ('not_interested', 'archived')

  union all

  -- Only IPOs the caller actually watches — never surfaced for every IPO in the shared catalogue.
  select 'ipo_opening_soon'::text, ii.linked_instrument_id, ii.id, ii.issuer_name, ii.issue_open_date
  from public.ipo_issues ii
  join public.ipo_watchlist_items iw on iw.ipo_issue_id = ii.id
  where ii.issue_open_date is not null and ii.issue_open_date >= current_date
    and ii.issue_open_date <= current_date + interval '7 days'

  union all

  select 'ipo_closing_soon'::text, ii.linked_instrument_id, ii.id, ii.issuer_name, ii.issue_close_date
  from public.ipo_issues ii
  join public.ipo_watchlist_items iw on iw.ipo_issue_id = ii.id
  where ii.issue_close_date is not null and ii.issue_close_date >= current_date
    and ii.issue_close_date <= current_date + interval '3 days'

  union all

  select 'ipo_listing_soon'::text, ii.linked_instrument_id, ii.id, ii.issuer_name, ii.listing_date
  from public.ipo_issues ii
  join public.ipo_watchlist_items iw on iw.ipo_issue_id = ii.id
  where ii.listing_date is not null and ii.listing_date >= current_date
    and ii.listing_date <= current_date + interval '7 days'

  union all

  -- Corporate events: only for instruments backing one of the caller's own active investment assets.
  select 'event_results_due_soon'::text, ce.instrument_id, ce.id, ce.title, ce.meeting_or_result_date
  from public.corporate_events ce
  join public.investment_assets ia on ia.market_instrument_id = ce.instrument_id and ia.status = 'active'
  where ce.is_current = true and ce.status <> 'cancelled' and ce.event_type = 'financial_results'
    and ce.meeting_or_result_date is not null and ce.meeting_or_result_date >= current_date
    and ce.meeting_or_result_date <= current_date + interval '7 days'

  union all

  select 'event_board_meeting_soon'::text, ce.instrument_id, ce.id, ce.title, ce.meeting_or_result_date
  from public.corporate_events ce
  join public.investment_assets ia on ia.market_instrument_id = ce.instrument_id and ia.status = 'active'
  where ce.is_current = true and ce.status <> 'cancelled' and ce.event_type = 'board_meeting'
    and ce.meeting_or_result_date is not null and ce.meeting_or_result_date >= current_date
    and ce.meeting_or_result_date <= current_date + interval '7 days'

  union all

  select 'event_ex_dividend_soon'::text, ce.instrument_id, ce.id, ce.title, ce.ex_date
  from public.corporate_events ce
  join public.investment_assets ia on ia.market_instrument_id = ce.instrument_id and ia.status = 'active'
  where ce.is_current = true and ce.status <> 'cancelled' and ce.event_type = 'dividend'
    and ce.ex_date is not null and ce.ex_date >= current_date
    and ce.ex_date <= current_date + interval '7 days'

  union all

  select 'event_record_date_soon'::text, ce.instrument_id, ce.id, ce.title, ce.record_date
  from public.corporate_events ce
  join public.investment_assets ia on ia.market_instrument_id = ce.instrument_id and ia.status = 'active'
  where ce.is_current = true and ce.status <> 'cancelled'
    and ce.record_date is not null and ce.record_date >= current_date
    and ce.record_date <= current_date + interval '7 days'

  union all

  select 'event_rights_or_buyback_deadline_soon'::text, ce.instrument_id, ce.id, ce.title, ce.effective_date
  from public.corporate_events ce
  join public.investment_assets ia on ia.market_instrument_id = ce.instrument_id and ia.status = 'active'
  where ce.is_current = true and ce.status <> 'cancelled' and ce.event_type in ('rights_issue', 'buyback')
    and ce.effective_date is not null and ce.effective_date >= current_date
    and ce.effective_date <= current_date + interval '7 days'

  union all

  -- "May require thesis review" — a recently-received material event for an instrument
  -- the caller has an active thesis on. Verifiable relationship only, no advice language.
  select
    'thesis_review_triggered_by_event'::text,
    ce.instrument_id,
    ce.id,
    th.title,
    coalesce(ce.effective_date, ce.record_date, ce.meeting_or_result_date, ce.announcement_at::date, ce.received_at::date)
  from public.corporate_events ce
  join public.investment_theses th on th.instrument_id = ce.instrument_id and th.status = 'active'
  where ce.is_current = true and ce.status <> 'cancelled'
    and ce.event_type in (
      'dividend', 'stock_split', 'bonus_issue', 'rights_issue', 'buyback',
      'merger_or_demerger', 'management_change', 'regulatory_action', 'fund_raising'
    )
    and ce.received_at >= now() - interval '14 days';
$$;

revoke all on function public.research_review_reminders() from public;
grant execute on function public.research_review_reminders() to authenticated;
