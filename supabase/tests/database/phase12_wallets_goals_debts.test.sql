-- pgTAP tests for Phase 12: purpose wallets, income allocation plans,
-- safe-to-spend, financial goals (incl. emergency/sinking funds), and
-- debts/EMI (see supabase/migrations/20260826120000_phase12_purpose_
-- wallets.sql and 20260826130000_phase12_goals_debts_forecast.sql).

begin;

select plan(141);

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
--   user1  = 77777777-7777-7777-7777-777777777777
--   user2  = 88888888-8888-8888-8888-888888888888
--   bank1  = e1111111-1111-1111-1111-111111111111 (user1, bank_savings)
--   bank1b = e1111111-1111-1111-1111-111111111112 (user1, bank_savings, second)
--   loan1  = e1111111-1111-1111-1111-111111111113 (user1, loan liability)
--   bank2  = e2222222-2222-2222-2222-222222222222 (user2, bank_savings)

insert into auth.users (id, email, raw_user_meta_data)
values ('77777777-7777-7777-7777-777777777777', 'pgtap-phase12-one@example.com', '{}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('88888888-8888-8888-8888-888888888888', 'pgtap-phase12-two@example.com', '{}'::jsonb);

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('e1111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'User1 Bank', 'asset', 'bank_savings', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('e1111111-1111-1111-1111-111111111112', '77777777-7777-7777-7777-777777777777', 'User1 Second Bank', 'asset', 'bank_savings', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('e1111111-1111-1111-1111-111111111113', '77777777-7777-7777-7777-777777777777', 'User1 Loan', 'liability', 'loan', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('e2222222-2222-2222-2222-222222222222', '88888888-8888-8888-8888-888888888888', 'User2 Bank', 'asset', 'bank_savings', 'INR');

-- Give user1's bank account a real opening balance (₹100,000) so eligible
-- liquid balance / allocation-ceiling tests have real money to work with.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';
select public.create_manual_transaction(
  'income', now(), 'Opening funds', jsonb_build_array(
    jsonb_build_object('account_id', 'e1111111-1111-1111-1111-111111111111', 'amount', '100000.0000'),
    jsonb_build_object('account_id', (select id from public.accounts where user_id = '77777777-7777-7777-7777-777777777777' and is_system and system_code = 'uncategorized_income'), 'amount', '-100000.0000')
  )
);
reset role;

-- ---------------------------------------------------------------------
-- A. Schema: tables, RLS, minimum grants.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = t), 'public.' || t || ' table exists')
from unnest(array[
  'purpose_wallets', 'purpose_wallet_movements', 'transaction_purpose_allocations',
  'income_allocation_plans', 'income_allocation_plan_lines', 'income_allocation_applications',
  'financial_goals', 'goal_account_links', 'goal_milestones', 'goal_contributions',
  'debts', 'debt_rate_history', 'debt_payment_schedules', 'debt_payments'
]) as t;

select ok((select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), 'RLS enabled on ' || t)
from unnest(array[
  'purpose_wallets', 'purpose_wallet_movements', 'transaction_purpose_allocations',
  'income_allocation_plans', 'income_allocation_plan_lines', 'income_allocation_applications',
  'financial_goals', 'goal_account_links', 'goal_milestones', 'goal_contributions',
  'debts', 'debt_rate_history', 'debt_payment_schedules', 'debt_payments'
]) as t;
select ok((select relforcerowsecurity from pg_class where oid = ('public.' || t)::regclass), 'RLS forced on ' || t)
from unnest(array[
  'purpose_wallets', 'purpose_wallet_movements', 'transaction_purpose_allocations',
  'income_allocation_plans', 'income_allocation_plan_lines', 'income_allocation_applications',
  'financial_goals', 'goal_account_links', 'goal_milestones', 'goal_contributions',
  'debts', 'debt_rate_history', 'debt_payment_schedules', 'debt_payments'
]) as t;

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'purpose_wallets', 'purpose_wallet_movements', 'transaction_purpose_allocations',
        'income_allocation_plans', 'income_allocation_plan_lines', 'income_allocation_applications',
        'financial_goals', 'goal_account_links', 'goal_milestones', 'goal_contributions',
        'debts', 'debt_rate_history', 'debt_payment_schedules', 'debt_payments'
      )
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated has no direct write grant on any Phase 12 table (every write is RPC-mediated)'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'purpose_wallets', 'purpose_wallet_movements', 'transaction_purpose_allocations',
        'income_allocation_plans', 'income_allocation_plan_lines', 'income_allocation_applications',
        'financial_goals', 'goal_account_links', 'goal_milestones', 'goal_contributions',
        'debts', 'debt_rate_history', 'debt_payment_schedules', 'debt_payments'
      )
      and grantee in ('anon', 'public')),
  0,
  'anon/public have zero grants on any Phase 12 table'
);

-- ---------------------------------------------------------------------
-- B. Purpose wallets.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_purpose_wallet('Travel', 'INR', null, null, null, 0, 20000) $$,
  'user1 can create a purpose wallet'
);
create temp table pg_temp.travel_wallet as select id from public.purpose_wallets where user_id = '77777777-7777-7777-7777-777777777777' and name = 'Travel';
grant select on pg_temp.travel_wallet to authenticated;

select lives_ok(
  $$ select public.create_purpose_wallet('Emergency', 'INR', null, null, null, 0, 50000) $$,
  'user1 can create a second purpose wallet'
);
create temp table pg_temp.emergency_wallet as select id from public.purpose_wallets where user_id = '77777777-7777-7777-7777-777777777777' and name = 'Emergency';
grant select on pg_temp.emergency_wallet to authenticated;

select is(
  (select status from public.purpose_wallets where id = (select id from pg_temp.travel_wallet)),
  'active',
  'a new wallet starts active'
);

select lives_ok(
  format($$ select public.allocate_to_purpose_wallet(%L, 10000) $$, (select id from pg_temp.travel_wallet)),
  'user1 can earmark money into the Travel wallet'
);
select is(
  (select allocated_balance from public.get_purpose_wallet_summary() where wallet_id = (select id from pg_temp.travel_wallet)),
  10000.0000,
  'the wallet''s allocated balance is 10000 after one allocation'
);

select ok(
  pg_temp.throws_with_code(
    format($$ select public.allocate_to_purpose_wallet(%L, 999999) $$, (select id from pg_temp.emergency_wallet)),
    '22023'
  ),
  'allocating more than the eligible liquid balance is rejected'
);

select ok(
  (select count(*)::int from public.ledger_transactions where user_id = '77777777-7777-7777-7777-777777777777' and description ilike '%travel%') = 0,
  'allocating to a purpose wallet creates no ledger transaction'
);

select lives_ok(
  format($$ select public.reallocate_purpose_wallet(%L, %L, 3000) $$, (select id from pg_temp.travel_wallet), (select id from pg_temp.emergency_wallet)),
  'user1 can reallocate between two of their own wallets'
);
select is(
  (select allocated_balance from public.get_purpose_wallet_summary() where wallet_id = (select id from pg_temp.travel_wallet)),
  7000.0000,
  'Travel wallet decreased by the reallocated amount'
);
select is(
  (select allocated_balance from public.get_purpose_wallet_summary() where wallet_id = (select id from pg_temp.emergency_wallet)),
  3000.0000,
  'Emergency wallet increased by the reallocated amount'
);

select is(
  (select count(*)::int from public.ledger_transactions t
    join public.ledger_entries e on e.transaction_id = t.id
    where t.user_id = '77777777-7777-7777-7777-777777777777' and t.created_at > now() - interval '1 minute'
      and t.description ilike '%reallocat%'),
  0,
  'reallocation between wallets creates no ledger transaction at all'
);

select ok(
  pg_temp.throws_with_code(
    format($$ select public.reallocate_purpose_wallet(%L, %L, 999999) $$, (select id from pg_temp.travel_wallet), (select id from pg_temp.emergency_wallet)),
    '22023'
  ),
  'reallocating more than the source wallet holds is rejected'
);

-- Expense assignment consumes the wallet exactly once.
select lives_ok(
  $$ select public.create_manual_transaction(
    'expense', now(), 'Flight tickets', jsonb_build_array(
      jsonb_build_object('account_id', (select id from public.accounts where user_id = '77777777-7777-7777-7777-777777777777' and is_system and system_code = 'uncategorized_expense'), 'amount', '2000.0000'),
      jsonb_build_object('account_id', 'e1111111-1111-1111-1111-111111111111', 'amount', '-2000.0000')
    )
  ) $$,
  'user1 posts an expense transaction to assign to the Travel wallet'
);
create temp table pg_temp.flight_txn as select id from public.ledger_transactions where user_id = '77777777-7777-7777-7777-777777777777' and description = 'Flight tickets';
grant select on pg_temp.flight_txn to authenticated;

select lives_ok(
  format($$ select public.assign_transaction_to_purpose_wallet(%L, %L) $$, (select id from pg_temp.flight_txn), (select id from pg_temp.travel_wallet)),
  'user1 assigns the expense to the Travel wallet'
);
select is(
  (select allocated_balance from public.get_purpose_wallet_summary() where wallet_id = (select id from pg_temp.travel_wallet)),
  5000.0000,
  'the wallet''s allocated balance decreased by the spent amount'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.assign_transaction_to_purpose_wallet(%L, %L) $$, (select id from pg_temp.flight_txn), (select id from pg_temp.emergency_wallet)),
    '22023'
  ),
  'the same transaction cannot be assigned to a wallet twice'
);

-- Reversing the expense restores the wallet.
select lives_ok(
  format($$ select public.reverse_transaction(%L) $$, (select id from pg_temp.flight_txn)),
  'user1 reverses the flight-tickets expense'
);
select is(
  (select allocated_balance from public.get_purpose_wallet_summary() where wallet_id = (select id from pg_temp.travel_wallet)),
  7000.0000,
  'reversing the expense automatically restores the wallet''s allocated balance'
);

-- Credit-card purchase consumes a wallet; the matching credit-card
-- payment must not consume it a second time.
create temp table pg_temp.cc_account as select id from public.accounts where user_id = '77777777-7777-7777-7777-777777777777' limit 0;
insert into public.accounts (id, user_id, name, account_class, account_type, currency, credit_limit)
values ('e1111111-1111-1111-1111-111111111114', '77777777-7777-7777-7777-777777777777', 'User1 Credit Card', 'liability', 'credit_card', 'INR', 50000);

select lives_ok(
  $$ select public.create_manual_transaction(
    'credit_card_purchase', now(), 'CC travel purchase', jsonb_build_array(
      jsonb_build_object('account_id', (select id from public.accounts where user_id = '77777777-7777-7777-7777-777777777777' and is_system and system_code = 'uncategorized_expense'), 'amount', '1500.0000'),
      jsonb_build_object('account_id', 'e1111111-1111-1111-1111-111111111114', 'amount', '-1500.0000')
    )
  ) $$,
  'user1 posts a credit-card purchase'
);
create temp table pg_temp.cc_purchase_txn as select id from public.ledger_transactions where user_id = '77777777-7777-7777-7777-777777777777' and description = 'CC travel purchase';
grant select on pg_temp.cc_purchase_txn to authenticated;
select lives_ok(
  format($$ select public.assign_transaction_to_purpose_wallet(%L, %L) $$, (select id from pg_temp.cc_purchase_txn), (select id from pg_temp.travel_wallet)),
  'the credit-card purchase can be assigned to the Travel wallet'
);
select is(
  (select allocated_balance from public.get_purpose_wallet_summary() where wallet_id = (select id from pg_temp.travel_wallet)),
  5500.0000,
  'the wallet decreased once for the credit-card purchase'
);

select lives_ok(
  $$ select public.create_manual_transaction(
    'credit_card_payment', now(), 'CC payment', jsonb_build_array(
      jsonb_build_object('account_id', 'e1111111-1111-1111-1111-111111111114', 'amount', '1500.0000'),
      jsonb_build_object('account_id', 'e1111111-1111-1111-1111-111111111111', 'amount', '-1500.0000')
    )
  ) $$,
  'user1 pays off the credit card'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.assign_transaction_to_purpose_wallet(
      (select id from public.ledger_transactions where description = 'CC payment' and user_id = '77777777-7777-7777-7777-777777777777'),
      (select id from pg_temp.travel_wallet)
    ) $$,
    '22023'
  ),
  'a credit-card payment (as opposed to a purchase) cannot be assigned to a wallet at all -- it is not an expense'
);
select is(
  (select allocated_balance from public.get_purpose_wallet_summary() where wallet_id = (select id from pg_temp.travel_wallet)),
  5500.0000,
  'the credit-card payment never consumed the wallet a second time'
);

-- Archived wallet cannot receive new allocation.
select lives_ok(
  $$ select public.create_purpose_wallet('Temp', 'INR') $$,
  'user1 creates a throwaway wallet to archive'
);
create temp table pg_temp.temp_wallet as select id from public.purpose_wallets where user_id = '77777777-7777-7777-7777-777777777777' and name = 'Temp';
grant select on pg_temp.temp_wallet to authenticated;
select lives_ok(
  format($$ select public.set_purpose_wallet_archived(%L, true) $$, (select id from pg_temp.temp_wallet)),
  'user1 archives the wallet'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.allocate_to_purpose_wallet(%L, 100) $$, (select id from pg_temp.temp_wallet)),
    '22023'
  ),
  'allocating to an archived wallet is rejected'
);

reset role;

-- Cross-user isolation on wallets.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "88888888-8888-8888-8888-888888888888", "role": "authenticated"}';

select is(
  (select count(*)::int from public.purpose_wallets where id = (select id from pg_temp.travel_wallet)),
  0,
  'user2 cannot see user1''s wallet through RLS'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.allocate_to_purpose_wallet(%L, 100) $$, (select id from pg_temp.travel_wallet)),
    '42501'
  ),
  'user2 cannot allocate to user1''s wallet'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.reallocate_purpose_wallet(%L, %L, 100) $$, (select id from pg_temp.travel_wallet), (select id from pg_temp.emergency_wallet)),
    '42501'
  ),
  'user2 cannot reallocate user1''s wallets'
);

reset role;

-- ---------------------------------------------------------------------
-- C. Income allocation plans.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    format(
      $$ select public.save_income_allocation_plan('Bad plan', 'percentage', current_date, %L::jsonb) $$,
      format('[{"wallet_id": "%s", "percentage": 60}, {"wallet_id": "%s", "percentage": 30}]', (select id from pg_temp.travel_wallet), (select id from pg_temp.emergency_wallet))
    ),
    '22023'
  ),
  'a percentage plan whose lines do not total 100%% is rejected'
);

select lives_ok(
  format(
    $$ select public.save_income_allocation_plan('Salary split', 'percentage', current_date, %L::jsonb) $$,
    format('[{"wallet_id": "%s", "percentage": 60}, {"wallet_id": "%s", "percentage": 40}]', (select id from pg_temp.travel_wallet), (select id from pg_temp.emergency_wallet))
  ),
  'a percentage plan totaling exactly 100%% is accepted'
);
create temp table pg_temp.salary_plan as select id from public.income_allocation_plans where user_id = '77777777-7777-7777-7777-777777777777' and name = 'Salary split';
grant select on pg_temp.salary_plan to authenticated;

select lives_ok(
  $$ select public.create_manual_transaction(
    'income', now(), 'Monthly salary', jsonb_build_array(
      jsonb_build_object('account_id', 'e1111111-1111-1111-1111-111111111111', 'amount', '10000.0000'),
      jsonb_build_object('account_id', (select id from public.accounts where user_id = '77777777-7777-7777-7777-777777777777' and is_system and system_code = 'uncategorized_income'), 'amount', '-10000.0000')
    )
  ) $$,
  'user1 posts a salary income transaction'
);
create temp table pg_temp.salary_txn as select id from public.ledger_transactions where user_id = '77777777-7777-7777-7777-777777777777' and description = 'Monthly salary';
grant select on pg_temp.salary_txn to authenticated;

select lives_ok(
  format($$ select public.apply_income_allocation_plan_to_transaction(%L, %L) $$, (select id from pg_temp.salary_plan), (select id from pg_temp.salary_txn)),
  'user1 applies the salary-split plan to the income transaction'
);
select is(
  (select allocated_total from public.income_allocation_applications where plan_id = (select id from pg_temp.salary_plan) and transaction_id = (select id from pg_temp.salary_txn)),
  10000.0000,
  'the full income amount was allocated (60%% + 40%% = 100%%)'
);
select is(
  (select unallocated_remainder from public.income_allocation_applications where plan_id = (select id from pg_temp.salary_plan) and transaction_id = (select id from pg_temp.salary_txn)),
  0.0000,
  'nothing is left unallocated for a 100%% plan'
);
select is(
  (select allocated_balance from public.get_purpose_wallet_summary() where wallet_id = (select id from pg_temp.travel_wallet)),
  11500.0000,
  'Travel wallet received its 60%% share (6000) on top of its prior 5500 balance'
);

select ok(
  pg_temp.throws_with_code(
    format($$ select public.apply_income_allocation_plan_to_transaction(%L, %L) $$, (select id from pg_temp.salary_plan), (select id from pg_temp.salary_txn)),
    '23505'
  ),
  'applying the same plan to the same transaction twice is rejected (idempotency unique constraint)'
);

-- Reversing the income transaction reverses the allocation.
select lives_ok(
  format($$ select public.reverse_transaction(%L) $$, (select id from pg_temp.salary_txn)),
  'user1 reverses the salary transaction'
);
select is(
  (select status from public.income_allocation_applications where plan_id = (select id from pg_temp.salary_plan) and transaction_id = (select id from pg_temp.salary_txn)),
  'reversed',
  'reversing the income transaction automatically reverses its allocation application'
);
select is(
  (select allocated_balance from public.get_purpose_wallet_summary() where wallet_id = (select id from pg_temp.travel_wallet)),
  5500.0000,
  'Travel wallet''s balance returns to its pre-allocation amount after the income reversal'
);

reset role;

-- ---------------------------------------------------------------------
-- D. Safe-to-spend.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select lives_ok(
  $$ select * from public.get_safe_to_spend_summary('INR') $$,
  'get_safe_to_spend_summary runs for the caller'
);
select ok(
  (select safe_to_spend from public.get_safe_to_spend_summary('INR')) >= 0,
  'safe_to_spend is never negative'
);

reset role;

-- ---------------------------------------------------------------------
-- E. Financial goals.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_financial_goal('New laptop', 'major_purchase', 60000, 'INR', current_date + 180) $$,
  'user1 creates a goal'
);
create temp table pg_temp.laptop_goal as select id from public.financial_goals where user_id = '77777777-7777-7777-7777-777777777777' and name = 'New laptop';
grant select on pg_temp.laptop_goal to authenticated;

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_financial_goal('Bad goal', 'custom', -100, 'INR') $$,
    '23514'
  ),
  'a non-positive target amount is rejected'
);

select lives_ok(
  format(
    $$ select public.record_goal_contribution_allocation(%L, 5000, 'contribution', 'goal-contrib-1') $$,
    (select id from pg_temp.laptop_goal)
  ),
  'user1 records an allocation-only contribution to the goal'
);
select is(
  (select count(*)::int from public.ledger_transactions where user_id = '77777777-7777-7777-7777-777777777777' and description ilike '%laptop%'),
  0,
  'an allocation-only contribution creates no ledger transaction'
);

select lives_ok(
  format(
    $$ select public.record_goal_contribution_allocation(%L, 5000, 'contribution', 'goal-contrib-1') $$,
    (select id from pg_temp.laptop_goal)
  ),
  'retrying the same idempotency key returns the existing contribution rather than duplicating it'
);
select is(
  (select count(*)::int from public.goal_contributions where goal_id = (select id from pg_temp.laptop_goal)),
  1,
  'exactly one contribution row exists after the idempotent retry'
);

-- Account-transfer contribution: one balanced transaction, linked once.
select lives_ok(
  format(
    $$ select public.record_goal_contribution_transfer(%L, 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111112', 8000, now(), 'goal-contrib-transfer-1') $$,
    (select id from pg_temp.laptop_goal)
  ),
  'user1 records an account-transfer contribution to the goal'
);
select is(
  (select count(*)::int from public.ledger_transactions where user_id = '77777777-7777-7777-7777-777777777777' and description ilike '%laptop%'),
  1,
  'an account-transfer contribution creates exactly one ledger transaction'
);
select is(
  (select sum(amount) from public.ledger_entries where transaction_id = (select related_transaction_id from public.goal_contributions where idempotency_key = 'goal-contrib-transfer-1')),
  0::numeric,
  'the transfer transaction is balanced'
);

select lives_ok(
  format(
    $$ select public.record_goal_contribution_transfer(%L, 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111112', 1, now(), 'goal-contrib-transfer-1') $$,
    (select id from pg_temp.laptop_goal)
  ),
  'retrying the same transfer idempotency key does not raise'
);
select is(
  (select count(*)::int from public.goal_contributions where idempotency_key = 'goal-contrib-transfer-1'),
  1,
  'retrying the same transfer idempotency key created no duplicate contribution row'
);
select is(
  (select count(*)::int from public.ledger_transactions where user_id = '77777777-7777-7777-7777-777777777777' and description ilike '%laptop%'),
  1,
  'retrying the same transfer idempotency key created no duplicate ledger transaction'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "88888888-8888-8888-8888-888888888888", "role": "authenticated"}';

select is(
  (select count(*)::int from public.financial_goals where id = (select id from pg_temp.laptop_goal)),
  0,
  'user2 cannot see user1''s goal through RLS'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.record_goal_contribution_allocation(%L, 100, 'contribution', 'user2-attempt') $$, (select id from pg_temp.laptop_goal)),
    '42501'
  ),
  'user2 cannot contribute to user1''s goal'
);

reset role;

-- ---------------------------------------------------------------------
-- F. Emergency fund / sinking fund as goal subtypes.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_financial_goal(
    'Emergency fund', 'emergency_fund', 180000, 'INR', null, null, 0, 'earmarked', null, null,
    'months_of_expenses', 6, 30000
  ) $$,
  'user1 creates an emergency fund goal using the months-of-expenses method'
);
select is(
  (select ef_target_months from public.financial_goals where user_id = '77777777-7777-7777-7777-777777777777' and goal_type = 'emergency_fund'),
  6,
  'the emergency fund stores its configured target months'
);

select lives_ok(
  $$ select public.create_financial_goal('Annual insurance', 'sinking_fund', 12000, 'INR', current_date + 300, null, 0, 'earmarked', null, null, null, null, null, null, null, null, 'monthly') $$,
  'user1 creates a sinking fund goal with a monthly contribution frequency'
);
create temp table pg_temp.insurance_sf as select id from public.financial_goals where user_id = '77777777-7777-7777-7777-777777777777' and name = 'Annual insurance';
grant select on pg_temp.insurance_sf to authenticated;

-- G'. Sinking-fund linked-recurring-item management (Phase 12 closure).

select lives_ok(
  format(
    $$ select public.create_recurring_item('Insurance premium', 'bill', 12000, 'INR', current_date, 'yearly', 1, 'reminder_only', 'e1111111-1111-1111-1111-111111111111', null, %L) $$,
    (select id from public.categories where user_id = '77777777-7777-7777-7777-777777777777' and category_type = 'expense' limit 1)
  ),
  'user1 creates a yearly bill recurring item to link the sinking fund to'
);
create temp table pg_temp.insurance_bill as select id from public.recurring_items where user_id = '77777777-7777-7777-7777-777777777777' and name = 'Insurance premium';
grant select on pg_temp.insurance_bill to authenticated;

select lives_ok(
  format(
    $$ select public.set_goal_linked_recurring_item(%L, %L) $$,
    (select id from pg_temp.insurance_sf), (select id from pg_temp.insurance_bill)
  ),
  'user1 links the sinking fund to the recurring bill'
);
select is(
  (select sf_linked_recurring_item_id from public.financial_goals where id = (select id from pg_temp.insurance_sf)),
  (select id from pg_temp.insurance_bill),
  'the sinking fund stores the linked recurring item id'
);

select ok(
  pg_temp.throws_with_code(
    format(
      $$ select public.set_goal_linked_recurring_item(%L, %L) $$,
      (select id from pg_temp.laptop_goal), (select id from pg_temp.insurance_bill)
    ),
    '22023'
  ),
  'a non-sinking-fund goal cannot be linked to a recurring item'
);

select lives_ok(
  format($$ select public.set_goal_linked_recurring_item(%L) $$, (select id from pg_temp.insurance_sf)),
  'user1 clears the sinking fund''s recurring-item link by omitting it'
);
select is(
  (select sf_linked_recurring_item_id from public.financial_goals where id = (select id from pg_temp.insurance_sf)),
  null::uuid,
  'the link is cleared back to null'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "88888888-8888-8888-8888-888888888888", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    format(
      $$ select public.set_goal_linked_recurring_item(%L, %L) $$,
      (select id from pg_temp.insurance_sf), (select id from pg_temp.insurance_bill)
    ),
    '42501'
  ),
  'user2 cannot link user1''s sinking fund to a recurring item'
);

reset role;

-- ---------------------------------------------------------------------
-- G. Debts and EMI.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_debt('Car loan', 'vehicle_loan', 'e1111111-1111-1111-1111-111111111113', 120000, current_date, 'INR', 10, 'reducing_balance', 'monthly') $$,
  'user1 creates a debt linked to the loan liability account'
);
create temp table pg_temp.car_loan as select id from public.debts where user_id = '77777777-7777-7777-7777-777777777777' and name = 'Car loan';
grant select on pg_temp.car_loan to authenticated;

select is(
  (select count(*)::int from public.debt_rate_history where debt_id = (select id from pg_temp.car_loan)),
  1,
  'creating a debt seeds its initial rate-history row'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_debt('Dup loan', 'vehicle_loan', 'e1111111-1111-1111-1111-111111111113', 5000, current_date) $$,
    '23505'
  ),
  'a second debt cannot be linked to the same liability account'
);

select lives_ok(
  format(
    $$ select public.record_debt_proceeds(%L, 'e1111111-1111-1111-1111-111111111111', 120000, now(), 'loan-proceeds-1') $$,
    (select id from pg_temp.car_loan)
  ),
  'user1 records the loan''s disbursement'
);
select is(
  (select public.debt_current_principal((select id from pg_temp.car_loan))),
  120000.0000,
  'the debt''s current principal is derived correctly from the ledger after proceeds are posted'
);

select lives_ok(
  format($$ select * from public.regenerate_debt_payment_schedule(%L, 12) $$, (select id from pg_temp.car_loan)),
  'user1 generates a 12-installment amortization schedule'
);
select is(
  (select count(*)::int from public.debt_payment_schedules where debt_id = (select id from pg_temp.car_loan)),
  12,
  'exactly 12 schedule rows were generated'
);
select is(
  (select closing_principal from public.debt_payment_schedules where debt_id = (select id from pg_temp.car_loan) and installment_number = 12),
  0.0000,
  'the final installment closes the schedule to exactly zero (rounding adjustment)'
);
select ok(
  (select bool_and(principal_component >= 0 and interest_component >= 0) from public.debt_payment_schedules where debt_id = (select id from pg_temp.car_loan)),
  'every schedule row has non-negative principal and interest components'
);
select ok(
  not exists (
    select 1 from public.debt_payment_schedules a
    join public.debt_payment_schedules b on b.installment_number = a.installment_number + 1 and b.debt_id = a.debt_id
    where a.debt_id = (select id from pg_temp.car_loan) and a.closing_principal <> b.opening_principal
  ),
  'each installment''s closing principal exactly matches the next installment''s opening principal'
);

-- Record the first scheduled payment.
create temp table pg_temp.installment1 as select id, principal_component, interest_component from public.debt_payment_schedules where debt_id = (select id from pg_temp.car_loan) and installment_number = 1;
grant select on pg_temp.installment1 to authenticated;

select lives_ok(
  format(
    $$ select public.record_debt_payment(%L, %L, %L, 0, 'e1111111-1111-1111-1111-111111111111', current_date, 'debt-payment-1', 'scheduled', %L) $$,
    (select id from pg_temp.car_loan),
    (select principal_component from pg_temp.installment1),
    (select interest_component from pg_temp.installment1),
    (select id from pg_temp.installment1)
  ),
  'user1 records the first EMI payment'
);
create temp table pg_temp.payment1 as select id, related_transaction_id from public.debt_payments where debt_id = (select id from pg_temp.car_loan) and idempotency_key = 'debt-payment-1';
grant select on pg_temp.payment1 to authenticated;

select is(
  (select principal_amount from public.debt_payments where id = (select id from pg_temp.payment1)),
  (select principal_component from pg_temp.installment1),
  'the recorded payment''s principal matches the schedule row'
);
select is(
  (select sum(amount) from public.ledger_entries where transaction_id = (select related_transaction_id from pg_temp.payment1)),
  0::numeric,
  'the debt-payment transaction is balanced'
);
select is(
  (select transaction_type from public.ledger_transactions where id = (select related_transaction_id from pg_temp.payment1)),
  'debt_payment',
  'the transaction is posted with the debt_payment transaction type'
);

-- Principal is not counted as an expense; interest is.
select is(
  (select e.amount from public.ledger_entries e
    join public.accounts a on a.id = e.account_id
    where e.transaction_id = (select related_transaction_id from pg_temp.payment1) and a.is_system and a.system_code = 'uncategorized_expense'),
  (select interest_component from pg_temp.installment1),
  'only the interest portion posts to the uncategorized_expense system account -- principal is excluded'
);
select is(
  (select e.amount from public.ledger_entries e where e.transaction_id = (select related_transaction_id from pg_temp.payment1) and e.account_id = 'e1111111-1111-1111-1111-111111111113'),
  (select principal_component from pg_temp.installment1),
  'the liability account is credited (reduced) by exactly the principal component'
);

select is(
  (select public.debt_current_principal((select id from pg_temp.car_loan))),
  120000.0000 - (select principal_component from pg_temp.installment1),
  'the debt''s derived current principal decreased by exactly the principal paid'
);

-- Idempotent retry: same key returns the same row, no duplicate.
select lives_ok(
  format(
    $$ select public.record_debt_payment(%L, %L, %L, 0, 'e1111111-1111-1111-1111-111111111111', current_date, 'debt-payment-1', 'scheduled', %L) $$,
    (select id from pg_temp.car_loan),
    (select principal_component from pg_temp.installment1),
    (select interest_component from pg_temp.installment1),
    (select id from pg_temp.installment1)
  ),
  'retrying the same debt payment idempotency key does not error'
);
select is(
  (select count(*)::int from public.debt_payments where debt_id = (select id from pg_temp.car_loan)),
  1,
  'exactly one debt_payments row exists after the idempotent retry (no duplicate posting)'
);

-- Overpayment guard.
select ok(
  pg_temp.throws_with_code(
    format(
      $$ select public.record_debt_payment(%L, 999999, 0, 0, 'e1111111-1111-1111-1111-111111111111', current_date, 'overpay-attempt') $$,
      (select id from pg_temp.car_loan)
    ),
    '22023'
  ),
  'a principal payment exceeding the outstanding principal is rejected without explicit overpayment'
);
select lives_ok(
  format(
    $$ select public.record_debt_payment(%L, 999999, 0, 0, 'e1111111-1111-1111-1111-111111111111', current_date, 'overpay-allowed', 'prepayment', null, null, true) $$,
    (select id from pg_temp.car_loan)
  ),
  'an explicit p_allow_overpayment=true permits exceeding the outstanding principal'
);

-- Reversal restores debt_payments status.
select lives_ok(
  format($$ select public.reverse_transaction(%L) $$, (select related_transaction_id from pg_temp.payment1)),
  'user1 reverses the first EMI payment''s transaction'
);
select is(
  (select status from public.debt_payments where id = (select id from pg_temp.payment1)),
  'reversed',
  'reversing the payment''s transaction marks the debt_payments row reversed'
);

-- Regeneration preserves paid history: re-running regenerate must not
-- touch installment 1 (already linked to a payment, even a reversed one
-- -- schedule rows are never rewritten once referenced).
select lives_ok(
  format($$ select * from public.regenerate_debt_payment_schedule(%L, 11) $$, (select id from pg_temp.car_loan)),
  'user1 regenerates the schedule for the remaining installments'
);
select is(
  (select principal_component from public.debt_payment_schedules where debt_id = (select id from pg_temp.car_loan) and installment_number = 1),
  (select principal_component from pg_temp.installment1),
  'installment 1''s original figures are preserved exactly after regeneration'
);

reset role;

-- Cross-user isolation on debts.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "88888888-8888-8888-8888-888888888888", "role": "authenticated"}';

select is(
  (select count(*)::int from public.debts where id = (select id from pg_temp.car_loan)),
  0,
  'user2 cannot see user1''s debt through RLS'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.record_debt_payment(%L, 100, 0, 0, 'e2222222-2222-2222-2222-222222222222', current_date, 'user2-debt-attempt') $$, (select id from pg_temp.car_loan)),
    '42501'
  ),
  'user2 cannot record a payment against user1''s debt'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select * from public.regenerate_debt_payment_schedule(%L, 5) $$, (select id from pg_temp.car_loan)),
    '42501'
  ),
  'user2 cannot regenerate user1''s debt schedule'
);

reset role;

-- ---------------------------------------------------------------------
-- H. Reminders — computed live, never persisted.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select lives_ok(
  $$ select * from public.financial_planning_reminders() $$,
  'financial_planning_reminders runs for the caller'
);
select ok(
  not exists (select 1 from pg_tables where schemaname = 'public' and tablename ilike '%reminder%'),
  'no persisted reminders table exists -- reminders are computed live, matching the established convention'
);

reset role;

select * from finish();
rollback;
