-- pgTAP tests for the two Phase 10 follow-up migrations:
--   20260824181120_phase10_reminders_extension.sql (research_review_reminders
--   extended with IPO-lifecycle and corporate-event reminder branches)
--   20260824184341_phase10_ai_job_dispatch.sql (create_ai_job now dispatches
--   the ai-job-worker Edge Function on a successful queue)
--
-- Uses its own fixture ids, distinct from phase10_ipo_events_ai.test.sql,
-- since both run in the same local database within one test session.

begin;

select plan(17);

-- Fixed literal ids:
--   user1 = 77777777-7777-7777-7777-777777777777 (holds + watches + has a thesis)
--   user2 = 88888888-8888-8888-8888-888888888888 (holds/watches nothing)
--   instrument1 = d1111111-1111-1111-1111-111111111111

insert into auth.users (id, email, raw_user_meta_data)
values ('77777777-7777-7777-7777-777777777777', 'pgtap-phase10-followup-one@example.com', '{}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('88888888-8888-8888-8888-888888888888', 'pgtap-phase10-followup-two@example.com', '{}'::jsonb);

insert into public.market_instruments (id, provider, provider_instrument_id, name, instrument_kind, symbol, exchange)
values ('d1111111-1111-1111-1111-111111111111', 'twelve_data', 'FOLLOWUP.NSE', 'Followup Test Co Ltd', 'stock', 'FOLLOWUP', 'NSE');

-- user1 holds instrument1 via an active investment asset, and has an active thesis on it.
insert into public.investment_assets (user_id, asset_kind, display_name, market_instrument_id, status)
values ('77777777-7777-7777-7777-777777777777', 'stock', 'Followup Test Co Ltd', 'd1111111-1111-1111-1111-111111111111', 'active');
insert into public.investment_theses (user_id, instrument_id, title, status)
values ('77777777-7777-7777-7777-777777777777', 'd1111111-1111-1111-1111-111111111111', 'Followup thesis', 'active');

-- ---------------------------------------------------------------------
-- IPO reminder branches
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select * into pg_temp.ipo1 from public.add_ipo_from_official_source(
  'Followup IPO Ltd', 'mainboard', 'sebi', 'https://www.sebi.gov.in/followup-drhp'
);

-- Seed the IPO's dates via update_ipo_official_fields (owner-restricted RPC) and watch it.
select public.update_ipo_official_fields(
  (select id from pg_temp.ipo1),
  p_issue_open_date := current_date,
  p_issue_close_date := (current_date + 2)::date,
  p_listing_date := (current_date + 5)::date
);

insert into public.ipo_watchlist_items (user_id, ipo_issue_id)
values ('77777777-7777-7777-7777-777777777777', (select id from pg_temp.ipo1));

select ok(
  exists (
    select 1 from public.research_review_reminders()
    where reminder_type = 'ipo_opening_soon' and related_id = (select id from pg_temp.ipo1)
  ),
  'ipo_opening_soon appears for the watching user when issue_open_date is within 7 days'
);
select ok(
  exists (
    select 1 from public.research_review_reminders()
    where reminder_type = 'ipo_closing_soon' and related_id = (select id from pg_temp.ipo1)
  ),
  'ipo_closing_soon appears when issue_close_date is within 3 days'
);
select ok(
  exists (
    select 1 from public.research_review_reminders()
    where reminder_type = 'ipo_listing_soon' and related_id = (select id from pg_temp.ipo1)
  ),
  'ipo_listing_soon appears when listing_date is within 7 days'
);

update public.ipo_watchlist_items
set target_review_date = current_date
where user_id = '77777777-7777-7777-7777-777777777777' and ipo_issue_id = (select id from pg_temp.ipo1);

select ok(
  exists (
    select 1 from public.research_review_reminders()
    where reminder_type = 'ipo_watchlist_review_due' and related_id in (
      select id from public.ipo_watchlist_items where ipo_issue_id = (select id from pg_temp.ipo1)
    )
  ),
  'ipo_watchlist_review_due appears once target_review_date is due'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "88888888-8888-8888-8888-888888888888", "role": "authenticated"}';
select ok(
  not exists (
    select 1 from public.research_review_reminders()
    where reminder_type in ('ipo_opening_soon', 'ipo_closing_soon', 'ipo_listing_soon', 'ipo_watchlist_review_due')
      and related_id = (select id from pg_temp.ipo1)
  ),
  'IPO reminders never appear for a user who does not watch that IPO'
);
reset role;

-- ---------------------------------------------------------------------
-- Corporate-event reminder branches (service-role-only ingestion, so
-- seeded unrestricted).
-- ---------------------------------------------------------------------

select public.ingest_corporate_event(
  'd1111111-1111-1111-1111-111111111111', 'dividend', 'Interim dividend', 'twelve_data',
  p_ex_date := (current_date + 4)::date,
  p_record_date := (current_date + 5)::date
);
select public.ingest_corporate_event(
  'd1111111-1111-1111-1111-111111111111', 'financial_results', 'Q1 results', 'twelve_data',
  p_meeting_or_result_date := (current_date + 6)::date
);
select public.ingest_corporate_event(
  'd1111111-1111-1111-1111-111111111111', 'board_meeting', 'Board meeting', 'twelve_data',
  p_meeting_or_result_date := (current_date + 1)::date
);
select public.ingest_corporate_event(
  'd1111111-1111-1111-1111-111111111111', 'buyback', 'Share buyback', 'twelve_data',
  p_effective_date := (current_date + 2)::date
);
select public.ingest_corporate_event(
  'd1111111-1111-1111-1111-111111111111', 'stock_split', 'Cancelled split', 'twelve_data',
  p_status := 'cancelled', p_ex_date := (current_date + 1)::date
);
select public.ingest_corporate_event(
  'd1111111-1111-1111-1111-111111111111', 'announcement', 'Routine announcement', 'twelve_data'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select ok(
  exists (select 1 from public.research_review_reminders() where reminder_type = 'event_ex_dividend_soon' and instrument_id = 'd1111111-1111-1111-1111-111111111111'),
  'event_ex_dividend_soon appears for a user holding the instrument via an active investment asset'
);
select ok(
  exists (select 1 from public.research_review_reminders() where reminder_type = 'event_record_date_soon' and instrument_id = 'd1111111-1111-1111-1111-111111111111'),
  'event_record_date_soon appears for any event type with a near record date'
);
select ok(
  exists (select 1 from public.research_review_reminders() where reminder_type = 'event_results_due_soon' and instrument_id = 'd1111111-1111-1111-1111-111111111111'),
  'event_results_due_soon appears for a financial_results event'
);
select ok(
  exists (select 1 from public.research_review_reminders() where reminder_type = 'event_board_meeting_soon' and instrument_id = 'd1111111-1111-1111-1111-111111111111'),
  'event_board_meeting_soon appears for a board_meeting event'
);
select ok(
  exists (select 1 from public.research_review_reminders() where reminder_type = 'event_rights_or_buyback_deadline_soon' and instrument_id = 'd1111111-1111-1111-1111-111111111111'),
  'event_rights_or_buyback_deadline_soon appears for a buyback event'
);
select ok(
  not exists (
    select 1 from public.research_review_reminders()
    where reminder_type = 'event_ex_dividend_soon' and related_id in (
      select id from public.corporate_events where event_type = 'stock_split' and status = 'cancelled'
    )
  ),
  'a cancelled event never produces a reminder'
);
select ok(
  exists (select 1 from public.research_review_reminders() where reminder_type = 'thesis_review_triggered_by_event' and instrument_id = 'd1111111-1111-1111-1111-111111111111'),
  'thesis_review_triggered_by_event appears for an active thesis when a material event was recently received'
);
select ok(
  not exists (
    select 1 from public.research_review_reminders()
    where reminder_type = 'thesis_review_triggered_by_event' and related_id in (
      select id from public.corporate_events where event_type = 'announcement'
    )
  ),
  'a non-material event type (announcement) never triggers thesis_review_triggered_by_event'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "88888888-8888-8888-8888-888888888888", "role": "authenticated"}';
select ok(
  not exists (
    select 1 from public.research_review_reminders()
    where reminder_type like 'event_%' and instrument_id = 'd1111111-1111-1111-1111-111111111111'
  ),
  'corporate-event reminders never appear for a user with no holding in that instrument'
);
reset role;

-- ---------------------------------------------------------------------
-- create_ai_job dispatch: the new perform invoke_market_data_function(...)
-- call must not break the existing provider_not_configured short-circuit
-- (the dispatch line is unreachable on that path, since no model is
-- enabled in this environment) or the RPC's own signature/grants.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select is(
  (
    select reason from public.create_ai_job(
      'document_summary', 'openai', 'gpt-4o-mini', 'company', 'v1', 'phase10-followup-hash-1'
    ) limit 1
  ),
  'provider_not_configured',
  'create_ai_job still short-circuits at provider_not_configured after the dispatch change (dispatch line unreached)'
);
select is(
  (
    select queued from public.create_ai_job(
      'document_summary', 'openai', 'gpt-4o-mini', 'company', 'v1', 'phase10-followup-hash-2'
    ) limit 1
  ),
  false,
  'create_ai_job still returns queued=false on the same short-circuit path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_ai_job(text, text, text, text, text, text, uuid[], uuid, uuid, uuid[], text)',
    'execute'
  ),
  'authenticated retains execute on create_ai_job after the dispatch-wiring migration'
);

reset role;

select * from finish();
rollback;
