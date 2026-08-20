-- pgTAP tests for Phase 7: investment_assets/investment_holdings/
-- investment_activities/investment_valuations/fixed_income_details and
-- their posting/read RPCs, net worth, allocation, PPF/FD/RD lifecycle,
-- and RLS/privilege boundaries (see supabase/migrations/
-- 20260820174431_phase7_investments_networth.sql).

begin;

select plan(139);

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
--   bank2 = b9999999-9999-9999-9999-999999999999 (user2 asset, bank_savings)
--   inv2  = d9999999-9999-9999-9999-999999999999 (user2 asset, investment)
--   divcat1 = a2222222-2222-2222-2222-222222222222 (user1 income category)

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'pgtap-phase7-one@example.com', '{}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-2222-2222-222222222222', 'pgtap-phase7-two@example.com', '{}'::jsonb);

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'User1 Bank', 'asset', 'bank_savings', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'User1 Broker', 'asset', 'investment', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b9999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 'User2 Bank', 'asset', 'bank_savings', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('d9999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 'User2 Broker', 'asset', 'investment', 'INR');

insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'income', 'Test Dividend Income', 'test dividend income');
insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('e2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'expense', 'Test Broker Fee', 'test broker fee');

-- ---------------------------------------------------------------------
-- A. Schema: tables, RLS, key functions, no direct write grants.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'investment_assets'), 'public.investment_assets table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'investment_holdings'), 'public.investment_holdings table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'investment_activities'), 'public.investment_activities table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'investment_valuations'), 'public.investment_valuations table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'fixed_income_details'), 'public.fixed_income_details table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.investment_assets'::regclass), 'RLS enabled on investment_assets');
select ok((select relforcerowsecurity from pg_class where oid = 'public.investment_assets'::regclass), 'RLS forced on investment_assets');
select ok((select relrowsecurity from pg_class where oid = 'public.investment_holdings'::regclass), 'RLS enabled on investment_holdings');
select ok((select relforcerowsecurity from pg_class where oid = 'public.investment_holdings'::regclass), 'RLS forced on investment_holdings');
select ok((select relrowsecurity from pg_class where oid = 'public.investment_activities'::regclass), 'RLS enabled on investment_activities');
select ok((select relforcerowsecurity from pg_class where oid = 'public.investment_activities'::regclass), 'RLS forced on investment_activities');
select ok((select relrowsecurity from pg_class where oid = 'public.investment_valuations'::regclass), 'RLS enabled on investment_valuations');
select ok((select relforcerowsecurity from pg_class where oid = 'public.investment_valuations'::regclass), 'RLS forced on investment_valuations');
select ok((select relrowsecurity from pg_class where oid = 'public.fixed_income_details'::regclass), 'RLS enabled on fixed_income_details');
select ok((select relforcerowsecurity from pg_class where oid = 'public.fixed_income_details'::regclass), 'RLS forced on fixed_income_details');

select ok(exists (select 1 from pg_proc where proname = 'record_investment_purchase'), 'record_investment_purchase() exists');
select ok(exists (select 1 from pg_proc where proname = 'record_investment_sale'), 'record_investment_sale() exists');
select ok(exists (select 1 from pg_proc where proname = 'net_worth_summary'), 'net_worth_summary() exists');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('investment_assets', 'investment_holdings', 'investment_activities', 'investment_valuations', 'fixed_income_details')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated has no direct INSERT/UPDATE/DELETE grant on any Phase 7 table'
);

select is(
  (select count(*)::int from information_schema.role_routine_grants
    where routine_name = 'investment_holding_position' and grantee in ('anon', 'public')),
  0,
  'investment_holding_position() is not granted to anon/public'
);

-- ---------------------------------------------------------------------
-- B. Purchase, weighted-average cost after a second purchase, and net
--    worth avoiding double counting.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_investment_asset('stock', 'Test Stock A', 'INR', 'TESTA', 'NSE') $$,
  'user1 can create a stock asset'
);

create temp table pg_temp.stock_a_asset as
  select id from public.investment_assets where user_id = '11111111-1111-1111-1111-111111111111' and display_name = 'Test Stock A';
grant select on pg_temp.stock_a_asset to authenticated;

select lives_ok(
  $$ select public.create_investment_holding((select id from pg_temp.stock_a_asset), 'd1111111-1111-1111-1111-111111111111') $$,
  'user1 can create a holding for the stock asset, linked to their investment account'
);

create temp table pg_temp.stock_a_holding as
  select h.id from public.investment_holdings h
  where h.investment_asset_id = (select id from pg_temp.stock_a_asset);
grant select on pg_temp.stock_a_holding to authenticated;

select lives_ok(
  $$ select public.record_investment_purchase(
       (select id from pg_temp.stock_a_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 10, 100, 'aaaaaaa1-0000-0000-0000-000000000001'::uuid, 10
     ) $$,
  'user1 records a first purchase: 10 units @ 100, fee 10'
);

select is(
  (select display_balance from public.account_balances where account_id = 'd1111111-1111-1111-1111-111111111111'),
  1010.0000::numeric,
  'investment account balance reflects the first purchase cost basis (1000 + 10 fee)'
);
select is(
  (select display_balance from public.account_balances where account_id = 'b1111111-1111-1111-1111-111111111111'),
  -1010.0000::numeric,
  'funding bank account is debited by the same amount (still a balanced two-account movement)'
);
select is(
  (select quantity from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  10::numeric,
  'position quantity is 10 after the first purchase'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  1010.0000::numeric,
  'position cost basis is 1010 (fee included) after the first purchase'
);

select lives_ok(
  $$ select public.record_investment_purchase(
       (select id from pg_temp.stock_a_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 10, 200, 'aaaaaaa1-0000-0000-0000-000000000002'::uuid, 0
     ) $$,
  'user1 records a second purchase: 10 units @ 200, no fee'
);

select is(
  (select quantity from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  20::numeric,
  'position quantity is 20 after the second purchase'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  3010.0000::numeric,
  'position cost basis is 3010 (1010 + 2000) after the second purchase'
);
select is(
  (select round(cost_basis / quantity, 4) from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  150.5000::numeric,
  'weighted-average unit cost is 150.50 after both purchases'
);

-- Net worth: buying moves value from cash to investments but must not
-- change total_assets at all (no fake income/expense, no double count).
select is(
  (select total_assets from public.net_worth_summary() where currency = 'INR'),
  (
    select coalesce((select display_balance from public.account_balances where account_id = 'b1111111-1111-1111-1111-111111111111'), 0)
      + 3010.0000
  ),
  'total assets equal remaining cash plus invested cost basis (no double count, no fake income/expense) after two purchases'
);

reset role;

-- ---------------------------------------------------------------------
-- C. Sale: cost basis consumed via weighted average, realized gain,
--    "sale above available quantity" rejected.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.record_investment_sale(
       (select id from pg_temp.stock_a_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 5, 300, 'aaaaaaa1-0000-0000-0000-000000000003'::uuid
     ) $$,
  'user1 sells 5 of 20 units @ 300 (partial sale)'
);

select is(
  (select quantity from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  15::numeric,
  'position quantity is 15 after selling 5 of 20'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  2257.5000::numeric,
  'position cost basis is 2257.50 (3010 - weighted 752.50 consumed) after the partial sale'
);
select is(
  (select cost_basis_amount from public.investment_activities
    where holding_id = (select id from pg_temp.stock_a_holding) and activity_kind = 'sell'),
  752.5000::numeric,
  'the sell activity records exactly the weighted-average cost basis it consumed'
);
select is(
  (select realized_gain_amount from public.investment_activities
    where holding_id = (select id from pg_temp.stock_a_holding) and activity_kind = 'sell'),
  747.5000::numeric,
  'realized gain is 747.50 (1500 proceeds - 752.50 cost basis consumed)'
);
select is(
  (
    -- account_balances excludes system accounts (is_system = false), so
    -- the realized-gains system account's balance is read directly from
    -- ledger_entries here instead — its sign is deliberately the raw,
    -- un-flipped income convention (see entry-builder.ts), not the
    -- flipped/display convention account_balances applies to liabilities.
    select coalesce(sum(e.amount), 0) from public.ledger_entries e
    join public.accounts acc on acc.id = e.account_id
    where acc.user_id = '11111111-1111-1111-1111-111111111111' and acc.system_code = 'realized_investment_gains'
  ),
  -747.5000::numeric,
  'realized-gains system account is credited (negative raw balance = recognized income) by the realized gain'
);

select throws_ok(
  $$ select public.record_investment_sale(
       (select id from pg_temp.stock_a_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 999, 100, 'aaaaaaa1-0000-0000-0000-000000000004'::uuid
     ) $$,
  '23514',
  null,
  'selling more units than currently held is rejected'
);
select throws_ok(
  $$ select public.record_investment_sale(
       (select id from pg_temp.stock_a_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), -1, 100, 'aaaaaaa1-0000-0000-0000-000000000005'::uuid
     ) $$,
  '22023',
  null,
  'a negative sale quantity is rejected'
);
select throws_ok(
  $$ select public.record_investment_purchase(
       (select id from pg_temp.stock_a_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 0, 100, 'aaaaaaa1-0000-0000-0000-000000000006'::uuid
     ) $$,
  '22023',
  null,
  'a zero purchase quantity is rejected'
);

-- Full disposal: sell everything remaining (15 units), position returns
-- to exactly zero, not merely close to zero.
select lives_ok(
  $$ select public.record_investment_sale(
       (select id from pg_temp.stock_a_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 15, 250, 'aaaaaaa1-0000-0000-0000-000000000007'::uuid
     ) $$,
  'user1 sells the remaining 15 units (full disposal)'
);
select is(
  (select quantity from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  0::numeric,
  'position quantity is exactly 0 after full disposal'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  0.0000::numeric,
  'position cost basis is exactly 0 after full disposal'
);
select throws_ok(
  $$ select public.record_investment_sale(
       (select id from pg_temp.stock_a_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 1, 100, 'aaaaaaa1-0000-0000-0000-000000000008'::uuid
     ) $$,
  '23514',
  null,
  'a fully-disposed holding cannot be sold again'
);

reset role;

-- ---------------------------------------------------------------------
-- D. Contribution/withdrawal (PPF/FD/RD-style, no quantity), and
--    idempotent retry across all three record_* families.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_investment_asset('ppf', 'Test PPF', 'INR', null, null, null, null, 0) $$,
  'user1 creates a PPF asset'
);
create temp table pg_temp.ppf_asset as
  select id from public.investment_assets where user_id = '11111111-1111-1111-1111-111111111111' and display_name = 'Test PPF';
grant select on pg_temp.ppf_asset to authenticated;

select lives_ok(
  $$ select public.create_investment_holding((select id from pg_temp.ppf_asset), 'd1111111-1111-1111-1111-111111111111') $$,
  'user1 creates a holding for the PPF asset'
);
create temp table pg_temp.ppf_holding as
  select h.id from public.investment_holdings h where h.investment_asset_id = (select id from pg_temp.ppf_asset);
grant select on pg_temp.ppf_holding to authenticated;

-- A plain data-setup fixture row (this holding was built manually via
-- create_investment_asset/create_investment_holding above rather than
-- create_ppf_account, precisely so the contribution/withdrawal/fee/
-- adjustment/reversal assertions below aren't coupled to that combined
-- function) — inserted directly under the privileged role exactly like
-- every other fixture in this file.
reset role;
insert into public.fixed_income_details (user_id, holding_id, kind, start_date)
values ('11111111-1111-1111-1111-111111111111', (select id from pg_temp.ppf_holding), 'ppf', (select d from pg_temp.today_ist));
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.record_investment_contribution(
       (select id from pg_temp.ppf_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 50000, 'bbbbbbb1-0000-0000-0000-000000000001'::uuid
     ) $$,
  'user1 records a PPF contribution of 50000'
);
select is(
  (select transaction_type from public.ledger_transactions
    where id = (select ledger_transaction_id from public.investment_activities
      where holding_id = (select id from pg_temp.ppf_holding) and activity_kind = 'contribution')),
  'investment_contribution',
  'a PPF contribution posts as investment_contribution (an asset transfer), never as an expense'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.ppf_holding))),
  50000.0000::numeric,
  'PPF balance (cost basis) is 50000 after the contribution'
);

-- Idempotent retry: submitting the exact same idempotency key again must
-- return the original activity, not create a second one.
select is(
  (select count(*)::int from public.investment_activities
    where holding_id = (select id from pg_temp.ppf_holding) and activity_kind = 'contribution'),
  1,
  'exactly one contribution activity exists before the retry'
);
select lives_ok(
  $$ select public.record_investment_contribution(
       (select id from pg_temp.ppf_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 50000, 'bbbbbbb1-0000-0000-0000-000000000001'::uuid
     ) $$,
  'retrying the exact same PPF contribution (same idempotency key) does not error'
);
select is(
  (select count(*)::int from public.investment_activities
    where holding_id = (select id from pg_temp.ppf_holding) and activity_kind = 'contribution'),
  1,
  'the retried contribution did not create a duplicate activity'
);
select is(
  (select count(*)::int from public.ledger_transactions where source_reference = 'bbbbbbb1-0000-0000-0000-000000000001'),
  1,
  'the retried contribution did not create a duplicate ledger transaction'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.ppf_holding))),
  50000.0000::numeric,
  'PPF balance is still 50000 (not 100000) after the retried contribution'
);

select lives_ok(
  $$ select public.record_investment_withdrawal(
       (select id from pg_temp.ppf_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 10000, 'bbbbbbb1-0000-0000-0000-000000000002'::uuid
     ) $$,
  'user1 withdraws 10000 from the PPF balance'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.ppf_holding))),
  40000.0000::numeric,
  'PPF balance is 40000 after the withdrawal'
);
select throws_ok(
  $$ select public.record_investment_withdrawal(
       (select id from pg_temp.ppf_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 999999, 'bbbbbbb1-0000-0000-0000-000000000003'::uuid
     ) $$,
  '23514',
  null,
  'withdrawing more than the available balance is rejected'
);

reset role;

-- ---------------------------------------------------------------------
-- E. Dividend/interest: real income, via the existing income posting
--    path, always requiring an income-type category.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.record_investment_income(
       (select id from pg_temp.stock_a_holding), 'dividend', 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 250, 'a2222222-2222-2222-2222-222222222222'::uuid,
       'bbbbbbb1-0000-0000-0000-000000000004'::uuid
     ) $$,
  'user1 records a dividend of 250 with an income category'
);
select is(
  (select transaction_type from public.ledger_transactions
    where id = (select ledger_transaction_id from public.investment_activities
      where activity_kind = 'dividend' and holding_id = (select id from pg_temp.stock_a_holding))),
  'income',
  'a dividend posts through the existing income transaction_type'
);
select is(
  (select category_id from public.ledger_transactions
    where id = (select ledger_transaction_id from public.investment_activities
      where activity_kind = 'dividend' and holding_id = (select id from pg_temp.stock_a_holding))),
  'a2222222-2222-2222-2222-222222222222'::uuid,
  'the dividend transaction carries the chosen income category'
);
select throws_ok(
  $$ select public.record_investment_income(
       (select id from pg_temp.stock_a_holding), 'dividend', 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 100, 'e2222222-2222-2222-2222-222222222222'::uuid,
       'bbbbbbb1-0000-0000-0000-000000000005'::uuid
     ) $$,
  '23514',
  null,
  'an expense-type category is rejected for dividend income (existing income-category rule reused)'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.stock_a_holding))),
  0.0000::numeric,
  'dividend income never changes the holding''s cost basis (fully disposed, still zero)'
);

reset role;

-- ---------------------------------------------------------------------
-- F. Standalone fee: a real expense, never affects cost basis.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.record_investment_fee(
       (select id from pg_temp.ppf_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 50, 'bbbbbbb1-0000-0000-0000-000000000006'::uuid,
       'e2222222-2222-2222-2222-222222222222'::uuid
     ) $$,
  'user1 records a standalone fee of 50 against the PPF holding'
);
select is(
  (select transaction_type from public.ledger_transactions
    where id = (select ledger_transaction_id from public.investment_activities
      where activity_kind = 'fee' and holding_id = (select id from pg_temp.ppf_holding))),
  'expense',
  'a standalone fee posts through the existing expense transaction_type'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.ppf_holding))),
  40000.0000::numeric,
  'a standalone fee never changes the holding''s cost basis (still 40000)'
);

reset role;

-- ---------------------------------------------------------------------
-- G. Adjustment: audited correction, requires an explanation, no ledger
--    effect.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ select public.record_investment_adjustment(
       (select id from pg_temp.ppf_holding), (select d from pg_temp.today_ist), 'too short', null, 100
     ) $$,
  '22023',
  null,
  'an adjustment with too short an explanation is rejected'
);
select lives_ok(
  $$ select public.record_investment_adjustment(
       (select id from pg_temp.ppf_holding), (select d from pg_temp.today_ist),
       'Correcting a data-entry mistake from the initial import.', null, 100
     ) $$,
  'a properly-explained adjustment succeeds'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.ppf_holding))),
  40100.0000::numeric,
  'the adjustment changed cost basis by exactly the given delta (40000 + 100)'
);
select is(
  (select ledger_transaction_id from public.investment_activities
    where holding_id = (select id from pg_temp.ppf_holding) and activity_kind = 'adjustment'),
  null,
  'an adjustment never creates a ledger transaction'
);

reset role;

-- ---------------------------------------------------------------------
-- H. Reversal: restores the ledger and holding effect, preserves history.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create temp table pg_temp.fee_activity as
  select id, ledger_transaction_id from public.investment_activities
  where holding_id = (select id from pg_temp.ppf_holding) and activity_kind = 'fee';
grant select on pg_temp.fee_activity to authenticated;

select lives_ok(
  $$ select public.reverse_investment_activity((select id from pg_temp.fee_activity)) $$,
  'user1 reverses the standalone fee activity'
);
select is(
  (select status from public.investment_activities where id = (select id from pg_temp.fee_activity)),
  'reversed',
  'the original fee activity is marked reversed, not deleted'
);
select ok(
  (select count(*) from public.investment_activities where id = (select id from pg_temp.fee_activity)) = 1,
  'the original fee activity row still physically exists (never hard-deleted)'
);
select is(
  (select status from public.ledger_transactions where id = (select ledger_transaction_id from pg_temp.fee_activity)),
  'reversed',
  'reversing the activity also reverses its linked ledger transaction'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.ppf_holding))),
  40100.0000::numeric,
  'reversing a fee (which never touched cost basis) leaves the PPF cost basis unchanged'
);
select throws_ok(
  $$ select public.reverse_investment_activity((select id from pg_temp.fee_activity)) $$,
  '25000',
  null,
  'the same activity cannot be reversed twice'
);

reset role;

-- ---------------------------------------------------------------------
-- I. Manual valuations: history preserved, latest wins, labelled manual,
--    missing valuation shown as unavailable (never a fabricated zero).
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_investment_asset('mutual_fund', 'Test Mutual Fund', 'INR', null, null, null, 'TESTMF001', 4) $$,
  'user1 creates a mutual fund asset'
);
create temp table pg_temp.mf_asset as
  select id from public.investment_assets where user_id = '11111111-1111-1111-1111-111111111111' and display_name = 'Test Mutual Fund';
grant select on pg_temp.mf_asset to authenticated;
select lives_ok(
  $$ select public.create_investment_holding((select id from pg_temp.mf_asset), 'd1111111-1111-1111-1111-111111111111') $$,
  'user1 creates a holding for the mutual fund'
);
create temp table pg_temp.mf_holding as
  select h.id from public.investment_holdings h where h.investment_asset_id = (select id from pg_temp.mf_asset);
grant select on pg_temp.mf_holding to authenticated;

select is(
  (select has_valuation from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  false,
  'a fresh holding with no valuation reports has_valuation = false'
);
select is(
  (select unrealized_gain from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  null,
  'unrealized gain is null (not zero) when no valuation exists'
);

select lives_ok(
  $$ select public.record_investment_purchase(
       (select id from pg_temp.mf_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 100.1234, 50, 'ccccccc1-0000-0000-0000-000000000001'::uuid
     ) $$,
  'user1 buys 100.1234 units of the mutual fund @ 50 (decimal units)'
);
select is(
  (select quantity from public.investment_holding_position((select id from pg_temp.mf_holding))),
  100.1234::numeric,
  'decimal (non-integer) unit quantities are preserved exactly, as needed for mutual funds'
);

select lives_ok(
  $$ select public.add_investment_valuation(
       (select id from pg_temp.mf_holding), ((select d from pg_temp.today_ist) - 1)::timestamptz, 4800
     ) $$,
  'user1 adds an earlier (lower) manual valuation'
);
select lives_ok(
  $$ select public.add_investment_valuation(
       (select id from pg_temp.mf_holding), (select d from pg_temp.today_ist)::timestamptz, 5500
     ) $$,
  'user1 adds a later (higher) manual valuation'
);
select is(
  (select count(*)::int from public.investment_valuations where holding_id = (select id from pg_temp.mf_holding)),
  2,
  'both valuations are preserved — adding a new one never overwrites an earlier one'
);
select is(
  (select latest_valuation from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  5500.0000::numeric,
  'the most recent valuation (by valued_at) is what current value is based on'
);
select is(
  (select current_value from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  5500.0000::numeric,
  'current value uses the latest valuation once one exists'
);
select is(
  (select unrealized_gain from public.investment_holding_summary() where holding_id = (select id from pg_temp.mf_holding)),
  5500.0000 - 5006.1700,
  'unrealized gain is latest valuation minus cost basis (100.1234 * 50 = 5006.17)'
);
select is(
  (select source from public.investment_valuations where holding_id = (select id from pg_temp.mf_holding) limit 1),
  'manual',
  'every valuation is source = manual — never a live/market source'
);
select throws_ok(
  $$ update public.investment_valuations set total_value = 1 where holding_id = (select id from pg_temp.mf_holding) $$,
  '42501',
  null,
  'a valuation row cannot be updated directly by an authenticated client (no UPDATE grant)'
);

reset role;

-- ---------------------------------------------------------------------
-- J. Fixed deposit lifecycle: principal as a transfer (never an
--    expense), maturity posts principal + interest atomically, and the
--    same FD cannot mature twice.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_fixed_deposit(
       'Test FD', 'd1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
       100000, (select d from pg_temp.today_ist), (select d from pg_temp.today_ist) + 365,
       'ddddddd1-0000-0000-0000-000000000001'::uuid, 'Test Bank', 7.5
     ) $$,
  'user1 creates a fixed deposit with a 100000 principal'
);
create temp table pg_temp.fd_holding as
  select h.id from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  where a.display_name = 'Test FD' and h.user_id = '11111111-1111-1111-1111-111111111111';
grant select on pg_temp.fd_holding to authenticated;

select is(
  (select transaction_type from public.ledger_transactions
    where source_reference = 'ddddddd1-0000-0000-0000-000000000001'),
  'investment_contribution',
  'the FD principal posts as an asset transfer (investment_contribution), never as an expense'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.fd_holding))),
  100000.0000::numeric,
  'the FD holding''s cost basis equals its principal'
);
select is(
  (select status from public.fixed_income_details where holding_id = (select id from pg_temp.fd_holding)),
  'active',
  'a freshly-created FD is active'
);

select lives_ok(
  $$ select public.mature_fixed_deposit(
       (select id from pg_temp.fd_holding), 'b1111111-1111-1111-1111-111111111111',
       107500, (select d from pg_temp.today_ist) + 365, 'ddddddd1-0000-0000-0000-000000000002'::uuid
     ) $$,
  'user1 matures the FD, receiving 107500 (100000 principal + 7500 interest)'
);
select is(
  (select status from public.fixed_income_details where holding_id = (select id from pg_temp.fd_holding)),
  'matured',
  'the FD is now matured'
);
select is(
  (select actual_maturity_amount from public.fixed_income_details where holding_id = (select id from pg_temp.fd_holding)),
  107500.0000::numeric,
  'actual maturity amount is recorded exactly as received'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.fd_holding))),
  0.0000::numeric,
  'the FD holding''s cost basis is fully cleared out at maturity'
);
select is(
  (select gross_amount from public.investment_activities
    where holding_id = (select id from pg_temp.fd_holding) and activity_kind = 'maturity'),
  107500.0000::numeric,
  'the maturity activity records the full amount received'
);
select throws_ok(
  $$ select public.mature_fixed_deposit(
       (select id from pg_temp.fd_holding), 'b1111111-1111-1111-1111-111111111111',
       107500, (select d from pg_temp.today_ist) + 365, 'ddddddd1-0000-0000-0000-000000000003'::uuid
     ) $$,
  '25000',
  null,
  'the same fixed deposit cannot be matured a second time'
);

reset role;

-- ---------------------------------------------------------------------
-- K. Recurring deposit: reuses Phase 6 recurring infrastructure, an
--    auto_post installment posts one balanced transfer AND a matching
--    investment_activities contribution atomically, and re-processing
--    never double-posts.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_recurring_deposit(
       'Test RD', 'd1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
       1000, 'monthly', (select d from pg_temp.today_ist), (select d from pg_temp.today_ist) + 365,
       'Test Bank', 6.5, 12, 12500, 'auto_post'
     ) $$,
  'user1 creates a recurring deposit with an auto_post installment'
);
create temp table pg_temp.rd_holding as
  select h.id from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  where a.display_name = 'Test RD' and h.user_id = '11111111-1111-1111-1111-111111111111';
grant select on pg_temp.rd_holding to authenticated;

select is(
  (select ri.kind from public.recurring_items ri
    join public.fixed_income_details f on f.recurring_item_id = ri.id
    where f.holding_id = (select id from pg_temp.rd_holding)),
  'transfer',
  'the RD''s recurring item is a plain transfer kind — no second, competing recurrence engine'
);
select is(
  (select ri.investment_holding_id from public.recurring_items ri
    join public.fixed_income_details f on f.recurring_item_id = ri.id
    where f.holding_id = (select id from pg_temp.rd_holding)),
  (select id from pg_temp.rd_holding),
  'the recurring item is linked back to the RD holding'
);

create temp table pg_temp.rd_occ_count_before as
  select count(*)::int as n from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    join public.fixed_income_details f on f.recurring_item_id = ri.id
    where f.holding_id = (select id from pg_temp.rd_holding);

reset role;
select lives_ok(
  $$ select public.generate_recurring_occurrences('11111111-1111-1111-1111-111111111111', 60) $$,
  'generate_recurring_occurrences runs for the RD without error'
);
select lives_ok(
  $$ select public.process_due_recurring_occurrences('11111111-1111-1111-1111-111111111111') $$,
  'process_due_recurring_occurrences runs for the RD''s due installment without error'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.rd_holding))),
  1000.0000::numeric,
  'the auto-posted RD installment created a matching investment_activities contribution (cost basis = 1000)'
);
select is(
  (select count(*)::int from public.investment_activities
    where holding_id = (select id from pg_temp.rd_holding) and activity_kind = 'contribution'),
  1,
  'exactly one contribution activity exists for the RD''s first installment'
);
select is(
  (select o.status from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    join public.fixed_income_details f on f.recurring_item_id = ri.id
    where f.holding_id = (select id from pg_temp.rd_holding) and o.scheduled_date = (select d from pg_temp.today_ist)),
  'posted',
  'today''s RD occurrence is posted'
);

reset role;
-- Re-running processing (simulating a retry / a second Cron tick) must
-- never double-post the same installment.
select lives_ok(
  $$ select public.process_due_recurring_occurrences('11111111-1111-1111-1111-111111111111') $$,
  'reprocessing due occurrences again does not error'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.investment_activities
    where holding_id = (select id from pg_temp.rd_holding) and activity_kind = 'contribution'),
  1,
  'reprocessing did not create a second contribution activity for the same installment'
);
select is(
  (select cost_basis from public.investment_holding_position((select id from pg_temp.rd_holding))),
  1000.0000::numeric,
  'RD cost basis is still exactly 1000 (not 2000) after the reprocess'
);

reset role;

-- ---------------------------------------------------------------------
-- L. Cross-user rejections and RLS reads.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select count(*)::int from public.investment_assets),
  0,
  'user2 cannot see any of user1''s investment assets'
);
select is(
  (select count(*)::int from public.investment_holdings),
  0,
  'user2 cannot see any of user1''s investment holdings'
);
select is(
  (select count(*)::int from public.investment_activities),
  0,
  'user2 cannot see any of user1''s investment activities'
);
select is(
  (select count(*)::int from public.investment_valuations),
  0,
  'user2 cannot see any of user1''s investment valuations'
);
select is(
  (select count(*)::int from public.fixed_income_details),
  0,
  'user2 cannot see any of user1''s fixed income details'
);

select ok(
  pg_temp.throws_with_code(
    format(
      $q$ select public.record_investment_purchase('%s', 'b9999999-9999-9999-9999-999999999999', (select d from pg_temp.today_ist), 1, 100, 'eeeeeee1-0000-0000-0000-000000000001'::uuid) $q$,
      (select id from pg_temp.stock_a_holding)
    ),
    'P0002'
  ),
  'user2 cannot record a purchase against user1''s holding (cross-user holding rejected)'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$ select public.create_investment_asset('stock', 'User2 Stock', 'INR') $$,
  'user2 creates their own stock asset (fixture for the next checks)'
);
select lives_ok(
  $$ select public.create_investment_holding(
       (select id from public.investment_assets where user_id = '22222222-2222-2222-2222-222222222222' and display_name = 'User2 Stock'),
       'd9999999-9999-9999-9999-999999999999'
     ) $$,
  'user2 creates their own holding (fixture for the next checks)'
);
reset role;

create temp table pg_temp.user2_stock_holding2 as
  select h.id from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  where a.display_name = 'User2 Stock' and h.user_id = '22222222-2222-2222-2222-222222222222';
grant select on pg_temp.user2_stock_holding2 to authenticated;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    format(
      $q$ select public.record_investment_purchase('%s', 'b1111111-1111-1111-1111-111111111111', (select d from pg_temp.today_ist), 1, 100, 'eeeeeee1-0000-0000-0000-000000000002'::uuid) $q$,
      (select id from pg_temp.user2_stock_holding2)
    ),
    'P0002'
  ),
  'user1 cannot record a purchase against user2''s holding (cross-user holding rejected the other direction)'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.record_investment_purchase(
         (select id from pg_temp.stock_a_holding), 'b9999999-9999-9999-9999-999999999999',
         (select d from pg_temp.today_ist), 1, 100, 'eeeeeee1-0000-0000-0000-000000000003'::uuid
       ) $$,
    'P0002'
  ),
  'user1 cannot fund a purchase from user2''s bank account (cross-user account rejected)'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.add_investment_valuation((select id from pg_temp.user2_stock_holding2), now(), 100) $$,
    'P0002'
  ),
  'user1 cannot attach a valuation to user2''s holding'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.mature_fixed_deposit(
         (select id from pg_temp.user2_stock_holding2), 'b1111111-1111-1111-1111-111111111111',
         100, (select d from pg_temp.today_ist), 'eeeeeee1-0000-0000-0000-000000000004'::uuid
       ) $$,
    'P0002'
  ),
  'user1 cannot mature/close a holding that is not their own fixed-income holding'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.set_investment_holding_status((select id from pg_temp.user2_stock_holding2), 'archived') $$,
    'P0002'
  ),
  'user1 cannot archive user2''s holding'
);

reset role;

-- Archived holdings cannot receive new activities.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.set_investment_holding_status((select id from pg_temp.mf_holding), 'archived') $$,
  'user1 archives their mutual fund holding'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.record_investment_purchase(
         (select id from pg_temp.mf_holding), 'b1111111-1111-1111-1111-111111111111',
         (select d from pg_temp.today_ist), 1, 100, 'eeeeeee1-0000-0000-0000-000000000005'::uuid
       ) $$,
    '25000'
  ),
  'an archived holding cannot receive a new purchase activity'
);

reset role;

-- ---------------------------------------------------------------------
-- M. PPF financial-year contribution summary.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select total_contributions from public.ppf_financial_year_summary('2000-04-01'::date)
    where holding_id = (select id from pg_temp.ppf_holding)),
  0.0000::numeric,
  'a financial year with no contributions reports exactly zero, not null'
);

create temp table pg_temp.ppf_fy_start as
  select case when extract(month from (select d from pg_temp.today_ist)) >= 4
    then make_date(extract(year from (select d from pg_temp.today_ist))::int, 4, 1)
    else make_date(extract(year from (select d from pg_temp.today_ist))::int - 1, 4, 1)
  end as d;
grant select on pg_temp.ppf_fy_start to authenticated;

select is(
  (select total_contributions from public.ppf_financial_year_summary((select d from pg_temp.ppf_fy_start))
    where holding_id = (select id from pg_temp.ppf_holding)),
  50000.0000::numeric,
  'the current financial year correctly aggregates the one contribution activity recorded for the PPF holding'
);

reset role;

-- ---------------------------------------------------------------------
-- N. Allocation and net worth: missing-valuation flagged, currency
--    grouping, credit-card outstanding reduces net worth.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- stock_a_holding (fully disposed, cost basis 0) and mf_holding (archived,
-- valued at 5500) both have no *currently missing* market valuation
-- warning expected from stock_a_holding (zero position, nothing to warn
-- about) — a fresh, never-valued, active stock/MF/other_investment
-- holding is what should count. Create one to prove the warning fires.
select lives_ok(
  $$ select public.create_investment_asset('stock', 'Test Stock B (unvalued)', 'INR') $$,
  'user1 creates a second stock asset with no valuation'
);
select lives_ok(
  $$ select public.create_investment_holding(
       (select id from public.investment_assets where user_id = '11111111-1111-1111-1111-111111111111' and display_name = 'Test Stock B (unvalued)'),
       'd1111111-1111-1111-1111-111111111111'
     ) $$,
  'user1 creates a holding for the unvalued stock'
);
create temp table pg_temp.stock_b_holding as
  select h.id from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  where a.display_name = 'Test Stock B (unvalued)' and h.user_id = '11111111-1111-1111-1111-111111111111';
grant select on pg_temp.stock_b_holding to authenticated;

select lives_ok(
  $$ select public.record_investment_purchase(
       (select id from pg_temp.stock_b_holding), 'b1111111-1111-1111-1111-111111111111',
       (select d from pg_temp.today_ist), 5, 1000, 'fffffff1-0000-0000-0000-000000000001'::uuid
     ) $$,
  'user1 buys 5 units of the unvalued stock @ 1000'
);

select ok(
  (select missing_valuation_count from public.portfolio_summary() where currency = 'INR') >= 1,
  'portfolio_summary flags at least one active, market-linked holding with a missing valuation'
);
select is(
  (select has_valuation from public.investment_holding_summary() where holding_id = (select id from pg_temp.stock_b_holding)),
  false,
  'the new stock holding itself is flagged as having no valuation'
);

select ok(
  exists (select 1 from public.asset_allocation_by_kind() where currency = 'INR' and asset_kind = 'stock'),
  'asset_allocation_by_kind includes a row for the stock kind'
);
select ok(
  (select round(sum(percent_of_portfolio), 2) from public.asset_allocation_by_kind() where currency = 'INR') between 99.98 and 100.02,
  'allocation percentages for one currency sum to (approximately) 100'
);
select ok(
  exists (select 1 from public.asset_allocation_by_asset() where currency = 'INR' and display_name = 'Test Stock B (unvalued)'),
  'asset_allocation_by_asset includes a row for the individual asset'
);

reset role;

-- Credit-card outstanding must reduce net worth. The fixture account is
-- inserted directly (privileged role) exactly like the Phase 6 test
-- file's own card1 fixture — a plain data-setup insert, not a claim about
-- how the app itself creates accounts (it always uses
-- create_account_with_opening_balance).
insert into public.accounts (id, user_id, name, account_class, account_type, currency, credit_limit)
values ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'User1 Card', 'liability', 'credit_card', 'INR', 50000);
insert into public.ledger_transactions (id, user_id, transaction_type, occurred_at, description, source_type)
values ('c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'credit_card_purchase', now(), 'Test card purchase', 'manual');
insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency)
values
  ('11111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 2000, 'INR'),
  ('11111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', -2000, 'INR');

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select credit_card_outstanding from public.net_worth_summary() where currency = 'INR'),
  2000.0000::numeric,
  'net_worth_summary reports the credit card outstanding as 2000'
);
select is(
  (select total_assets - total_liabilities from public.net_worth_summary() where currency = 'INR'),
  (select net_worth from public.net_worth_summary() where currency = 'INR'),
  'net worth is always exactly total assets minus total liabilities'
);
select ok(
  (select total_liabilities from public.net_worth_summary() where currency = 'INR') >= 2000,
  'the credit card outstanding is included in total liabilities (reduces net worth)'
);

reset role;
