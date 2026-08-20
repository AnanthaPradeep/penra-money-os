-- pgTAP tests for Phase 6: budget_periods/budget_allocations and their
-- summary RPCs, recurring_items/recurring_occurrences and their
-- generation/processing/lifecycle RPCs, the shared posting-core refactor,
-- and Cron/self-scoped-catchup privilege boundaries (see
-- supabase/migrations/20260820100000_phase6_budgets_recurring.sql).

begin;

select plan(116);

-- The recurring-item generation/processing functions compute "today" as
-- an Asia/Kolkata calendar date (see the section 1 header comment in the
-- migration), which can differ from the test session's own `current_date`
-- (session/UTC) for part of the day. Every recurring-item scenario below
-- uses this IST-consistent "today" instead of a bare `current_date`, so
-- due/overdue/upcoming assertions never depend on what time of day the
-- suite happens to run.
create temp table pg_temp.today_ist as
  select ((now() at time zone 'Asia/Kolkata')::date) as d;
-- Owned by the privileged test role; read later under `set local role
-- authenticated`, which needs its own explicit grant to select it (a temp
-- table is still subject to normal GRANT semantics, session-local storage
-- notwithstanding).
grant select on pg_temp.today_ist to authenticated;

create or replace function pg_temp.throws_with_code(p_sql text, p_expected_code text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return false; -- expected an exception; none was raised
exception when others then
  return sqlstate = p_expected_code;
end;
$$;

-- Fixed literal ids, mirroring the Phase 5 test file's convention:
--
--   user1 = 11111111-1111-1111-1111-111111111111
--   user2 = 22222222-2222-2222-2222-222222222222
--   bank1 = b1111111-1111-1111-1111-111111111111 (user1 asset, bank_savings)
--   card1 = c1111111-1111-1111-1111-111111111111 (user1 liability, credit_card)
--   bank2 = b9999999-9999-9999-9999-999999999999 (user2 asset, bank_savings)
--   expcatA..expcatD = e1111111.. / e5555555.. / e3333333.. / e7777777..
--   inccat1 = a1111111-1111-1111-1111-111111111111 (user1 income category)
--   expcat_user2 = e9999999-9999-9999-9999-999999999999 (user2 expense category)

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'pgtap-phase6-one@example.com', '{}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-2222-2222-222222222222', 'pgtap-phase6-two@example.com', '{}'::jsonb);

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'User1 Bank', 'asset', 'bank_savings', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency, credit_limit)
values ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'User1 Card', 'liability', 'credit_card', 'INR', 50000);
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b9999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 'User2 Bank', 'asset', 'bank_savings', 'INR');

insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'expense', 'Test Expense A (warning)', 'test expense a warning');
insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('e2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'expense', 'Test Expense B (zero-alloc)', 'test expense b zero alloc');
insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('e5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'expense', 'Test Expense C (exceeded)', 'test expense c exceeded');
insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('e3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'expense', 'Test Expense D (unbudgeted)', 'test expense d unbudgeted');
insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('e7777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'expense', 'Test Expense E (reversed)', 'test expense e reversed');
insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'income', 'Test Income A', 'test income a');
insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('e9999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 'expense', 'User2 Expense', 'user2 expense');

-- ---------------------------------------------------------------------
-- A. Schema: tables, RLS, key functions, no direct write grants.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'budget_periods'), 'public.budget_periods table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'budget_allocations'), 'public.budget_allocations table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'recurring_items'), 'public.recurring_items table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'recurring_occurrences'), 'public.recurring_occurrences table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.budget_periods'::regclass), 'RLS enabled on budget_periods');
select ok((select relforcerowsecurity from pg_class where oid = 'public.budget_periods'::regclass), 'RLS forced on budget_periods');
select ok((select relrowsecurity from pg_class where oid = 'public.recurring_items'::regclass), 'RLS enabled on recurring_items');
select ok((select relforcerowsecurity from pg_class where oid = 'public.recurring_items'::regclass), 'RLS forced on recurring_items');
select ok((select relrowsecurity from pg_class where oid = 'public.recurring_occurrences'::regclass), 'RLS enabled on recurring_occurrences');
select ok((select relforcerowsecurity from pg_class where oid = 'public.recurring_occurrences'::regclass), 'RLS forced on recurring_occurrences');

select ok(exists (select 1 from pg_proc where proname = 'process_recurring_finance'), 'process_recurring_finance() exists');
select ok(exists (select 1 from pg_proc where proname = 'run_recurring_catchup_self'), 'run_recurring_catchup_self() exists');
select ok(exists (select 1 from pg_proc where proname = 'post_manual_transaction_for_user'), 'post_manual_transaction_for_user() exists');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('budget_periods', 'budget_allocations', 'recurring_items', 'recurring_occurrences')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated has no direct INSERT/UPDATE/DELETE grant on any Phase 6 table'
);

-- ---------------------------------------------------------------------
-- B. Recurrence date math: required edge cases.
-- ---------------------------------------------------------------------

select is(public.recurring_occurrence_date('2026-08-20', 'weekly', 2, 3), '2026-10-01'::date, 'weekly every-2-weeks: k=3 from Aug 20 lands on Oct 1 (drift-free)');
select is(public.recurring_occurrence_date('2026-01-31', 'monthly', 1, 1), '2026-02-28'::date, 'monthly: Jan 31 + 1 month clamps to Feb 28 in a non-leap year');
select is(public.recurring_occurrence_date('2026-01-31', 'monthly', 1, 2), '2026-03-31'::date, 'monthly: Jan 31 + 2 months is Mar 31 (reclamped from the anchor each step, no drift)');
select is(public.recurring_occurrence_date('2026-01-30', 'monthly', 1, 1), '2026-02-28'::date, 'monthly: Jan 30 + 1 month clamps to Feb 28');
select is(public.recurring_occurrence_date('2026-08-31', 'quarterly', 1, 1), '2026-11-30'::date, 'quarterly: Aug 31 + 3 months clamps to Nov 30');
select is(public.recurring_occurrence_date('2026-08-31', 'half_yearly', 1, 1), '2027-02-28'::date, 'half_yearly: Aug 31 + 6 months clamps to Feb 28');
select is(public.recurring_occurrence_date('2024-02-29', 'yearly', 1, 1), '2025-02-28'::date, 'yearly: Feb 29 anchor + 1 year uses Feb 28 in a non-leap year');
select is(public.recurring_occurrence_date('2024-02-29', 'yearly', 1, 4), '2028-02-29'::date, 'yearly: Feb 29 anchor + 4 years lands back on Feb 29');

-- ---------------------------------------------------------------------
-- C. Budget periods and allocations, as user1.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.get_or_create_budget_period(current_date) $$,
  'user1 can get-or-create this month''s budget period (any day-of-month input normalizes to the 1st)'
);
select is(
  (select count(*)::int from public.budget_periods
    where user_id = '11111111-1111-1111-1111-111111111111'
      and period_month = date_trunc('month', current_date)::date),
  1,
  'exactly one budget_periods row exists for user1 this month'
);
select lives_ok(
  $$ select public.get_or_create_budget_period(current_date) $$,
  'calling get_or_create_budget_period again is idempotent'
);
select is(
  (select count(*)::int from public.budget_periods
    where user_id = '11111111-1111-1111-1111-111111111111'
      and period_month = date_trunc('month', current_date)::date),
  1,
  'still exactly one budget_periods row after calling get_or_create_budget_period twice'
);

reset role;
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.budget_periods (user_id, period_month, currency)
       values ('11111111-1111-1111-1111-111111111111', date_trunc('month', current_date)::date, 'INR') $$,
    '23505'
  ),
  'a duplicate (user, month, currency) budget period is rejected (23505)'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.save_budget_allocations(
         (select id from public.budget_periods where user_id = '11111111-1111-1111-1111-111111111111'
           and period_month = date_trunc('month', current_date)::date),
         jsonb_build_array(jsonb_build_object('category_id', 'e9999999-9999-9999-9999-999999999999', 'planned_amount', '100'))
       ) $$,
    '42501'
  ),
  'user1 cannot allocate against user2''s category (42501)'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.save_budget_allocations(
         (select id from public.budget_periods where user_id = '11111111-1111-1111-1111-111111111111'
           and period_month = date_trunc('month', current_date)::date),
         jsonb_build_array(jsonb_build_object('category_id', 'a1111111-1111-1111-1111-111111111111', 'planned_amount', '100'))
       ) $$,
    '23514'
  ),
  'an allocation against an income category is rejected (23514)'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.save_budget_allocations(
         (select id from public.budget_periods where user_id = '11111111-1111-1111-1111-111111111111'
           and period_month = date_trunc('month', current_date)::date),
         jsonb_build_array(
           jsonb_build_object('category_id', 'e1111111-1111-1111-1111-111111111111', 'planned_amount', '100'),
           jsonb_build_object('category_id', 'e1111111-1111-1111-1111-111111111111', 'planned_amount', '200')
         )
       ) $$,
    '23505'
  ),
  'a duplicate category within one save_budget_allocations call is rejected (23505)'
);

select lives_ok(
  $$ select public.save_budget_allocations(
       (select id from public.budget_periods where user_id = '11111111-1111-1111-1111-111111111111'
         and period_month = date_trunc('month', current_date)::date),
       jsonb_build_array(
         jsonb_build_object('category_id', 'e1111111-1111-1111-1111-111111111111', 'planned_amount', '5000'),
         jsonb_build_object('category_id', 'e2222222-2222-2222-2222-222222222222', 'planned_amount', '0'),
         jsonb_build_object('category_id', 'e5555555-5555-5555-5555-555555555555', 'planned_amount', '500')
       ),
       20000
     ) $$,
  'user1 saves three allocations (5000, 0, 500) plus planned income of 20000'
);

select lives_ok(
  $$ select public.copy_budget_period(date_trunc('month', current_date)::date, (date_trunc('month', current_date)::date + interval '1 month')::date) $$,
  'user1 copies this month''s allocations into next month'
);
select is(
  (select count(*)::int from public.budget_allocations ba
    join public.budget_periods bp on bp.id = ba.budget_period_id
    where bp.user_id = '11111111-1111-1111-1111-111111111111'
      and bp.period_month = (date_trunc('month', current_date)::date + interval '1 month')::date),
  3,
  'copy_budget_period copied all three allocations into next month'
);

reset role;
select ok(
  pg_temp.throws_with_code(
    $$ set local role authenticated;
       set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
       select public.copy_budget_period(date_trunc('month', current_date)::date, date_trunc('month', current_date)::date) $$,
    'P0002'
  ),
  'user2 cannot copy user1''s budget period (no_data_found, P0002)'
);

-- ---------------------------------------------------------------------
-- D. Budget actuals match the ledger, as user1.
-- ---------------------------------------------------------------------
-- expcatA (planned 5000): expense 3000 + credit_card_purchase 1500 -> actual 4500 (90% -> warning)
-- expcatB (planned 0): no spend -> actual 0 (zero-alloc branch -> safe)
-- expcatC (planned 500): expense 600 -> actual 600 (120% -> exceeded)
-- expcatD (no allocation): expense 800 -> unbudgeted
-- expcatE (no allocation): expense 1000, then reversed -> nets to zero, must not appear as unbudgeted
-- transfer 2000 and credit_card_payment 1500 must affect neither actual_expense nor actual_income.

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select public.create_manual_transaction(
  'income', now(), 'Test salary',
  jsonb_build_array(
    jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '20000.0000', 'currency', 'INR'),
    jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_income'), 'amount', '-20000.0000', 'currency', 'INR')
  ),
  null, 'a1111111-1111-1111-1111-111111111111'
);

select public.create_manual_transaction(
  'expense', now(), 'Test expense A',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '3000.0000', 'currency', 'INR'),
    jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-3000.0000', 'currency', 'INR')
  ),
  null, 'e1111111-1111-1111-1111-111111111111'
);

select public.create_manual_transaction(
  'credit_card_purchase', now(), 'Test CC purchase against expcatA',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '1500.0000', 'currency', 'INR'),
    jsonb_build_object('account_id', 'c1111111-1111-1111-1111-111111111111', 'amount', '-1500.0000', 'currency', 'INR')
  ),
  null, 'e1111111-1111-1111-1111-111111111111'
);

select public.create_manual_transaction(
  'credit_card_payment', now(), 'Test CC payment',
  jsonb_build_array(
    jsonb_build_object('account_id', 'c1111111-1111-1111-1111-111111111111', 'amount', '1500.0000', 'currency', 'INR'),
    jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-1500.0000', 'currency', 'INR')
  )
);

select public.create_manual_transaction(
  'transfer', now(), 'Test transfer',
  jsonb_build_array(
    jsonb_build_object('account_id', 'c1111111-1111-1111-1111-111111111111', 'amount', '2000.0000', 'currency', 'INR'),
    jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-2000.0000', 'currency', 'INR')
  )
);

select public.create_manual_transaction(
  'expense', now(), 'Test expense C (exceeded)',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '600.0000', 'currency', 'INR'),
    jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-600.0000', 'currency', 'INR')
  ),
  null, 'e5555555-5555-5555-5555-555555555555'
);

select public.create_manual_transaction(
  'expense', now(), 'Test expense D (unbudgeted)',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '800.0000', 'currency', 'INR'),
    jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-800.0000', 'currency', 'INR')
  ),
  null, 'e3333333-3333-3333-3333-333333333333'
);

select public.reverse_transaction(
  (select public.create_manual_transaction(
    'expense', now(), 'Test expense E (will be reversed)',
    jsonb_build_array(
      jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '1000.0000', 'currency', 'INR'),
      jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-1000.0000', 'currency', 'INR')
    ),
    null, 'e7777777-7777-7777-7777-777777777777'
  )).id
);

select is((select planned_expense from public.budget_summary(current_date)), 5500.0000, 'budget_summary: planned_expense is 5000+0+500=5500');
select is((select actual_expense from public.budget_summary(current_date)), 5900.0000, 'budget_summary: actual_expense is 4500+0+600+800=5900 (transfer/CC-payment excluded, reversed pair nets to zero)');
select is((select remaining from public.budget_summary(current_date)), -400.0000, 'budget_summary: remaining is 5500-5900=-400');
select is((select overspent from public.budget_summary(current_date)), 400.0000, 'budget_summary: overspent is 400');
select is((select planned_income from public.budget_summary(current_date)), 20000.0000, 'budget_summary: planned_income is 20000');
select is((select actual_income from public.budget_summary(current_date)), 20000.0000, 'budget_summary: actual_income is 20000');
select is((select planned_surplus from public.budget_summary(current_date)), 14500.0000, 'budget_summary: planned_surplus is 20000-5500=14500');
select is((select actual_net_cash_flow from public.budget_summary(current_date)), 14100.0000, 'budget_summary: actual_net_cash_flow is 20000-5900=14100');
select is((select unbudgeted_expense_total from public.budget_summary(current_date)), 800.0000, 'budget_summary: unbudgeted_expense_total is 800 (only expcatD)');

select is(
  (select actual_amount from public.budget_category_progress(current_date) where category_id = 'e1111111-1111-1111-1111-111111111111'),
  4500.0000, 'budget_category_progress: expcatA actual is 3000+1500=4500'
);
select is(
  (select progress_status from public.budget_category_progress(current_date) where category_id = 'e1111111-1111-1111-1111-111111111111'),
  'warning', 'budget_category_progress: expcatA at 90% is warning'
);
select is(
  (select progress_status from public.budget_category_progress(current_date) where category_id = 'e2222222-2222-2222-2222-222222222222'),
  'safe', 'budget_category_progress: expcatB (0 planned, 0 actual) is safe, not a division error'
);
select ok(
  (select usage_percent from public.budget_category_progress(current_date) where category_id = 'e2222222-2222-2222-2222-222222222222') is null,
  'budget_category_progress: expcatB usage_percent is null (zero-planned handled without divide-by-zero)'
);
select is(
  (select progress_status from public.budget_category_progress(current_date) where category_id = 'e5555555-5555-5555-5555-555555555555'),
  'exceeded', 'budget_category_progress: expcatC at 120% is exceeded'
);

select is(
  (select actual_amount from public.budget_unbudgeted_expenses(current_date) where category_id = 'e3333333-3333-3333-3333-333333333333'),
  800.0000, 'budget_unbudgeted_expenses: expcatD (no allocation) shows actual 800'
);
select is(
  (select count(*)::int from public.budget_unbudgeted_expenses(current_date) where category_id = 'e7777777-7777-7777-7777-777777777777'),
  0, 'budget_unbudgeted_expenses: expcatE does not appear (its posting + reversal net to zero)'
);

reset role;

-- ---------------------------------------------------------------------
-- E. Recurring items: creation validation, as user1 and user2.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_recurring_item(
         'Bad cross-user bill', 'bill', 100, 'INR',
         (select d from pg_temp.today_ist), 'monthly', 1, 'reminder_only',
         'b1111111-1111-1111-1111-111111111111', null,
         'e1111111-1111-1111-1111-111111111111', null, null,
         null
       ) $$,
    '42501'
  ),
  'user2 cannot create a recurring item against user1''s account (42501)'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_recurring_item(
         'Bad transfer, one account', 'transfer', 100, 'INR',
         (select d from pg_temp.today_ist), 'monthly', 1, 'reminder_only',
         'b1111111-1111-1111-1111-111111111111', null,
         null, null, null,
         null
       ) $$,
    '23514'
  ),
  'a transfer recurring item missing its destination account is rejected (23514)'
);

-- ---------------------------------------------------------------------
-- F. Occurrence generation, reminder-only processing, idempotency.
-- ---------------------------------------------------------------------
-- generate_recurring_occurrences/process_due_recurring_occurrences are
-- deliberately not granted to authenticated (section J proves this) —
-- every direct call to either below runs under the privileged test role
-- (reset role), with authenticated + user1's JWT claim re-entered
-- immediately after for the surrounding user-scoped RPC calls.

select lives_ok(
  $$ select public.create_recurring_item(
       'Test Reminder Bill', 'bill', 250, 'INR',
       (select d from pg_temp.today_ist), 'monthly', 1, 'reminder_only',
       'b1111111-1111-1111-1111-111111111111', null,
       'e1111111-1111-1111-1111-111111111111', null, null,
       null
     ) $$,
  'user1 creates a reminder_only monthly bill starting today'
);
-- A monthly item starting today generates several occurrences within the
-- 60-day horizon (today, ~+1 month, possibly ~+2 months) — that breadth is
-- intentional (see generate_occurrences_for_item's comment), so every
-- "occurrence count" assertion below is scoped to today's occurrence
-- specifically, never "exactly one occurrence total" for the item.
select is(
  (select count(*)::int from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Reminder Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
  1,
  'creating the recurring item generated exactly one occurrence scheduled for today'
);
select is(
  (select o.status from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Reminder Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
  'due',
  'today''s generated occurrence is due'
);

create temp table pg_temp.occurrence_count_baseline as
  select count(*)::int as n from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Reminder Bill';

reset role;
select is(
  public.generate_recurring_occurrences('11111111-1111-1111-1111-111111111111', 60),
  (select count(*)::int from public.recurring_items where user_id = '11111111-1111-1111-1111-111111111111' and status = 'active'),
  'generate_recurring_occurrences processes every active item for the scoped user'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Reminder Bill'),
  (select n from pg_temp.occurrence_count_baseline),
  'calling generate_recurring_occurrences again does not duplicate any occurrence (idempotent — same total count as before the re-run)'
);

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111'
    and description = 'Test Reminder Bill'),
  0,
  'no ledger transaction exists yet for the reminder-only bill'
);
reset role;
select lives_ok(
  $$ select public.process_due_recurring_occurrences('11111111-1111-1111-1111-111111111111') $$,
  'process_due_recurring_occurrences runs for the reminder-only occurrence without error'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111'
    and description = 'Test Reminder Bill'),
  0,
  'processing a reminder-only occurrence still creates no ledger transaction'
);
select is(
  (select o.status from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Reminder Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
  'due',
  'the reminder-only occurrence stays due (not auto-posted)'
);

-- Captured now (as user1, who can see it) for reuse by later cross-user/
-- already-linked tests run under a different role — a live subquery run
-- from those other contexts could not find it (RLS), which would silently
-- turn "occurrence not found" tests into "argument was NULL" tests instead
-- of the ownership check they are meant to exercise.
create temp table pg_temp.reminder_bill_today_occurrence as
  select o.id from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Reminder Bill' and o.scheduled_date = (select d from pg_temp.today_ist);
grant select on pg_temp.reminder_bill_today_occurrence to authenticated;

-- ---------------------------------------------------------------------
-- G. Auto-post: exactly one balanced transaction, no duplicate on retry.
-- ---------------------------------------------------------------------

select lives_ok(
  $$ select public.create_recurring_item(
       'Test Auto Income', 'income', 900, 'INR',
       (select d from pg_temp.today_ist), 'monthly', 1, 'auto_post',
       null, 'b1111111-1111-1111-1111-111111111111',
       'a1111111-1111-1111-1111-111111111111', null, null,
       null
     ) $$,
  'user1 creates an auto_post monthly recurring income starting today'
);

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111'
    and description = 'Test Auto Income'),
  0,
  'no transaction exists yet — creation only generates the occurrence, it does not post it'
);

reset role;
select lives_ok(
  $$ select public.process_due_recurring_occurrences('11111111-1111-1111-1111-111111111111') $$,
  'process_due_recurring_occurrences runs for the auto_post occurrence without error'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111'
    and description = 'Test Auto Income'),
  1,
  'auto-post created exactly one ledger transaction'
);
select is(
  (select count(*)::int from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    where t.user_id = '11111111-1111-1111-1111-111111111111' and t.description = 'Test Auto Income'),
  2,
  'the auto-posted transaction has exactly two entries'
);
select is(
  (select coalesce(sum(e.amount), -1) from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    where t.user_id = '11111111-1111-1111-1111-111111111111' and t.description = 'Test Auto Income'),
  0.0000,
  'the auto-posted transaction''s entries sum to exactly zero (balanced)'
);
select is(
  (select o.status from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Auto Income' and o.scheduled_date = (select d from pg_temp.today_ist)),
  'posted',
  'today''s occurrence is marked posted'
);
select ok(
  (select o.linked_transaction_id from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Auto Income' and o.scheduled_date = (select d from pg_temp.today_ist)) is not null,
  'today''s occurrence is linked to its posted transaction'
);

reset role;
select lives_ok(
  $$ select public.process_due_recurring_occurrences('11111111-1111-1111-1111-111111111111') $$,
  'running process_due_recurring_occurrences again (retry/re-run) does not error'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111'
    and description = 'Test Auto Income'),
  1,
  'still exactly one ledger transaction after re-running processing (idempotent, no duplicate)'
);

-- ---------------------------------------------------------------------
-- H. Pause blocks processing; resume re-enables; cancel preserves
-- history and blocks future generation.
-- ---------------------------------------------------------------------

select lives_ok(
  $$ select public.create_recurring_item(
       'Test Pause Bill', 'bill', 300, 'INR',
       (select d from pg_temp.today_ist), 'monthly', 1, 'auto_post',
       'b1111111-1111-1111-1111-111111111111', null,
       'e1111111-1111-1111-1111-111111111111', null, null,
       null
     ) $$,
  'user1 creates a second auto_post bill for the pause/resume/cancel scenario'
);
select lives_ok(
  $$ select public.set_recurring_item_status(
       (select id from public.recurring_items where name = 'Test Pause Bill'), 'paused'
     ) $$,
  'user1 pauses the item before it is ever processed'
);
reset role;
select lives_ok(
  $$ select public.process_due_recurring_occurrences('11111111-1111-1111-1111-111111111111') $$,
  'processing runs without error while the item is paused'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select o.status from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Pause Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
  'due',
  'a paused item''s due occurrence is left untouched (not posted) by processing'
);

select lives_ok(
  $$ select public.set_recurring_item_status(
       (select id from public.recurring_items where name = 'Test Pause Bill'), 'active'
     ) $$,
  'user1 resumes the paused item'
);
reset role;
select lives_ok(
  $$ select public.process_due_recurring_occurrences('11111111-1111-1111-1111-111111111111') $$,
  'processing runs again after resuming'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select o.status from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Pause Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
  'posted',
  'after resuming, today''s occurrence is posted exactly once (resuming created no duplicate)'
);
select is(
  (select count(*)::int from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Pause Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
  1,
  'still exactly one occurrence for today after pause + resume + processing'
);

select lives_ok(
  $$ select public.set_recurring_item_status(
       (select id from public.recurring_items where name = 'Test Pause Bill'), 'cancelled'
     ) $$,
  'user1 cancels the item after it has one posted (historical) occurrence'
);
select is(
  (select o.status from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Pause Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
  'posted',
  'cancelling the item leaves its already-posted occurrence and linked transaction untouched'
);

create temp table pg_temp.pause_bill_count_before_cancel_regen as
  select count(*)::int as n from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Pause Bill';

reset role;
select is(
  public.generate_recurring_occurrences('11111111-1111-1111-1111-111111111111', 60) is not null,
  true,
  'generate_recurring_occurrences runs cleanly after a cancellation'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Pause Bill'),
  (select n from pg_temp.pause_bill_count_before_cancel_regen),
  'a cancelled item generates no further occurrences (count unchanged from before the regeneration attempt)'
);
select ok(
  pg_temp.throws_with_code(
    format(
      $$ select public.set_recurring_item_status('%s', 'active') $$,
      (select id from public.recurring_items where name = 'Test Pause Bill')
    ),
    '25000'
  ),
  'a cancelled recurring item cannot be reactivated'
);

-- ---------------------------------------------------------------------
-- I. Failed posting leaves no partial transaction; skip; linking.
-- ---------------------------------------------------------------------

create temp table pg_temp.txn_count_before_failed_post as
  select count(*)::int as n from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111';

-- attempt_post_occurrence, like the generate/process functions above, is
-- not granted to authenticated (it is only ever called internally) — run
-- under the privileged role.
reset role;
select is(
  public.attempt_post_occurrence('00000000-0000-0000-0000-000000000000'),
  false,
  'attempt_post_occurrence on a non-existent occurrence reports failure rather than raising'
);
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111'),
  (select n from pg_temp.txn_count_before_failed_post),
  'a failed post attempt creates no ledger transaction (count unchanged from before the attempt)'
);

select lives_ok(
  $$ select public.create_recurring_item(
       'Test Skip Bill', 'bill', 150, 'INR',
       (select d from pg_temp.today_ist), 'monthly', 1, 'reminder_only',
       'b1111111-1111-1111-1111-111111111111', null,
       'e1111111-1111-1111-1111-111111111111', null, null,
       null
     ) $$,
  'user1 creates a third reminder_only bill for the skip scenario'
);
select lives_ok(
  $$ select public.skip_occurrence(
       (select o.id from public.recurring_occurrences o
         join public.recurring_items ri on ri.id = o.recurring_item_id
         where ri.name = 'Test Skip Bill' and o.scheduled_date = (select d from pg_temp.today_ist))
     ) $$,
  'user1 skips today''s due occurrence'
);
select is(
  (select o.status from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Skip Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
  'skipped',
  'today''s occurrence is marked skipped, with no transaction created'
);
select is(
  (select status from public.recurring_items where name = 'Test Skip Bill'),
  'active',
  'skipping an occurrence does not cancel or otherwise change the recurring item itself'
);

select lives_ok(
  $$ select public.create_recurring_item(
       'Test Link Bill', 'bill', 400, 'INR',
       (select d from pg_temp.today_ist), 'monthly', 1, 'reminder_only',
       'b1111111-1111-1111-1111-111111111111', null,
       'e1111111-1111-1111-1111-111111111111', null, null,
       null
     ) $$,
  'user1 creates a fourth reminder_only bill for the link-existing-transaction scenario'
);
select lives_ok(
  $$ select public.create_manual_transaction(
       'expense', now(), 'Spare compatible transaction',
       jsonb_build_array(
         jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '400.0000', 'currency', 'INR'),
         jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-400.0000', 'currency', 'INR')
       )
     ) $$,
  'user1 posts a spare, otherwise-unlinked expense transaction'
);
select lives_ok(
  $$ select public.link_existing_transaction_to_occurrence(
       (select o.id from public.recurring_occurrences o
         join public.recurring_items ri on ri.id = o.recurring_item_id
         where ri.name = 'Test Link Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
       (select id from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111'
         and description = 'Spare compatible transaction')
     ) $$,
  'user1 links the spare transaction to today''s due occurrence'
);
select is(
  (select o.status from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where ri.name = 'Test Link Bill' and o.scheduled_date = (select d from pg_temp.today_ist)),
  'posted',
  'today''s occurrence is posted after linking'
);
-- Targets "Test Reminder Bill"'s still-due occurrence (never posted or
-- skipped) rather than "Test Skip Bill"'s (already skipped, which would
-- raise invalid_transaction_state first and never reach the
-- already-linked check this test means to exercise).
select ok(
  pg_temp.throws_with_code(
    format(
      $$ select public.link_existing_transaction_to_occurrence(
           '%s', '%s'
         ) $$,
      (select id from pg_temp.reminder_bill_today_occurrence),
      (select id from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111'
        and description = 'Spare compatible transaction')
    ),
    '23505'
  ),
  'a transaction already linked to one occurrence cannot be linked to a second (23505)'
);

reset role;

-- ---------------------------------------------------------------------
-- J. Cross-user rejection for occurrence actions and self-scoped
-- catch-up; authenticated cannot invoke the global Cron processor.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

-- Uses the id captured earlier (as user1) rather than a live subquery run
-- as user2 — RLS would hide user1's row from that subquery entirely,
-- turning the argument into an empty string via format()'s NULL handling
-- (an invalid uuid literal) instead of a real id reaching
-- skip_occurrence's own explicit ownership check, which is what this test
-- means to exercise.
select ok(
  pg_temp.throws_with_code(
    format(
      $$ select public.skip_occurrence('%s') $$,
      (select id from pg_temp.reminder_bill_today_occurrence)
    ),
    'P0002'
  ),
  'user2 cannot skip user1''s occurrence (no_data_found, P0002)'
);

create temp table pg_temp.user1_unresolved_count_before as
  select count(*)::int as n from public.recurring_occurrences
    where user_id = '11111111-1111-1111-1111-111111111111'
      and status not in ('posted', 'skipped', 'cancelled');

select is(
  (select processed_count from public.run_recurring_catchup_self()),
  0,
  'user2''s self-scoped catch-up processes zero occurrences (user2 has none of their own)'
);
select is(
  (select count(*)::int from public.recurring_occurrences where user_id = '11111111-1111-1111-1111-111111111111'
    and status not in ('posted', 'skipped', 'cancelled')),
  (select n from pg_temp.user1_unresolved_count_before),
  'user1''s unresolved occurrences are unaffected by user2''s catch-up call (count unchanged)'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.process_recurring_finance() $$,
    '42501'
  ),
  'an authenticated client cannot invoke the global Cron processor directly (42501, no EXECUTE grant)'
);

reset role;

-- ---------------------------------------------------------------------
-- K. Subscription cost summary.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Exact monthly/annual normalization math (amounts chosen so every
-- division below is exact, no rounding ambiguity to reason about):
--   monthly 100/month     -> monthly 100,      annual 1200
--   weekly  120/week      -> monthly 120*52/12=520, annual 120*52=6240
--   quarterly 300/quarter -> monthly 300/3=100,     annual 300*4=1200
--   half_yearly 600/half  -> monthly 600/6=100,      annual 600*2=1200
select lives_ok(
  $$ select public.create_recurring_item(
       'Test Subscription', 'subscription', 100, 'INR',
       (select d from pg_temp.today_ist), 'monthly', 1, 'reminder_only',
       'b1111111-1111-1111-1111-111111111111', null,
       'e1111111-1111-1111-1111-111111111111', null, null,
       null
     ) $$,
  'user1 creates an active monthly subscription costing 100/month'
);
select is(
  (select monthly_estimate from public.subscription_cost_summary()),
  100.0000,
  'subscription_cost_summary monthly_estimate for a lone monthly 100/month subscription is exactly 100'
);
select is(
  (select annual_estimate from public.subscription_cost_summary()),
  1200.0000,
  'subscription_cost_summary annual_estimate for a lone monthly 100/month subscription is exactly 1200 (100 x 12)'
);
select ok(
  (select active_subscription_count from public.subscription_cost_summary()) >= 1,
  'subscription_cost_summary counts the active subscription'
);

select lives_ok(
  $$ select public.create_recurring_item(
       'Test Subscription Weekly', 'subscription', 120, 'INR',
       (select d from pg_temp.today_ist), 'weekly', 1, 'reminder_only',
       'b1111111-1111-1111-1111-111111111111', null,
       'e1111111-1111-1111-1111-111111111111', null, null,
       null
     ) $$,
  'user1 creates a weekly subscription costing 120/week'
);
select is(
  (select monthly_estimate from public.subscription_cost_summary()),
  620.0000,
  'weekly normalization: 120 x 52 / 12 = 520, cumulative monthly is 100 + 520 = 620'
);
select is(
  (select annual_estimate from public.subscription_cost_summary()),
  7440.0000,
  'weekly normalization: 120 x 52 = 6240, cumulative annual is 1200 + 6240 = 7440'
);

select lives_ok(
  $$ select public.create_recurring_item(
       'Test Subscription Quarterly', 'subscription', 300, 'INR',
       (select d from pg_temp.today_ist), 'quarterly', 1, 'reminder_only',
       'b1111111-1111-1111-1111-111111111111', null,
       'e1111111-1111-1111-1111-111111111111', null, null,
       null
     ) $$,
  'user1 creates a quarterly subscription costing 300/quarter'
);
select is(
  (select monthly_estimate from public.subscription_cost_summary()),
  720.0000,
  'quarterly normalization: 300 / 3 = 100, cumulative monthly is 620 + 100 = 720'
);
select is(
  (select annual_estimate from public.subscription_cost_summary()),
  8640.0000,
  'quarterly normalization: 300 x 4 = 1200, cumulative annual is 7440 + 1200 = 8640'
);

select lives_ok(
  $$ select public.create_recurring_item(
       'Test Subscription HalfYearly', 'subscription', 600, 'INR',
       (select d from pg_temp.today_ist), 'half_yearly', 1, 'reminder_only',
       'b1111111-1111-1111-1111-111111111111', null,
       'e1111111-1111-1111-1111-111111111111', null, null,
       null
     ) $$,
  'user1 creates a half-yearly subscription costing 600/half-year'
);
select is(
  (select monthly_estimate from public.subscription_cost_summary()),
  820.0000,
  'half_yearly normalization: 600 / 6 = 100, cumulative monthly is 720 + 100 = 820'
);
select is(
  (select annual_estimate from public.subscription_cost_summary()),
  9840.0000,
  'half_yearly normalization: 600 x 2 = 1200, cumulative annual is 8640 + 1200 = 9840'
);
select is(
  (select active_subscription_count from public.subscription_cost_summary()),
  4,
  'subscription_cost_summary counts all four active subscriptions'
);

reset role;

-- Directly cancels all four subscriptions with a past cancellation_date as
-- the privileged role (fixture setup — status and cancellation_date must
-- change together to satisfy recurring_items_cancellation_requires_
-- cancelled, so this is not simply set_recurring_item_status, which does
-- not accept a caller-supplied cancellation_date).
update public.recurring_items
  set status = 'cancelled', cancellation_date = (select d from pg_temp.today_ist) - 1
  where name in (
    'Test Subscription', 'Test Subscription Weekly',
    'Test Subscription Quarterly', 'Test Subscription HalfYearly'
  );

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select ok(
  not exists (
    select 1 from public.recurring_items
    where name = 'Test Subscription' and status = 'active'
  ),
  'the subscription is no longer active after cancellation'
);
select is(
  (select active_subscription_count from public.subscription_cost_summary()),
  0,
  'subscription_cost_summary no longer counts any cancelled-with-past-date subscription as active'
);
select is(
  (select monthly_estimate from public.subscription_cost_summary()),
  0.0000,
  'subscription_cost_summary monthly_estimate is zero once every subscription is cancelled'
);

reset role;

select * from finish();
rollback;
