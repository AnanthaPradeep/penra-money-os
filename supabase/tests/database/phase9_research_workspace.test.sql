-- pgTAP tests for Phase 9: company fundamentals, watchlists, research
-- notes, investment theses/versions, investment ideas, and the shared
-- research_review_events audit trail (see supabase/migrations/
-- 20260823143151_phase9_research_workspace.sql).

begin;

select plan(87);

create or replace function pg_temp.throws_with_code(p_sql text, p_expected_code text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return false;
exception when others then
  return sqlstate = p_expected_code;
end;
$$;

-- Fixed literal ids:
--   user1 = 33333333-3333-3333-3333-333333333333
--   user2 = 44444444-4444-4444-4444-444444444444
--   stock instrument (company)  = b1111111-1111-1111-1111-111111111111
--   mutual fund instrument (not a company) = b2222222-2222-2222-2222-222222222222

insert into auth.users (id, email, raw_user_meta_data)
values ('33333333-3333-3333-3333-333333333333', 'pgtap-phase9-one@example.com', '{}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-4444-444444444444', 'pgtap-phase9-two@example.com', '{}'::jsonb);

insert into public.market_instruments (id, provider, provider_instrument_id, name, instrument_kind, symbol, exchange)
values ('b1111111-1111-1111-1111-111111111111', 'twelve_data', 'TESTCO.NSE', 'Test Company Ltd', 'stock', 'TESTCO', 'NSE');
insert into public.market_instruments (id, provider, provider_instrument_id, name, instrument_kind)
values ('b2222222-2222-2222-2222-222222222222', 'amfi', '900001', 'Test Mutual Fund', 'mutual_fund');

-- ---------------------------------------------------------------------
-- A. Schema: tables, RLS, key functions, no direct write grants on
-- shared provider tables.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'company_profiles'), 'public.company_profiles table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'company_financial_periods'), 'public.company_financial_periods table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'company_financial_metrics'), 'public.company_financial_metrics table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'watchlists'), 'public.watchlists table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'watchlist_items'), 'public.watchlist_items table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'research_notes'), 'public.research_notes table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'company_filings'), 'public.company_filings table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'investment_theses'), 'public.investment_theses table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'investment_thesis_versions'), 'public.investment_thesis_versions table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'investment_ideas'), 'public.investment_ideas table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'research_review_events'), 'public.research_review_events table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'fundamentals_sync_runs'), 'public.fundamentals_sync_runs table exists');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('company_profiles', 'company_financial_periods', 'company_financial_metrics', 'fundamentals_sync_runs')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated has no direct write grant on any shared Phase 9 provider table'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'fundamentals_sync_runs' and grantee = 'authenticated'),
  0,
  'authenticated has zero grants at all on fundamentals_sync_runs'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'investment_thesis_versions' and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated cannot directly write investment_thesis_versions (audit trail, trigger-only)'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'research_review_events' and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated cannot directly write research_review_events (audit trail, trigger-only)'
);

-- ---------------------------------------------------------------------
-- B. company_profiles / company_financial_periods / company_financial_metrics.
-- ---------------------------------------------------------------------

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.company_profiles (instrument_id, provider) values ('b2222222-2222-2222-2222-222222222222', 'twelve_data') $$,
    '23514'
  ),
  'a mutual-fund instrument cannot receive a company_profiles row'
);

select lives_ok(
  $$ select public.ingest_company_profile('b1111111-1111-1111-1111-111111111111', 'twelve_data', 'Test Company Limited', 'India', 'Technology', 'IT Services', '03-31', 'https://example.com') $$,
  'ingest_company_profile succeeds for a stock-kind instrument'
);
select is(
  (select sector from public.company_profiles where instrument_id = 'b1111111-1111-1111-1111-111111111111'),
  'Technology',
  'the ingested profile is stored correctly'
);

select lives_ok(
  $$ select public.ensure_company_financial_period('b1111111-1111-1111-1111-111111111111', 'annual', '2025-03-31', 2025, null, '2025-05-15', 'INR', 'consolidated', 'twelve_data') $$,
  'ensure_company_financial_period creates a new period'
);
create temp table pg_temp.period1 as
  select id from public.company_financial_periods
  where instrument_id = 'b1111111-1111-1111-1111-111111111111' and fiscal_period_end = '2025-03-31' and is_current = true;
grant select on pg_temp.period1 to authenticated;

select ok(
  pg_temp.throws_with_code(
    $q$ insert into public.company_financial_periods (instrument_id, period_type, fiscal_period_end, fiscal_year, fiscal_quarter, currency, provider)
        values ('b1111111-1111-1111-1111-111111111111', 'quarterly', '2025-03-31', 2025, null, 'INR', 'twelve_data') $q$,
    '23514'
  ),
  'a quarterly period row requires a fiscal_quarter between 1 and 4'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.company_financial_metrics (period_id, statement_type, metric_key, value) values ((select id from pg_temp.period1), 'balance_sheet', 'revenue', 100) $$,
    '23514'
  ),
  'a metric_key/statement_type mismatch is rejected (revenue belongs to income_statement, not balance_sheet)'
);

select lives_ok(
  $$ select public.ingest_company_financial_metric((select id from pg_temp.period1), 'income_statement', 'revenue', 1000000.0000) $$,
  'ingest_company_financial_metric inserts a fresh current row'
);
select is(
  (select count(*)::int from public.company_financial_metrics where period_id = (select id from pg_temp.period1)),
  1,
  'exactly one metric row exists after the first ingest'
);
select is(
  (select id from public.ingest_company_financial_metric((select id from pg_temp.period1), 'income_statement', 'revenue', 1000000.0000)),
  (select id from public.company_financial_metrics where period_id = (select id from pg_temp.period1) and metric_key = 'revenue'),
  'ingesting the same value again is a no-op (returns the existing row, no duplicate)'
);
select is(
  (select count(*)::int from public.company_financial_metrics where period_id = (select id from pg_temp.period1)),
  1,
  'still exactly one row after the idempotent re-ingest'
);
select lives_ok(
  $$ select public.ingest_company_financial_metric((select id from pg_temp.period1), 'income_statement', 'revenue', 1050000.0000) $$,
  'a differing value is accepted as a correction'
);
select is(
  (select count(*)::int from public.company_financial_metrics where period_id = (select id from pg_temp.period1)),
  2,
  'the correction preserved the original row (2 total) instead of overwriting it in place'
);
select is(
  (select value from public.company_financial_metrics where period_id = (select id from pg_temp.period1) and is_current = true),
  1050000.0000::numeric,
  'the current row now holds the corrected value'
);
select is(
  (select is_current from public.company_financial_metrics where period_id = (select id from pg_temp.period1) and value = 1000000.0000),
  false,
  'the original row is marked no longer current, never deleted'
);

select lives_ok(
  $$ select public.ingest_company_financial_metrics_batch(
       jsonb_build_array(
         jsonb_build_object('period_id', (select id::text from pg_temp.period1), 'statement_type', 'income_statement', 'metric_key', 'net_income', 'value', 200000),
         jsonb_build_object('period_id', '99999999-9999-9999-9999-999999999999', 'statement_type', 'income_statement', 'metric_key', 'net_income', 'value', 200000)
       )
     ) $$,
  'ingest_company_financial_metrics_batch runs without raising'
);
select is(
  (select updated_count from public.ingest_company_financial_metrics_batch(
    jsonb_build_array(jsonb_build_object('period_id', (select id::text from pg_temp.period1), 'statement_type', 'income_statement', 'metric_key', 'operating_income', 'value', 300000))
  )),
  1,
  'a batch with one valid row reports updated_count = 1'
);
select is(
  (select skipped_count from public.ingest_company_financial_metrics_batch(
    jsonb_build_array(jsonb_build_object('period_id', '99999999-9999-9999-9999-999999999999', 'statement_type', 'income_statement', 'metric_key', 'operating_income', 'value', 300000))
  )),
  1,
  'a batch row referencing a nonexistent period is counted as skipped, never aborting the whole batch'
);

-- ---------------------------------------------------------------------
-- C. Watchlists and watchlist_items (user1).
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.watchlists (user_id, name) values ('33333333-3333-3333-3333-333333333333', 'Core holdings') $$,
  'user1 can create a watchlist for themselves'
);
create temp table pg_temp.wl1 as select id from public.watchlists where user_id = '33333333-3333-3333-3333-333333333333' and name = 'Core holdings';

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.watchlists (user_id, name) values ('44444444-4444-4444-4444-444444444444', 'Forged watchlist') $$,
    '42501'
  ),
  'user1 cannot create a watchlist owned by another user'
);

select lives_ok(
  $$ insert into public.watchlist_items (watchlist_id, instrument_id) values ((select id from pg_temp.wl1), 'b1111111-1111-1111-1111-111111111111') $$,
  'user1 adds an instrument to their watchlist'
);
select is(
  (select user_id from public.watchlist_items where watchlist_id = (select id from pg_temp.wl1)),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'watchlist_items.user_id is auto-populated from the parent watchlist by trigger'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.watchlist_items (watchlist_id, instrument_id) values ((select id from pg_temp.wl1), 'b1111111-1111-1111-1111-111111111111') $$,
    '23505'
  ),
  'a duplicate instrument in the same watchlist is rejected'
);

select lives_ok(
  $$ insert into public.watchlists (user_id, name) values ('33333333-3333-3333-3333-333333333333', 'Second list') $$,
  'user1 creates a second watchlist'
);
create temp table pg_temp.wl2 as select id from public.watchlists where user_id = '33333333-3333-3333-3333-333333333333' and name = 'Second list';
select lives_ok(
  $$ insert into public.watchlist_items (watchlist_id, instrument_id) values ((select id from pg_temp.wl2), 'b1111111-1111-1111-1111-111111111111') $$,
  'the same instrument is allowed in a different watchlist'
);

select is(
  (select count(*)::int from public.investment_holdings where investment_asset_id in (
    select id from public.investment_assets where market_instrument_id = 'b1111111-1111-1111-1111-111111111111'
  )),
  0,
  'adding an instrument to a watchlist never creates an investment_holdings row'
);

reset role;

-- ---------------------------------------------------------------------
-- D. research_notes and company_filings (user1).
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.research_notes (user_id, instrument_id, title, body, source_url)
       values ('33333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Bad URL', 'body', 'javascript:alert(1)') $$,
    '23514'
  ),
  'a non-https source_url is rejected on research_notes'
);
select lives_ok(
  $$ insert into public.research_notes (user_id, instrument_id, title, body, note_type)
     values ('33333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Q4 results look strong', 'Revenue beat estimates.', 'financial_result') $$,
  'user1 creates a research note'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.research_notes (user_id, instrument_id, title, body)
       values ('33333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222', 'Wrong kind', 'body') $$,
    '23514'
  ),
  'a research note cannot target a mutual-fund instrument (not a company)'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.company_filings (user_id, instrument_id, title, source_domain, source_url)
       values ('33333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Annual report', 'nseindia.com', 'http://nseindia.com/report.pdf') $$,
    '23514'
  ),
  'a non-https filing source_url is rejected'
);
select lives_ok(
  $$ insert into public.company_filings (user_id, instrument_id, title, category, source_domain, source_url)
     values ('33333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'FY25 annual report', 'annual_report', 'nseindia.com', 'https://nseindia.com/report.pdf') $$,
  'user1 adds a valid HTTPS filing link'
);

reset role;

-- ---------------------------------------------------------------------
-- E. investment_theses versioning.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.investment_theses (user_id, instrument_id, title, summary, status)
     values ('33333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Long-term compounder', 'Strong moat.', 'draft') $$,
  'user1 creates an investment thesis'
);
create temp table pg_temp.thesis1 as
  select id from public.investment_theses where user_id = '33333333-3333-3333-3333-333333333333' and instrument_id = 'b1111111-1111-1111-1111-111111111111';

select is(
  (select current_version from public.investment_theses where id = (select id from pg_temp.thesis1)),
  1,
  'a freshly created thesis starts at version 1'
);
select is(
  (select count(*)::int from public.investment_thesis_versions where thesis_id = (select id from pg_temp.thesis1)),
  1,
  'exactly one version row exists after creation'
);

select lives_ok(
  $$ update public.investment_theses set summary = 'Strong moat, expanding margins.', status = 'active' where id = (select id from pg_temp.thesis1) $$,
  'user1 updates their thesis'
);
select is(
  (select current_version from public.investment_theses where id = (select id from pg_temp.thesis1)),
  2,
  'updating the thesis bumps current_version to 2'
);
select is(
  (select count(*)::int from public.investment_thesis_versions where thesis_id = (select id from pg_temp.thesis1)),
  2,
  'the update added a second version row rather than overwriting the first'
);
select is(
  (select summary from public.investment_thesis_versions where thesis_id = (select id from pg_temp.thesis1) and version = 1),
  'Strong moat.',
  'version 1''s original content is preserved unchanged after the update'
);
select is(
  (select summary from public.investment_thesis_versions where thesis_id = (select id from pg_temp.thesis1) and version = 2),
  'Strong moat, expanding margins.',
  'version 2 captures the updated content'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.investment_theses (user_id, instrument_id, title) values ('33333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Duplicate active thesis') $$,
    '23505'
  ),
  'a second non-closed/archived thesis for the same (user, instrument) is rejected'
);

reset role;

-- ---------------------------------------------------------------------
-- F. investment_ideas — decision log via research_review_events.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.investment_ideas (user_id, instrument_id, title) values ('33333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Add on dip') $$,
  'user1 captures an investment idea'
);
create temp table pg_temp.idea1 as
  select id from public.investment_ideas where user_id = '33333333-3333-3333-3333-333333333333' and title = 'Add on dip';

select is(
  (select count(*)::int from public.research_review_events where related_table = 'investment_ideas' and related_id = (select id from pg_temp.idea1) and event_type = 'idea_created'),
  1,
  'creating an idea logs an idea_created review event'
);

select lives_ok(
  $$ update public.investment_ideas set status = 'approved_for_manual_action' where id = (select id from pg_temp.idea1) $$,
  'user1 advances the idea to approved_for_manual_action'
);
select is(
  (select count(*)::int from public.research_review_events where related_table = 'investment_ideas' and related_id = (select id from pg_temp.idea1) and event_type = 'idea_status_changed'),
  1,
  'the status change is logged as a decision-log event'
);
select is(
  (select count(*)::int from public.investment_activities ia
    join public.investment_holdings h on h.id = ia.holding_id
    join public.investment_assets a on a.id = h.investment_asset_id
    where a.market_instrument_id = 'b1111111-1111-1111-1111-111111111111'),
  0,
  'approved_for_manual_action never creates an investment_activities row (no trade is placed)'
);
select is(
  (select count(*)::int from public.ledger_transactions),
  0,
  'no ledger_transactions row was created by any research/idea activity in this test'
);

reset role;

-- ---------------------------------------------------------------------
-- G. research_review_reminders() and mark_overdue_theses_needs_review().
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

update public.investment_theses set expected_review_date = current_date - 5 where id = (select id from pg_temp.thesis1);

select is(
  (select count(*)::int from public.research_review_reminders() where reminder_type = 'thesis_overdue' and related_id = (select id from pg_temp.thesis1)),
  1,
  'research_review_reminders() surfaces the overdue thesis for its own owner'
);

reset role;

select is(
  (select status from public.investment_theses where id = (select id from pg_temp.thesis1)),
  'active',
  'sanity: the thesis is still active before the overdue sweep'
);
select lives_ok(
  $$ select public.mark_overdue_theses_needs_review() $$,
  'mark_overdue_theses_needs_review runs without raising'
);
select is(
  (select status from public.investment_theses where id = (select id from pg_temp.thesis1)),
  'needs_review',
  'the overdue active thesis was transitioned to needs_review'
);
select is(
  (select current_version from public.investment_theses where id = (select id from pg_temp.thesis1)),
  4,
  'the overdue transition is itself auto-versioned (version 4: create, edit, set expected_review_date, then this sweep)'
);

-- ---------------------------------------------------------------------
-- H. Cross-user access (user2).
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

select is(
  (select count(*)::int from public.watchlists),
  0,
  'user2 sees zero of user1''s watchlists'
);
select is(
  (select count(*)::int from public.watchlist_items),
  0,
  'user2 sees zero of user1''s watchlist_items'
);
select is(
  (select count(*)::int from public.research_notes),
  0,
  'user2 sees zero of user1''s research_notes'
);
select is(
  (select count(*)::int from public.company_filings),
  0,
  'user2 sees zero of user1''s company_filings'
);
select is(
  (select count(*)::int from public.investment_theses),
  0,
  'user2 sees zero of user1''s investment_theses'
);
select is(
  (select count(*)::int from public.investment_thesis_versions),
  0,
  'user2 sees zero of user1''s investment_thesis_versions'
);
select is(
  (select count(*)::int from public.investment_ideas),
  0,
  'user2 sees zero of user1''s investment_ideas'
);
select is(
  (select count(*)::int from public.research_review_events),
  0,
  'user2 sees zero of user1''s research_review_events'
);
select ok(
  pg_temp.throws_with_code(
    $$ select count(*)::int from public.fundamentals_sync_runs $$,
    '42501'
  ),
  'fundamentals_sync_runs throws permission denied for any authenticated read (deliberately zero-grant, matches market_data_sync_runs)'
);

-- Shared provider tables remain readable by every authenticated user.
select is(
  (select count(*)::int from public.company_profiles where instrument_id = 'b1111111-1111-1111-1111-111111111111'),
  1,
  'user2 CAN read the shared company_profiles row (no user-ownership)'
);
select is(
  (select count(*)::int from public.company_financial_periods where instrument_id = 'b1111111-1111-1111-1111-111111111111'),
  1,
  'user2 CAN read the shared company_financial_periods row'
);
select ok(
  (select count(*)::int from public.company_financial_metrics where period_id = (select id from pg_temp.period1)) > 0,
  'user2 CAN read shared company_financial_metrics rows for the instrument (no user-ownership)'
);
select is(
  (select count(*)::int from public.company_financial_metrics where period_id = (select id from pg_temp.period1) and metric_key = 'revenue' and is_current = true),
  1,
  'exactly one current revenue observation is visible — the superseded original stays queryable but is not the current one'
);

-- Direct writes to shared provider tables are rejected for authenticated.
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.company_profiles (instrument_id, provider) values ('b1111111-1111-1111-1111-111111111111', 'twelve_data') $$,
    '42501'
  ),
  'authenticated cannot directly INSERT into company_profiles'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.company_financial_metrics (period_id, statement_type, metric_key, value) values ((select id from pg_temp.period1), 'income_statement', 'revenue', 1) $$,
    '42501'
  ),
  'authenticated cannot directly INSERT into company_financial_metrics'
);

-- Global/service-role-only refresh processors are unavailable to authenticated.
select ok(
  pg_temp.throws_with_code(
    $$ select public.process_company_fundamentals_refresh_all() $$,
    '42501'
  ),
  'authenticated cannot call process_company_fundamentals_refresh_all()'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.ingest_company_profile('b1111111-1111-1111-1111-111111111111', 'twelve_data') $$,
    '42501'
  ),
  'authenticated cannot call ingest_company_profile() directly (service_role only)'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.mark_overdue_theses_needs_review() $$,
    '42501'
  ),
  'authenticated cannot call mark_overdue_theses_needs_review() (service_role only)'
);

-- Archived research cannot be mutated by another user.
update public.watchlists set name = 'Hijacked' where id = (select id from pg_temp.wl1);

reset role;

select is(
  (select name from public.watchlists where id = (select id from pg_temp.wl1)),
  'Core holdings',
  'user2''s attempted update to user1''s watchlist changed nothing (RLS silently excludes it, not a forged success) — checked from an unrestricted role since user2 cannot even see the row'
);

-- ---------------------------------------------------------------------
-- I. Self-scoped fundamentals refresh: cooldown and bounded scope.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is(
  (select queued from public.run_fundamentals_refresh_self()),
  false,
  'run_fundamentals_refresh_self reports queued=false (provider not configured in this test environment)'
);

reset role;

select is(
  (select count(*)::int from public.fundamentals_sync_runs where triggered_by_user_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'exactly one fundamentals_sync_runs row was recorded for the single self-refresh call (no double-logging from the internal dispatch helper)'
);

select * from finish();
rollback;
