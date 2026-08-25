-- pgTAP tests for Phase 10: IPO tracker, corporate events, AI job ledger,
-- source-grounded summaries, citation integrity, and human review (see
-- supabase/migrations/20260824174414_phase10_ipo_events_ai.sql).

begin;

select plan(134);

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
--   user1 = 55555555-5555-5555-5555-555555555555
--   user2 = 66666666-6666-6666-6666-666666666666
--   stock instrument (post-listing link target) = c1111111-1111-1111-1111-111111111111

insert into auth.users (id, email, raw_user_meta_data)
values ('55555555-5555-5555-5555-555555555555', 'pgtap-phase10-one@example.com', '{}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('66666666-6666-6666-6666-666666666666', 'pgtap-phase10-two@example.com', '{}'::jsonb);

insert into public.market_instruments (id, provider, provider_instrument_id, name, instrument_kind, symbol, exchange)
values ('c1111111-1111-1111-1111-111111111111', 'twelve_data', 'TESTCO2.NSE', 'Test Company Two Ltd', 'stock', 'TESTCO2', 'NSE');
insert into public.market_instruments (id, provider, provider_instrument_id, name, instrument_kind)
values ('c2222222-2222-2222-2222-222222222222', 'amfi', '900002', 'Test Mutual Fund Two', 'mutual_fund');

-- ---------------------------------------------------------------------
-- A. Schema: tables, RLS forced, minimum grants on shared tables.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = t.tablename), 'public.' || t.tablename || ' table exists')
from unnest(array[
  'ipo_issues', 'ipo_status_history', 'ipo_documents', 'ipo_financial_metrics',
  'ipo_watchlist_items', 'ipo_research_notes', 'corporate_events',
  'source_document_chunks', 'ai_provider_models', 'ai_jobs', 'ai_job_sources',
  'ai_job_outputs', 'ai_usage_daily', 'research_sync_runs'
]) as t(tablename);

select ok(
  (select relforcerowsecurity from pg_class where relname = t.tablename and relnamespace = 'public'::regnamespace),
  t.tablename || ' has FORCE ROW LEVEL SECURITY'
)
from unnest(array[
  'ipo_issues', 'ipo_status_history', 'ipo_documents', 'ipo_financial_metrics',
  'ipo_watchlist_items', 'ipo_research_notes', 'corporate_events',
  'source_document_chunks', 'ai_provider_models', 'ai_jobs', 'ai_job_sources',
  'ai_job_outputs', 'ai_usage_daily', 'research_sync_runs'
]) as t(tablename);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('ipo_issues', 'ipo_status_history', 'ipo_documents', 'ipo_financial_metrics', 'corporate_events', 'ai_provider_models')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated has no direct write grant on any shared Phase 10 table'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'research_sync_runs' and grantee = 'authenticated'),
  0,
  'authenticated has zero grants at all on research_sync_runs'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('ai_jobs', 'ai_job_sources', 'ai_job_outputs', 'ai_usage_daily')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated has zero direct write grants on the AI job ledger (RPC-mediated only)'
);

-- ---------------------------------------------------------------------
-- B. IPO issues — add/update/link RPCs, status history, shared read.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.add_ipo_from_official_source('Test IPO Ltd', 'mainboard', 'sebi', 'http://insecure.example.com') $$,
    '22023'
  ),
  'add_ipo_from_official_source rejects a non-https source URL'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.ipo_issues (issuer_name, source_organization, source_url, added_by_user_id) values ('Direct Insert Ltd', 'sebi', 'https://example.com', '55555555-5555-5555-5555-555555555555') $$,
    '42501'
  ),
  'authenticated cannot directly INSERT into ipo_issues (RPC-only)'
);

select lives_ok(
  $$ select public.add_ipo_from_official_source('Test IPO Ltd', 'mainboard', 'sebi', 'https://www.sebi.gov.in/test-ipo') $$,
  'add_ipo_from_official_source succeeds for a signed-in user with an https source'
);

create temporary table pg_temp.ipo1 as
select id from public.ipo_issues where issuer_name = 'Test IPO Ltd';
grant select on pg_temp.ipo1 to authenticated;

select is(
  (select status from public.ipo_issues where id = (select id from pg_temp.ipo1)),
  'unknown',
  'a newly-added IPO defaults to status unknown'
);
select is(
  (select added_by_user_id from public.ipo_issues where id = (select id from pg_temp.ipo1)),
  '55555555-5555-5555-5555-555555555555'::uuid,
  'add_ipo_from_official_source stamps added_by_user_id as the caller, never client-supplied'
);
select is(
  (select count(*)::int from public.ipo_status_history where ipo_issue_id = (select id from pg_temp.ipo1)),
  1,
  'creating an IPO records exactly one ipo_status_history row'
);

select lives_ok(
  $$ select public.update_ipo_official_fields((select id from pg_temp.ipo1), 'open', p_issue_open_date => '2026-09-01', p_issue_close_date => '2026-09-03') $$,
  'update_ipo_official_fields succeeds for the IPO''s own submitter'
);
select is(
  (select status from public.ipo_issues where id = (select id from pg_temp.ipo1)),
  'open',
  'status transitioned to open'
);
select is(
  (select count(*)::int from public.ipo_status_history where ipo_issue_id = (select id from pg_temp.ipo1)),
  2,
  'the status transition appended a second ipo_status_history row (append-only, never overwritten)'
);
select ok(
  exists (
    select 1 from public.ipo_status_history
    where ipo_issue_id = (select id from pg_temp.ipo1) and previous_status = 'unknown' and new_status = 'open'
  ),
  'a history row records the unknown -> open transition (changed_at is frozen per-transaction under now(), so this checks existence rather than ORDER BY changed_at)'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.update_ipo_official_fields((select id from pg_temp.ipo1), p_source_url => 'http://insecure.example.com') $$,
    '22023'
  ),
  'update_ipo_official_fields rejects a non-https source URL'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.link_ipo_to_market_instrument((select id from pg_temp.ipo1), 'c2222222-2222-2222-2222-222222222222') $$,
    '22023'
  ),
  'link_ipo_to_market_instrument rejects a mutual-fund-kind instrument'
);
select lives_ok(
  $$ select public.link_ipo_to_market_instrument((select id from pg_temp.ipo1), 'c1111111-1111-1111-1111-111111111111') $$,
  'link_ipo_to_market_instrument succeeds for a stock-kind instrument'
);
select is(
  (select linked_instrument_id from public.ipo_issues where id = (select id from pg_temp.ipo1)),
  'c1111111-1111-1111-1111-111111111111'::uuid,
  'linking stores the confirmed instrument id'
);
select is(
  (select count(*)::int from public.investment_activities where holding_id in (
    select h.id from public.investment_holdings h
    join public.investment_assets a on a.id = h.investment_asset_id
    where a.market_instrument_id = 'c1111111-1111-1111-1111-111111111111'
  )),
  0,
  'linking an IPO to a market instrument never creates any investment_activities row (no holding created)'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.update_ipo_official_fields((select id from pg_temp.ipo1), 'closed') $$,
    '42501'
  ),
  'a different user cannot update someone else''s IPO issue'
);
select ok(
  (select count(*)::int from public.ipo_issues where id = (select id from pg_temp.ipo1)) = 1,
  'the shared IPO catalogue is readable by every authenticated user regardless of who added it'
);

reset role;

-- ---------------------------------------------------------------------
-- C. IPO documents.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.add_ipo_document((select id from pg_temp.ipo1), 'drhp', 'DRHP', 'ftp://example.com/drhp.pdf', 'sebi') $$,
    '22023'
  ),
  'add_ipo_document rejects a non-https source URL'
);
select lives_ok(
  $$ select public.add_ipo_document((select id from pg_temp.ipo1), 'drhp', 'Draft Red Herring Prospectus', 'https://www.sebi.gov.in/test-drhp.pdf', 'sebi') $$,
  'add_ipo_document succeeds with a valid https official source'
);

create temporary table pg_temp.doc1 as
select id from public.ipo_documents where ipo_issue_id = (select id from pg_temp.ipo1);
grant select on pg_temp.doc1 to authenticated;

select is(
  (select count(*)::int from public.ipo_documents where ipo_issue_id = (select id from pg_temp.ipo1)),
  1,
  'exactly one document was recorded'
);

reset role;

-- ---------------------------------------------------------------------
-- D. IPO financial metrics — supersede/idempotent-correction pattern.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select lives_ok(
  $$ select public.add_ipo_financial_metric((select id from pg_temp.ipo1), 'revenue', '2025-03-31', 1000000.0000) $$,
  'add_ipo_financial_metric inserts a fresh current row'
);

select is(
  (select count(*)::int from public.ipo_financial_metrics where ipo_issue_id = (select id from pg_temp.ipo1) and is_current = true),
  1,
  'exactly one current metric exists after the first ingest'
);

select lives_ok(
  $$ select public.add_ipo_financial_metric((select id from pg_temp.ipo1), 'revenue', '2025-03-31', 1000000.0000) $$,
  'a same-value re-ingest does not raise'
);
select is(
  (select count(*)::int from public.ipo_financial_metrics where ipo_issue_id = (select id from pg_temp.ipo1)),
  1,
  'a same-value re-ingest is a true no-op — still exactly one row total'
);

select lives_ok(
  $$ select public.add_ipo_financial_metric((select id from pg_temp.ipo1), 'revenue', '2025-03-31', 1250000.0000) $$,
  'a differing-value re-ingest (a correction) succeeds'
);
select is(
  (select count(*)::int from public.ipo_financial_metrics where ipo_issue_id = (select id from pg_temp.ipo1)),
  2,
  'a correction preserves the prior row rather than overwriting it — now two rows total'
);
select is(
  (select count(*)::int from public.ipo_financial_metrics where ipo_issue_id = (select id from pg_temp.ipo1) and is_current = true),
  1,
  'exactly one current row remains after the correction'
);
select is(
  (select value from public.ipo_financial_metrics where ipo_issue_id = (select id from pg_temp.ipo1) and is_current = true),
  1250000.0000,
  'the current row reflects the corrected value'
);
select ok(
  (select superseded_by from public.ipo_financial_metrics where ipo_issue_id = (select id from pg_temp.ipo1) and is_current = false) is not null,
  'the superseded row records its superseded_by pointer'
);

reset role;

-- ---------------------------------------------------------------------
-- E. IPO watchlist items — private, one implicit watchlist per user.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.ipo_watchlist_items (user_id, ipo_issue_id) values ('55555555-5555-5555-5555-555555555555', (select id from pg_temp.ipo1)) $$,
  'user1 can watch an IPO'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.ipo_watchlist_items (user_id, ipo_issue_id) values ('55555555-5555-5555-5555-555555555555', (select id from pg_temp.ipo1)) $$,
    '23505'
  ),
  'watching the same IPO twice is rejected (duplicate)'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.ipo_watchlist_items (user_id, ipo_issue_id) values ('66666666-6666-6666-6666-666666666666', (select id from pg_temp.ipo1)) $$,
    '42501'
  ),
  'a user cannot forge another user''s ipo_watchlist_items row'
);
select is(
  (select count(*)::int from public.research_review_events where event_type = 'ipo_watchlist_item_added' and user_id = '55555555-5555-5555-5555-555555555555'),
  1,
  'watching an IPO logs exactly one ipo_watchlist_item_added decision-log event'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

select is(
  (select count(*)::int from public.ipo_watchlist_items where user_id = '55555555-5555-5555-5555-555555555555'),
  0,
  'user2 cannot see user1''s IPO watchlist items'
);

reset role;

-- ---------------------------------------------------------------------
-- F. IPO research notes — private, structured, one per (user, ipo).
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.ipo_research_notes (user_id, ipo_issue_id, business_overview) values ('55555555-5555-5555-5555-555555555555', (select id from pg_temp.ipo1), 'A test business overview.') $$,
  'user1 can create their structured IPO research note'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.ipo_research_notes (user_id, ipo_issue_id) values ('55555555-5555-5555-5555-555555555555', (select id from pg_temp.ipo1)) $$,
    '23505'
  ),
  'a second research note for the same (user, ipo) is rejected (one evolving record, not a list)'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

select is(
  (select count(*)::int from public.ipo_research_notes where user_id = '55555555-5555-5555-5555-555555555555'),
  0,
  'user2 cannot see user1''s IPO research note'
);

reset role;

-- ---------------------------------------------------------------------
-- G. Corporate events — service_role-only ingestion, supersede pattern.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.ingest_corporate_event('c1111111-1111-1111-1111-111111111111', 'dividend', 'Test dividend', 'twelve_data') $$,
    '42501'
  ),
  'authenticated cannot call ingest_corporate_event() directly (service_role only)'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.corporate_events (instrument_id, event_type, title, source) values ('c1111111-1111-1111-1111-111111111111', 'dividend', 'Direct insert', 'twelve_data') $$,
    '42501'
  ),
  'authenticated cannot directly INSERT into corporate_events'
);

reset role;

select lives_ok(
  $$ select public.ingest_corporate_event('c1111111-1111-1111-1111-111111111111', 'dividend', 'Interim dividend FY26', 'twelve_data', p_provider_event_id => 'evt-1', p_details => '{"amount_per_share": 5}'::jsonb) $$,
  'ingest_corporate_event succeeds when run without a client role (service_role-equivalent in this test)'
);
select is(
  (select count(*)::int from public.corporate_events where instrument_id = 'c1111111-1111-1111-1111-111111111111' and is_current = true),
  1,
  'exactly one current corporate event exists after the first ingest'
);

select lives_ok(
  $$ select public.ingest_corporate_event('c1111111-1111-1111-1111-111111111111', 'dividend', 'Interim dividend FY26', 'twelve_data', p_provider_event_id => 'evt-1', p_details => '{"amount_per_share": 5}'::jsonb) $$,
  'a same-value re-ingest does not raise'
);
select is(
  (select count(*)::int from public.corporate_events where instrument_id = 'c1111111-1111-1111-1111-111111111111'),
  1,
  'a same-value re-ingest is a true no-op'
);

select lives_ok(
  $$ select public.ingest_corporate_event('c1111111-1111-1111-1111-111111111111', 'dividend', 'Interim dividend FY26 (revised)', 'twelve_data', p_provider_event_id => 'evt-1', p_details => '{"amount_per_share": 6}'::jsonb) $$,
  'a revised re-ingest (a correction) succeeds'
);
select is(
  (select count(*)::int from public.corporate_events where instrument_id = 'c1111111-1111-1111-1111-111111111111'),
  2,
  'the correction preserves the prior row — now two rows total'
);
select is(
  (select title from public.corporate_events where instrument_id = 'c1111111-1111-1111-1111-111111111111' and is_current = true),
  'Interim dividend FY26 (revised)',
  'the current row reflects the revision'
);

select lives_ok(
  $$ select public.ingest_corporate_event('c1111111-1111-1111-1111-111111111111', 'board_meeting', 'Board meeting to consider buyback', 'twelve_data', p_status => 'cancelled', p_provider_event_id => 'evt-2') $$,
  'a cancelled event can be ingested'
);
select is(
  (select status from public.corporate_events where provider_event_id = 'evt-2'),
  'cancelled',
  'a cancelled event stays visible with status=cancelled rather than being deleted'
);

select is(
  (select count(*)::int from public.investment_activities),
  0,
  'no corporate event ingestion ever created an investment_activities row (splits/bonuses never auto-adjust holdings)'
);
select is(
  (select count(*)::int from public.ledger_transactions),
  0,
  'no corporate event ingestion ever created a ledger_transactions row (dividends never auto-create income)'
);

-- ---------------------------------------------------------------------
-- H. source_document_chunks — private, exactly-one-parent constraint.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.source_document_chunks (user_id, content_text, content_hash) values ('55555555-5555-5555-5555-555555555555', 'orphan chunk', 'hash1') $$,
    '23514'
  ),
  'a chunk with neither ipo_document_id nor company_filing_id is rejected'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.source_document_chunks (user_id, ipo_document_id, company_filing_id, content_text, content_hash)
       values ('55555555-5555-5555-5555-555555555555', (select id from pg_temp.doc1), (select id from pg_temp.doc1), 'both parents', 'hash2') $$,
    '23514'
  ),
  'a chunk cannot reference both an ipo_document and a company_filing at once'
);
select lives_ok(
  $$ insert into public.source_document_chunks (user_id, ipo_document_id, content_text, content_hash, page_number)
     values ('55555555-5555-5555-5555-555555555555', (select id from pg_temp.doc1), 'The company reported revenue of INR 100 crore.', 'hash3', 4) $$,
  'a chunk with exactly one parent succeeds'
);

create temporary table pg_temp.chunk1 as
select id from public.source_document_chunks where user_id = '55555555-5555-5555-5555-555555555555';
grant select on pg_temp.chunk1 to authenticated;

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

select is(
  (select count(*)::int from public.source_document_chunks where user_id = '55555555-5555-5555-5555-555555555555'),
  0,
  'user2 cannot see user1''s source_document_chunks'
);

reset role;

-- ---------------------------------------------------------------------
-- I. ai_provider_models — shared, read-only, never-enabled catalogue.
-- ---------------------------------------------------------------------

select is(
  (select count(*)::int from public.ai_provider_models where is_enabled = true),
  0,
  'no AI provider model is enabled in this environment (no credential configured)'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ update public.ai_provider_models set is_enabled = true where provider = 'openai' $$,
    '42501'
  ),
  'authenticated cannot directly UPDATE ai_provider_models'
);

reset role;

-- ---------------------------------------------------------------------
-- J. AI job ledger — create/start/complete/block/fail, duplicate
--    prevention, chunk-ownership enforcement, citation-integrity
--    enforcement, human review, cross-user isolation.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select is(
  (select queued from public.create_ai_job('document_summary', 'openai', 'gpt-4o-mini', 'documents', 'v1', 'hash-not-configured', array[(select id from pg_temp.chunk1)])),
  false,
  'create_ai_job reports queued=false when the requested model is not enabled'
);
select is(
  (select reason from public.create_ai_job('document_summary', 'openai', 'gpt-4o-mini', 'documents', 'v1', 'hash-not-configured', array[(select id from pg_temp.chunk1)])),
  'provider_not_configured',
  'create_ai_job reports the honest provider_not_configured reason'
);

reset role;

-- Enable a model directly (as an unrestricted role) purely to exercise
-- the rest of the job lifecycle deterministically in this test — this
-- does not change the real environment's configuration, only this
-- rolled-back transaction's fixture data.
update public.ai_provider_models set is_enabled = true where provider = 'openai' and model_id = 'gpt-4o-mini';

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select job_id from public.create_ai_job('document_summary', 'openai', 'gpt-4o-mini', 'documents', 'v1', 'hash-unauthorized', array['00000000-0000-0000-0000-000000000000'::uuid]) $$,
    '42501'
  ),
  'create_ai_job rejects a chunk id the caller does not own'
);

select is(
  (select queued from public.create_ai_job('document_summary', 'openai', 'gpt-4o-mini', 'documents', 'v1', 'hash-job-1', array[(select id from pg_temp.chunk1)])),
  true,
  'create_ai_job succeeds once the model is enabled and every chunk is owned by the caller'
);

create temporary table pg_temp.job1 as
select id from public.ai_jobs where user_id = '55555555-5555-5555-5555-555555555555' and input_hash = 'hash-job-1';
grant select on pg_temp.job1 to authenticated;

select is(
  (select status from public.ai_jobs where id = (select id from pg_temp.job1)),
  'queued',
  'the new job starts in status=queued'
);
select is(
  (select count(*)::int from public.ai_job_sources where job_id = (select id from pg_temp.job1)),
  1,
  'the job''s source set was recorded'
);

select is(
  (select queued from public.create_ai_job('document_summary', 'openai', 'gpt-4o-mini', 'documents', 'v1', 'hash-job-1', array[(select id from pg_temp.chunk1)])),
  false,
  'a duplicate concurrent request (same user/input_hash while queued) is rejected'
);
select is(
  (select reason from public.create_ai_job('document_summary', 'openai', 'gpt-4o-mini', 'documents', 'v1', 'hash-job-1', array[(select id from pg_temp.chunk1)])),
  'duplicate_job_in_progress',
  'the duplicate rejection reports the honest reason'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.start_ai_job((select id from pg_temp.job1)) $$,
    '42501'
  ),
  'authenticated cannot call start_ai_job directly (service_role only)'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.complete_ai_job((select id from pg_temp.job1), 'out-hash', 100, 50, 0.01, 500, '[]'::jsonb) $$,
    '42501'
  ),
  'authenticated cannot call complete_ai_job directly (service_role only) — cannot forge its own job as completed'
);

reset role;

select lives_ok(
  $$ select public.start_ai_job((select id from pg_temp.job1)) $$,
  'start_ai_job succeeds without a client role'
);
select is(
  (select status from public.ai_jobs where id = (select id from pg_temp.job1)),
  'processing',
  'the job transitioned to processing'
);

select ok(
  pg_temp.throws_with_code(
    format(
      $sql$ select public.complete_ai_job('%s', 'out-hash', 100, 50, 0.01, 500,
        '[{"section_type": "facts", "content": "Revenue was reported.", "citations": ["00000000-0000-0000-0000-000000000000"], "display_order": 0}]'::jsonb) $sql$,
      (select id from pg_temp.job1)
    ),
    '22023'
  ),
  'complete_ai_job rejects an output whose citation references a chunk outside the job''s authorized source set'
);
select is(
  (select status from public.ai_jobs where id = (select id from pg_temp.job1)),
  'processing',
  'a rejected completion (invalid citation) leaves the job status unchanged — no partial output was saved'
);
select is(
  (select count(*)::int from public.ai_job_outputs where job_id = (select id from pg_temp.job1)),
  0,
  'no ai_job_outputs rows were inserted from the rejected completion attempt'
);

select lives_ok(
  format(
    $sql$ select public.complete_ai_job('%s', 'out-hash', 100, 50, 0.0500, 500,
      ('[{"section_type": "facts", "content": "Revenue was reported as INR 100 crore.", "citations": ["' || (select id from pg_temp.chunk1) || '"], "display_order": 0},
        {"section_type": "unknowns", "content": "Profit margin was not disclosed in the reviewed excerpt.", "citations": [], "display_order": 1}]')::jsonb) $sql$,
    (select id from pg_temp.job1)
  ),
  'complete_ai_job succeeds once every citation belongs to the job''s authorized source set'
);
select is(
  (select status from public.ai_jobs where id = (select id from pg_temp.job1)),
  'completed',
  'the job transitioned to completed'
);
select is(
  (select count(*)::int from public.ai_job_outputs where job_id = (select id from pg_temp.job1)),
  2,
  'both output sections were saved'
);
select is(
  (select count(*)::int from public.ai_usage_daily where user_id = '55555555-5555-5555-5555-555555555555' and usage_date = current_date),
  1,
  'completing the job recorded exactly one ai_usage_daily row for today'
);
select is(
  (select jobs_count from public.ai_usage_daily where user_id = '55555555-5555-5555-5555-555555555555' and usage_date = current_date),
  1,
  'ai_usage_daily.jobs_count reflects the one completed job'
);
select is(
  (select count(*)::int from public.research_review_events where event_type = 'ai_job_completed' and user_id = '55555555-5555-5555-5555-555555555555'),
  1,
  'completing a job logs exactly one ai_job_completed decision-log event'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

create temporary table pg_temp.output1 as
select id from public.ai_job_outputs where job_id = (select id from pg_temp.job1) and section_type = 'facts';
grant select on pg_temp.output1 to authenticated;

select lives_ok(
  $$ select public.accept_ai_job_output((select id from pg_temp.output1)) $$,
  'the job''s own user can accept one output section as-is'
);
select is(
  (select accepted from public.ai_job_outputs where id = (select id from pg_temp.output1)),
  true,
  'the section is marked accepted'
);
select is(
  (select is_user_edited from public.ai_job_outputs where id = (select id from pg_temp.output1)),
  false,
  'accepting without an edit does not mark it user-edited'
);
select is(
  (select human_review_status from public.ai_jobs where id = (select id from pg_temp.job1)),
  'accepted_partial',
  'the job records a human_review_status once any section is accepted'
);
select is(
  (select count(*)::int from public.research_review_events where event_type = 'ai_output_accepted' and user_id = '55555555-5555-5555-5555-555555555555'),
  1,
  'accepting a section logs exactly one ai_output_accepted decision-log event'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.accept_ai_job_output((select id from pg_temp.output1)) $$,
    '42501'
  ),
  'a different user cannot accept another user''s AI job output'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.reject_ai_job((select id from pg_temp.job1)) $$,
    '42501'
  ),
  'a different user cannot reject another user''s AI job'
);
select is(
  (select count(*)::int from public.ai_jobs where user_id = '55555555-5555-5555-5555-555555555555'),
  0,
  'user2 cannot see any of user1''s AI jobs'
);
select is(
  (select count(*)::int from public.ai_job_outputs where job_id = (select id from pg_temp.job1)),
  0,
  'user2 cannot see user1''s AI job outputs'
);
select is(
  (select count(*)::int from public.ai_job_sources where job_id = (select id from pg_temp.job1)),
  0,
  'user2 cannot see user1''s AI job sources'
);
select is(
  (select count(*)::int from public.ai_usage_daily where user_id = '55555555-5555-5555-5555-555555555555'),
  0,
  'user2 cannot see user1''s AI usage record'
);

reset role;

-- fail_ai_job / block_ai_job are exercised directly (service_role-only).
select is(
  (select queued from public.create_ai_job('research_question', 'openai', 'gpt-4o-mini', 'documents', 'v1', 'hash-job-2', array[]::uuid[])),
  true,
  'a second, distinct job (different input_hash) can be queued for the same user'
);
select lives_ok(
  $$ select public.fail_ai_job((select id from public.ai_jobs where input_hash = 'hash-job-2'), 'upstream_timeout') $$,
  'fail_ai_job succeeds without a client role'
);
select is(
  (select status from public.ai_jobs where input_hash = 'hash-job-2'),
  'failed',
  'the job is marked failed with the given error code'
);
select is(
  (select error_code from public.ai_jobs where input_hash = 'hash-job-2'),
  'upstream_timeout',
  'the failure error code is recorded'
);

select is(
  (select queued from public.create_ai_job('research_question', 'openai', 'gpt-4o-mini', 'documents', 'v1', 'hash-job-3', array[]::uuid[])),
  true,
  'a third job can be queued'
);
select lives_ok(
  $$ select public.block_ai_job((select id from public.ai_jobs where input_hash = 'hash-job-3'), 'advice_request_refused') $$,
  'block_ai_job succeeds without a client role'
);
select is(
  (select status from public.ai_jobs where input_hash = 'hash-job-3'),
  'blocked',
  'the job is marked blocked (a safety decision, distinct from a plain failure)'
);

-- ---------------------------------------------------------------------
-- K. Global processors are unavailable to authenticated.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.process_corporate_events_refresh_all() $$,
    '42501'
  ),
  'authenticated cannot call process_corporate_events_refresh_all()'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.run_ai_job_cleanup() $$,
    '42501'
  ),
  'authenticated cannot call run_ai_job_cleanup()'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.process_research_summary_refresh_all() $$,
    '42501'
  ),
  'authenticated cannot call process_research_summary_refresh_all()'
);

reset role;

select lives_ok(
  $$ select public.process_corporate_events_refresh_all() $$,
  'process_corporate_events_refresh_all runs cleanly without a client role'
);
select is(
  (select status from public.research_sync_runs where scope = 'corporate_events_refresh' order by started_at desc limit 1),
  'skipped',
  'corporate events refresh honestly reports skipped (no watchlisted/held instruments in this fixture, or provider not configured)'
);

select lives_ok(
  $$ select public.run_ai_job_cleanup() $$,
  'run_ai_job_cleanup runs cleanly without a client role'
);

select lives_ok(
  $$ select public.process_research_summary_refresh_all() $$,
  'process_research_summary_refresh_all runs cleanly without a client role'
);
select is(
  (select error_code from public.research_sync_runs where scope = 'research_summary_refresh' order by started_at desc limit 1),
  'auto_queue_not_implemented',
  'research summary refresh honestly reports it does not auto-queue jobs, even with a model enabled in this fixture'
);

select * from finish();
rollback;
