-- pgTAP tests for Phase 8: market_instruments/market_prices/
-- market_data_sync_runs/market_data_provider_state/portfolio_value_
-- snapshots, provider-aware valuation precedence, refresh orchestration,
-- and RLS/privilege boundaries (see supabase/migrations/
-- 20260820204721_phase8_market_data_performance.sql).

begin;

select plan(93);

create temp table pg_temp.today_ist as
  select ((now() at time zone 'Asia/Kolkata')::date) as d;
grant select on pg_temp.today_ist to authenticated;

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
--   user1 = 11111111-1111-1111-1111-111111111111
--   user2 = 22222222-2222-2222-2222-222222222222
--   bank1 = b1111111-1111-1111-1111-111111111111 (user1 asset, bank_savings)
--   inv1  = d1111111-1111-1111-1111-111111111111 (user1 asset, investment)

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'pgtap-phase8-one@example.com', '{}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-2222-2222-222222222222', 'pgtap-phase8-two@example.com', '{}'::jsonb);

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'User1 Bank', 'asset', 'bank_savings', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'User1 Broker', 'asset', 'investment', 'INR');

-- ---------------------------------------------------------------------
-- A. Schema: tables, RLS, key functions, no direct write grants.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'market_instruments'), 'public.market_instruments table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'market_prices'), 'public.market_prices table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'market_data_sync_runs'), 'public.market_data_sync_runs table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'market_data_provider_state'), 'public.market_data_provider_state table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'portfolio_value_snapshots'), 'public.portfolio_value_snapshots table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.market_instruments'::regclass), 'RLS enabled on market_instruments');
select ok((select relforcerowsecurity from pg_class where oid = 'public.market_instruments'::regclass), 'RLS forced on market_instruments');
select ok((select relrowsecurity from pg_class where oid = 'public.market_prices'::regclass), 'RLS enabled on market_prices');
select ok((select relforcerowsecurity from pg_class where oid = 'public.market_prices'::regclass), 'RLS forced on market_prices');
select ok((select relrowsecurity from pg_class where oid = 'public.market_data_sync_runs'::regclass), 'RLS enabled on market_data_sync_runs');
select ok((select relforcerowsecurity from pg_class where oid = 'public.market_data_sync_runs'::regclass), 'RLS forced on market_data_sync_runs');
select ok((select relrowsecurity from pg_class where oid = 'public.market_data_provider_state'::regclass), 'RLS enabled on market_data_provider_state');
select ok((select relforcerowsecurity from pg_class where oid = 'public.market_data_provider_state'::regclass), 'RLS forced on market_data_provider_state');
select ok((select relrowsecurity from pg_class where oid = 'public.portfolio_value_snapshots'::regclass), 'RLS enabled on portfolio_value_snapshots');
select ok((select relforcerowsecurity from pg_class where oid = 'public.portfolio_value_snapshots'::regclass), 'RLS forced on portfolio_value_snapshots');

select ok(exists (select 1 from pg_proc where proname = 'build_portfolio_snapshot'), 'build_portfolio_snapshot() exists');
select ok(exists (select 1 from pg_proc where proname = 'run_market_data_refresh_self'), 'run_market_data_refresh_self() exists');
select ok(exists (select 1 from pg_proc where proname = 'investment_holding_summary'), 'investment_holding_summary() exists');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('market_instruments', 'market_prices', 'market_data_sync_runs', 'market_data_provider_state', 'portfolio_value_snapshots')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated has no direct INSERT/UPDATE/DELETE grant on any Phase 8 table'
);
select is(
  (select count(*)::int from information_schema.role_routine_grants
    where routine_name in ('run_amfi_refresh', 'process_stock_price_refresh_all', 'run_portfolio_snapshot_for_all', 'build_portfolio_snapshot', 'invoke_market_data_function')
      and grantee in ('authenticated', 'anon')),
  0,
  'the global refresh/snapshot processors are not granted to authenticated or anon'
);

-- ---------------------------------------------------------------------
-- B. market_instruments uniqueness and search.
-- ---------------------------------------------------------------------

insert into public.market_instruments (id, provider, provider_instrument_id, name, instrument_kind, isin)
values ('a1111111-1111-1111-1111-111111111111', 'amfi', '100001', 'Test Fund Growth', 'mutual_fund', 'INF000000001');

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.market_instruments (provider, provider_instrument_id, name, instrument_kind)
       values ('amfi', '100001', 'Duplicate Scheme Code', 'mutual_fund') $$,
    '23505'
  ),
  'a duplicate (provider, provider_instrument_id) is rejected'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.market_instruments (provider, provider_instrument_id, name, instrument_kind, isin)
       values ('amfi', '100002', 'Duplicate ISIN Scheme', 'mutual_fund', 'INF000000001') $$,
    '23505'
  ),
  'a duplicate (provider, isin) is rejected'
);

insert into public.market_instruments (id, provider, provider_instrument_id, name, instrument_kind, symbol, exchange)
values ('a2222222-2222-2222-2222-222222222222', 'twelve_data', 'HDFCBANK.NSE', 'HDFC Bank Ltd', 'stock', 'HDFCBANK', 'NSE');

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.search_market_instruments('Test Fund', 'mutual_fund', 10)),
  1,
  'search_market_instruments finds the seeded mutual fund by name'
);
select is(
  (select count(*)::int from public.search_market_instruments('100001', null, 10)),
  1,
  'search_market_instruments finds a scheme by its exact provider instrument id prefix'
);
select is(
  (select count(*)::int from public.search_market_instruments('HDFCBANK', 'stock', 10)),
  1,
  'search_market_instruments finds the seeded stock by symbol'
);

reset role;

-- ---------------------------------------------------------------------
-- C. market_prices idempotency and the correction/supersede rule.
-- ---------------------------------------------------------------------

insert into public.market_prices (id, instrument_id, price_kind, effective_date, price, provider)
values ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'nav', (select d from pg_temp.today_ist), 45.6789, 'amfi');

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.market_prices (instrument_id, price_kind, effective_date, price, provider)
       values ('a1111111-1111-1111-1111-111111111111', 'nav', (select d from pg_temp.today_ist), 45.6789, 'amfi') $$,
    '23505'
  ),
  'a second is_current row for the same (instrument, provider, kind, date) is rejected outright by the unique index'
);

-- The application-level correction rule (superseding, not the raw table
-- insert above) is: mark the old row is_current = false with
-- superseded_by set, then insert the new one. Proven manually here first
-- to establish the schema-level shape is sound and auditable; section C2
-- below proves the same rule via the real ingest_market_price_observation
-- function the Edge Functions actually call.
update public.market_prices set is_current = false where id = 'c1111111-1111-1111-1111-111111111111';
insert into public.market_prices (id, instrument_id, price_kind, effective_date, price, provider)
values ('c2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'nav', (select d from pg_temp.today_ist), 46.1234, 'amfi');
update public.market_prices set superseded_by = 'c2222222-2222-2222-2222-222222222222' where id = 'c1111111-1111-1111-1111-111111111111';

select is(
  (select count(*)::int from public.market_prices where instrument_id = 'a1111111-1111-1111-1111-111111111111'),
  2,
  'both the original and the corrected NAV row still physically exist (never overwritten in place)'
);
select is(
  (select price from public.market_prices where id = 'c1111111-1111-1111-1111-111111111111'),
  45.6789::numeric,
  'the original (now-superseded) row keeps its original price value, untouched'
);
select is(
  (select superseded_by from public.market_prices where id = 'c1111111-1111-1111-1111-111111111111'),
  'c2222222-2222-2222-2222-222222222222'::uuid,
  'the original row is linked to its correction via superseded_by'
);
select is(
  (select price from public.market_prices where instrument_id = 'a1111111-1111-1111-1111-111111111111' and is_current = true),
  46.1234::numeric,
  'only the corrected row is now current'
);

-- ---------------------------------------------------------------------
-- C2. ingest_market_price_observation / _batch — the atomic, service-role-
-- only ingestion path the Edge Functions actually call (added after the
-- schema-level proof above; these exercise the real functions).
-- ---------------------------------------------------------------------

select is(
  (select price from public.ingest_market_price_observation(
    'a2222222-2222-2222-2222-222222222222', 'twelve_data', 'close', (select d from pg_temp.today_ist), 1500.25
  )),
  1500.25::numeric,
  'ingest_market_price_observation inserts a fresh current row when none exists'
);
select is(
  (select count(*)::int from public.market_prices where instrument_id = 'a2222222-2222-2222-2222-222222222222'),
  1,
  'exactly one row exists after the first ingest'
);

select is(
  (select id from public.ingest_market_price_observation(
    'a2222222-2222-2222-2222-222222222222', 'twelve_data', 'close', (select d from pg_temp.today_ist), 1500.25
  )),
  (select id from public.market_prices where instrument_id = 'a2222222-2222-2222-2222-222222222222'),
  'ingesting the same price for the same date again is a no-op (returns the existing row)'
);
select is(
  (select count(*)::int from public.market_prices where instrument_id = 'a2222222-2222-2222-2222-222222222222'),
  1,
  'still exactly one row — no duplicate created by the idempotent re-ingest'
);

select is(
  (select price from public.ingest_market_price_observation(
    'a2222222-2222-2222-2222-222222222222', 'twelve_data', 'close', (select d from pg_temp.today_ist), 1512.00
  )),
  1512.00::numeric,
  'ingesting a different price for the same date returns the new corrected price'
);
select is(
  (select count(*)::int from public.market_prices where instrument_id = 'a2222222-2222-2222-2222-222222222222'),
  2,
  'the correction kept both rows (original + corrected) rather than overwriting in place'
);
select is(
  (select count(*)::int from public.market_prices where instrument_id = 'a2222222-2222-2222-2222-222222222222' and is_current = true),
  1,
  'exactly one row is current after the correction'
);
select is(
  (select price from public.market_prices where instrument_id = 'a2222222-2222-2222-2222-222222222222' and is_current = true),
  1512.00::numeric,
  'the current row after correction holds the corrected price'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select ok(
  pg_temp.throws_with_code(
    $$ select public.ingest_market_price_observation('a2222222-2222-2222-2222-222222222222', 'twelve_data', 'close', current_date, 1.00) $$,
    '42501'
  ),
  'authenticated cannot call ingest_market_price_observation directly (service_role only)'
);
reset role;

-- A dedicated instrument, isolated from every other section's fixtures —
-- section E's valuation-precedence tests depend on a1111111's exact price,
-- so the batch test must not touch it.
insert into public.market_instruments (id, provider, provider_instrument_id, name, instrument_kind)
values ('a5555555-5555-5555-5555-555555555555', 'amfi', '100005', 'Batch Test Fund', 'mutual_fund');

select is(
  (select updated_count from public.ingest_market_price_observations_batch(
    'amfi', 'nav', 'INR',
    jsonb_build_array(
      jsonb_build_object('instrument_id', 'a5555555-5555-5555-5555-555555555555', 'effective_date', (select d from pg_temp.today_ist), 'price', 50.0000),
      jsonb_build_object('instrument_id', '99999999-9999-9999-9999-999999999999', 'effective_date', (select d from pg_temp.today_ist), 'price', 50.0000)
    )
  )),
  1,
  'ingest_market_price_observations_batch counts exactly the one row with a real instrument_id as updated'
);
select is(
  (select skipped_count from public.ingest_market_price_observations_batch(
    'amfi', 'nav', 'INR',
    jsonb_build_array(
      jsonb_build_object('instrument_id', 'a5555555-5555-5555-5555-555555555555', 'effective_date', (select d from pg_temp.today_ist), 'price', 50.0000),
      jsonb_build_object('instrument_id', '99999999-9999-9999-9999-999999999999', 'effective_date', (select d from pg_temp.today_ist), 'price', 50.0000)
    )
  )),
  1,
  'and counts the row referencing a nonexistent instrument as skipped, without aborting the whole batch'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select ok(
  pg_temp.throws_with_code(
    $$ select public.ingest_market_price_observations_batch('amfi', 'nav', 'INR', '[]'::jsonb) $$,
    '42501'
  ),
  'authenticated cannot call ingest_market_price_observations_batch directly (service_role only)'
);
reset role;

-- ---------------------------------------------------------------------
-- D. Linking a Phase 7 asset to a market instrument.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_investment_asset('mutual_fund', 'Test Fund', 'INR', null, null, null, '100001', 4) $$,
  'user1 creates a mutual fund asset (unlinked so far)'
);
create temp table pg_temp.mf_asset as
  select id from public.investment_assets where user_id = '11111111-1111-1111-1111-111111111111' and display_name = 'Test Fund';
grant select on pg_temp.mf_asset to authenticated;

select lives_ok(
  $$ select public.link_investment_asset_to_market_instrument(
       (select id from pg_temp.mf_asset), 'a1111111-1111-1111-1111-111111111111', false
     ) $$,
  'user1 links their mutual fund asset to the AMFI market instrument'
);
select is(
  (select market_instrument_id from public.investment_assets where id = (select id from pg_temp.mf_asset)),
  'a1111111-1111-1111-1111-111111111111'::uuid,
  'the asset now carries the market_instrument_id'
);

-- A second, different scheme to test the remap-confirmation rule.
reset role;
insert into public.market_instruments (id, provider, provider_instrument_id, name, instrument_kind)
values ('a3333333-3333-3333-3333-333333333333', 'amfi', '100003', 'Another Test Fund', 'mutual_fund');
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    format(
      $q$ select public.link_investment_asset_to_market_instrument('%s', 'a3333333-3333-3333-3333-333333333333', false) $q$,
      (select id from pg_temp.mf_asset)
    ),
    '25000'
  ),
  'relinking an already-linked asset without confirmation is rejected'
);
select lives_ok(
  $$ select public.link_investment_asset_to_market_instrument(
       (select id from pg_temp.mf_asset), 'a3333333-3333-3333-3333-333333333333', true
     ) $$,
  'relinking with explicit confirmation succeeds'
);
select is(
  (select market_instrument_id from public.investment_assets where id = (select id from pg_temp.mf_asset)),
  'a3333333-3333-3333-3333-333333333333'::uuid,
  'the asset is now linked to the new instrument'
);
select ok(
  pg_temp.throws_with_code(
    format(
      $q$ select public.link_investment_asset_to_market_instrument('%s', 'a2222222-2222-2222-2222-222222222222', true) $q$,
      (select id from pg_temp.mf_asset)
    ),
    '23514'
  ),
  'linking a mutual_fund asset to a stock market instrument is rejected'
);

reset role;

-- Relink back to the originally-priced instrument (a1111111...) so
-- section E below can exercise the provider-price precedence path.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.link_investment_asset_to_market_instrument(
       (select id from pg_temp.mf_asset), 'a1111111-1111-1111-1111-111111111111', true
     ) $$,
  'user1 relinks back to the AMFI-priced instrument for the precedence tests below'
);
select lives_ok(
  $$ select public.create_investment_holding((select id from pg_temp.mf_asset), 'd1111111-1111-1111-1111-111111111111') $$,
  'user1 creates a holding for the linked mutual fund'
);
create temp table pg_temp.mf_holding as
  select h.id from public.investment_holdings h where h.investment_asset_id = (select id from pg_temp.mf_asset);
grant select on pg_temp.mf_holding to authenticated;

select lives_ok(
  $$ select public.record_investment_purchase(
       (select id from pg_temp.mf_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 100, 40, 'eeeeeee1-0000-0000-0000-000000000001'::uuid
     ) $$,
  'user1 buys 100 units of the linked fund @ 40 (cost basis 4000)'
);

reset role;

-- ---------------------------------------------------------------------
-- E. Valuation precedence: provider price > manual valuation > cost
--    basis, and a provider price never touches cost basis / ledger.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select valuation_source from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  'amfi',
  'with only a current provider price (no manual valuation yet), the provider price is used'
);
select is(
  (select current_value from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  (46.1234 * 100)::numeric(20, 4),
  'current_value is the provider NAV times the held quantity'
);
select is(
  (select cost_basis from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  4000.0000::numeric,
  'a provider price never changes cost basis'
);

select lives_ok(
  $$ select public.add_investment_valuation((select id from pg_temp.mf_holding), now(), 9999) $$,
  'user1 also adds a manual valuation of 9999 (deliberately different from the provider value)'
);
select is(
  (select valuation_source from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  'amfi',
  'the provider price still wins over a manual valuation when both exist (precedence rule)'
);
select is(
  (select current_value from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  (46.1234 * 100)::numeric(20, 4),
  'current_value is still the provider-derived value, not the manual 9999'
);

reset role;

-- A second, unlinked holding to prove the manual-then-cost-basis fallback
-- chain independently of any provider price.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_investment_asset('stock', 'Unlinked Stock', 'INR') $$,
  'user1 creates a stock asset with no market instrument link'
);
select lives_ok(
  $$ select public.create_investment_holding(
       (select id from public.investment_assets where user_id = '11111111-1111-1111-1111-111111111111' and display_name = 'Unlinked Stock'),
       'd1111111-1111-1111-1111-111111111111'
     ) $$,
  'user1 creates a holding for the unlinked stock'
);
create temp table pg_temp.unlinked_holding as
  select h.id from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  where a.display_name = 'Unlinked Stock' and h.user_id = '11111111-1111-1111-1111-111111111111';
grant select on pg_temp.unlinked_holding to authenticated;

select lives_ok(
  $$ select public.record_investment_purchase(
       (select id from pg_temp.unlinked_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 10, 1000, 'eeeeeee1-0000-0000-0000-000000000002'::uuid
     ) $$,
  'user1 buys 10 units of the unlinked stock @ 1000'
);
select is(
  (select valuation_source from public.investment_holding_summary() where holding_id = (select id from pg_temp.unlinked_holding)),
  'none',
  'with no provider link and no manual valuation, the source is none (cost-basis fallback)'
);
select is(
  (select has_valuation from public.investment_holding_summary() where holding_id = (select id from pg_temp.unlinked_holding)),
  false,
  'has_valuation is false for the cost-basis fallback — never presented as a real valuation'
);
select is(
  (select current_value from public.investment_holding_summary() where holding_id = (select id from pg_temp.unlinked_holding)),
  10000.0000::numeric,
  'current_value falls back to cost basis (10 * 1000) with no valuation at all'
);

select lives_ok(
  $$ select public.add_investment_valuation((select id from pg_temp.unlinked_holding), now(), 12000) $$,
  'user1 adds a manual valuation for the unlinked stock'
);
select is(
  (select valuation_source from public.investment_holding_summary() where holding_id = (select id from pg_temp.unlinked_holding)),
  'manual',
  'with no provider price available, the manual valuation is used'
);
select is(
  (select current_value from public.investment_holding_summary() where holding_id = (select id from pg_temp.unlinked_holding)),
  12000.0000::numeric,
  'current_value reflects the manual valuation'
);

reset role;

-- ---------------------------------------------------------------------
-- F. A provider price never mutates the ledger or investment activities.
-- ---------------------------------------------------------------------

create temp table pg_temp.ledger_count_before as
  select count(*)::int as n from public.ledger_transactions;
create temp table pg_temp.activity_count_before as
  select count(*)::int as n from public.investment_activities;

insert into public.market_prices (instrument_id, price_kind, effective_date, price, provider)
values ('a1111111-1111-1111-1111-111111111111', 'nav', (select d from pg_temp.today_ist) - 1, 44.0, 'amfi');

select is(
  (select count(*)::int from public.ledger_transactions),
  (select n from pg_temp.ledger_count_before),
  'inserting a new market price creates no ledger transaction'
);
select is(
  (select count(*)::int from public.investment_activities),
  (select n from pg_temp.activity_count_before),
  'inserting a new market price creates no investment activity'
);

-- ---------------------------------------------------------------------
-- G. Portfolio snapshot idempotency and net-worth double-counting.
-- ---------------------------------------------------------------------

select lives_ok(
  $$ select public.build_portfolio_snapshot('11111111-1111-1111-1111-111111111111'::uuid, (select d from pg_temp.today_ist)) $$,
  'build_portfolio_snapshot runs for user1 without error'
);
select is(
  (select count(*)::int from public.portfolio_value_snapshots
    where user_id = '11111111-1111-1111-1111-111111111111' and snapshot_date = (select d from pg_temp.today_ist)),
  1,
  'exactly one snapshot row exists for today after the first build'
);

create temp table pg_temp.snapshot_id_before as
  select id from public.portfolio_value_snapshots
    where user_id = '11111111-1111-1111-1111-111111111111' and snapshot_date = (select d from pg_temp.today_ist);

select lives_ok(
  $$ select public.build_portfolio_snapshot('11111111-1111-1111-1111-111111111111'::uuid, (select d from pg_temp.today_ist)) $$,
  'rebuilding the same day''s snapshot does not error'
);
select is(
  (select count(*)::int from public.portfolio_value_snapshots
    where user_id = '11111111-1111-1111-1111-111111111111' and snapshot_date = (select d from pg_temp.today_ist)),
  1,
  'rebuilding the same day''s snapshot still leaves exactly one row (upsert, not a duplicate)'
);
select is(
  (select id from public.portfolio_value_snapshots
    where user_id = '11111111-1111-1111-1111-111111111111' and snapshot_date = (select d from pg_temp.today_ist)),
  (select id from pg_temp.snapshot_id_before),
  'the rebuilt snapshot keeps the same row id (an update, not a new insert)'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(
  (select invested_cost from public.portfolio_value_snapshots
    where user_id = '11111111-1111-1111-1111-111111111111' and snapshot_date = (select d from pg_temp.today_ist)),
  (select coalesce(sum(cost_basis), 0) from public.investment_holding_summary() where status = 'active' and currency = 'INR'),
  'the snapshot''s invested_cost matches the live sum of active holdings'' cost basis exactly (no double counting)'
);
reset role;

-- ---------------------------------------------------------------------
-- H. Cross-user access.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select count(*)::int from public.portfolio_value_snapshots),
  0,
  'user2 cannot see any of user1''s portfolio snapshots'
);
select ok(
  pg_temp.throws_with_code(
    $$ select count(*) from public.market_data_sync_runs $$,
    '42501'
  ),
  'authenticated cannot read market_data_sync_runs at all (no SELECT grant — it is server-only operational data)'
);
select ok(
  (select count(*)::int from public.market_instruments) >= 2,
  'user2 CAN see the shared market_instruments catalogue (no user ownership, globally readable)'
);
select ok(
  (select count(*)::int from public.market_prices) >= 1,
  'user2 CAN see the shared market_prices history (no user ownership, globally readable)'
);
select ok(
  (select count(*)::int from public.market_data_provider_state) = 2,
  'user2 CAN see market_data_provider_state (amfi + twelve_data rows, no secret content)'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.market_instruments (provider, provider_instrument_id, name, instrument_kind)
       values ('amfi', '999999', 'Forged Instrument', 'mutual_fund') $$,
    '42501'
  ),
  'authenticated cannot insert directly into market_instruments (no INSERT grant)'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.market_prices (instrument_id, price_kind, effective_date, price, provider)
       values ('a1111111-1111-1111-1111-111111111111', 'nav', (select d from pg_temp.today_ist), 1, 'amfi') $$,
    '42501'
  ),
  'authenticated cannot insert directly into market_prices (cannot forge price provenance)'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.run_amfi_refresh() $$,
    '42501'
  ),
  'authenticated cannot invoke the global run_amfi_refresh processor'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.build_portfolio_snapshot('22222222-2222-2222-2222-222222222222'::uuid, null) $$,
    '42501'
  ),
  'authenticated cannot invoke build_portfolio_snapshot directly, even for their own user id'
);

reset role;

-- ---------------------------------------------------------------------
-- I. Self-scoped refresh: cooldown and bounded scope.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select queued from public.run_market_data_refresh_self()),
  true,
  'user2''s first self-scoped refresh request is queued (no prior cooldown)'
);
select is(
  (select queued from public.run_market_data_refresh_self()),
  false,
  'an immediate second self-scoped refresh request is rejected by the cooldown'
);
select ok(
  (select retry_after_seconds from public.run_market_data_refresh_self()) > 0,
  'the rejected request reports a positive retry_after_seconds'
);

reset role;

select is(
  (select count(*)::int from public.market_data_sync_runs where triggered_by_user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'exactly one sync run was recorded for user2''s self-scoped refresh despite three calls (the cooldown-rejected calls never insert a row)'
);

-- ---------------------------------------------------------------------
-- J. Archived holdings are excluded from stock-price refresh scope.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_investment_asset('stock', 'Archived Stock', 'INR') $$,
  'user1 creates a stock asset to archive'
);
create temp table pg_temp.archived_stock_asset as
  select id from public.investment_assets where user_id = '11111111-1111-1111-1111-111111111111' and display_name = 'Archived Stock';
grant select on pg_temp.archived_stock_asset to authenticated;

select lives_ok(
  $$ select public.link_investment_asset_to_market_instrument(
       (select id from pg_temp.archived_stock_asset), 'a2222222-2222-2222-2222-222222222222', false
     ) $$,
  'user1 links the archived-to-be stock asset to the seeded stock instrument'
);
select lives_ok(
  $$ select public.create_investment_holding((select id from pg_temp.archived_stock_asset), 'd1111111-1111-1111-1111-111111111111') $$,
  'user1 creates a holding for it'
);
create temp table pg_temp.archived_stock_holding as
  select h.id from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  where a.id = (select id from pg_temp.archived_stock_asset);
grant select on pg_temp.archived_stock_holding to authenticated;

select lives_ok(
  $$ select public.set_investment_holding_status((select id from pg_temp.archived_stock_holding), 'archived') $$,
  'user1 archives the holding'
);

reset role;

select is(
  (
    select exists (
      select 1
      from public.investment_holdings h
      join public.investment_assets a on a.id = h.investment_asset_id
      join public.market_instruments mi on mi.id = a.market_instrument_id
      where h.status = 'active' and mi.instrument_kind = 'stock' and mi.is_active = true
        and a.market_instrument_id = 'a2222222-2222-2222-2222-222222222222'
    )
  ),
  false,
  'the archived holding''s linked instrument is excluded from the active-stock refresh scope query process_stock_price_refresh_all uses'
);
