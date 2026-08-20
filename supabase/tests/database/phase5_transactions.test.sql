-- pgTAP tests for Phase 5: public.categories, public.payees, the
-- category/payee columns and validation trigger on ledger_transactions,
-- the extended create_manual_transaction (category/payee/idempotency),
-- edit_manual_transaction, and the dashboard_* aggregation RPCs (see
-- supabase/migrations/20260819130000_phase5_categories_payees_transactions.sql).

begin;

select plan(53);

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

-- Fixed literal ids used throughout (mirrors the convention in
-- supabase/tests/database/ledger_foundation.test.sql):
--
--   user1  = 11111111-1111-1111-1111-111111111111
--   user2  = 22222222-2222-2222-2222-222222222222
--   bank1  = b1111111-1111-1111-1111-111111111111 (user1's asset, bank_savings)
--   bank2  = b9999999-9999-9999-9999-999999999999 (user2's asset, bank_savings)
--   cust_expense1 = e1111111-1111-1111-1111-111111111111 (user1's custom expense category)
--   payee1 = f1111111-1111-1111-1111-111111111111 (user1's payee)

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'pgtap-phase5-one@example.com', '{}'::jsonb);

insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-2222-2222-222222222222', 'pgtap-phase5-two@example.com', '{}'::jsonb);

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'User1 Bank', 'asset', 'bank_savings', 'INR');

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'User1 Wallet', 'asset', 'wallet', 'INR');

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b9999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 'User2 Bank', 'asset', 'bank_savings', 'INR');

insert into public.payees (id, user_id, name, normalized_name)
values ('f9999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 'User2 Payee', 'user2 payee');

-- A fixed-id custom category for user2, created here (outside any RLS
-- context) specifically so later cross-user tests can reference it by
-- literal id — a subquery filtered to user2's rows would return null when
-- executed as user1 (RLS hides it), which would make those tests silently
-- pass a null parent_id/category_id instead of actually exercising the
-- cross-user rejection path.
insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('e9999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 'expense', 'User2 Custom Expense', 'user2 custom expense');

-- ---------------------------------------------------------------------
-- A. Schema: tables, columns, RLS.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'categories'), 'public.categories table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'payees'), 'public.payees table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.categories'::regclass), 'RLS enabled on categories');
select ok((select relforcerowsecurity from pg_class where oid = 'public.categories'::regclass), 'RLS forced on categories');
select ok((select relrowsecurity from pg_class where oid = 'public.payees'::regclass), 'RLS enabled on payees');
select ok((select relforcerowsecurity from pg_class where oid = 'public.payees'::regclass), 'RLS forced on payees');

select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ledger_transactions' and column_name = 'category_id'), 'ledger_transactions.category_id exists');
select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ledger_transactions' and column_name = 'payee_id'), 'ledger_transactions.payee_id exists');
select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ledger_transactions' and column_name = 'replaces_transaction_id'), 'ledger_transactions.replaces_transaction_id exists');

select is(
  (select count(*)::int from pg_policies where schemaname = 'public'
    and tablename in ('categories', 'payees')
    and (qual = 'true' or with_check = 'true')),
  0,
  'no permissive true-qualified policy exists on categories/payees'
);

-- ---------------------------------------------------------------------
-- B. Functions and triggers exist.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_proc where proname = 'provision_default_categories_self'), 'provision_default_categories_self() function exists');
select ok(exists (select 1 from pg_proc where proname = 'edit_manual_transaction'), 'edit_manual_transaction() function exists');
select ok(exists (select 1 from pg_proc where proname = 'dashboard_summary'), 'dashboard_summary() function exists');
select ok(exists (select 1 from pg_proc where proname = 'dashboard_expense_by_category'), 'dashboard_expense_by_category() function exists');
select ok(exists (select 1 from pg_proc where proname = 'dashboard_cash_flow_trend'), 'dashboard_cash_flow_trend() function exists');
select ok(exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created_categories' and not tgisinternal), 'on_auth_user_created_categories trigger exists on auth.users');

-- ---------------------------------------------------------------------
-- C. Default category seeding: auto-provisioned on signup, idempotent.
-- ---------------------------------------------------------------------

select is(
  (select count(*)::int from public.categories where user_id = '11111111-1111-1111-1111-111111111111'),
  25,
  'user1 has 25 default categories auto-provisioned on signup'
);
select is(
  (select count(*)::int from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and category_type = 'expense'),
  16,
  'user1 has 16 default expense categories'
);
select is(
  (select count(*)::int from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and category_type = 'income'),
  9,
  'user1 has 9 default income categories'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.provision_default_categories_self() $$,
  'provision_default_categories_self() can be called again safely'
);
select is(
  (select count(*)::int from public.categories where user_id = '11111111-1111-1111-1111-111111111111'),
  25,
  'calling provision_default_categories_self() again does not create duplicates'
);

-- ---------------------------------------------------------------------
-- D. Category CRUD and constraints (as user1).
-- ---------------------------------------------------------------------

insert into public.categories (id, user_id, category_type, name, normalized_name)
values ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'expense', 'Side Project Costs', 'side project costs');

select ok(
  exists (select 1 from public.categories where id = 'e1111111-1111-1111-1111-111111111111'),
  'user1 can create a custom expense category'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.categories (user_id, category_type, name, normalized_name)
       values ('11111111-1111-1111-1111-111111111111', 'expense', 'Side Project Costs', 'side project costs') $$,
    '23505'
  ),
  'duplicate active category (same type + normalized name) is rejected (23505)'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.categories (user_id, category_type, name, normalized_name, parent_id)
       values ('11111111-1111-1111-1111-111111111111', 'expense', 'Bad Parent Test', 'bad parent test',
         'e9999999-9999-9999-9999-999999999999') $$,
    '42501'
  ),
  'a category parent belonging to another user is rejected (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.categories (user_id, category_type, name, normalized_name, parent_id)
       values ('11111111-1111-1111-1111-111111111111', 'income', 'Mismatched Type Child', 'mismatched type child',
         'e1111111-1111-1111-1111-111111111111') $$,
    '23514'
  ),
  'a category parent with a different category_type is rejected (23514)'
);

-- A system category cannot be updated by its own owner — RLS's
-- is_system = false precondition on the UPDATE policy can never be met.
update public.categories set is_archived = true
  where user_id = '11111111-1111-1111-1111-111111111111' and slug = 'salary';
select is(
  (select is_archived from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and slug = 'salary'),
  false,
  'a system/default category cannot be archived by its owner (RLS silently blocks the update)'
);

reset role;

-- ---------------------------------------------------------------------
-- E. Payee CRUD and constraints (as user1).
-- ---------------------------------------------------------------------

insert into public.payees (id, user_id, name, normalized_name)
values ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Corner Store', 'corner store');

select ok(exists (select 1 from public.payees where id = 'f1111111-1111-1111-1111-111111111111'), 'user1 can create a payee');

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.payees (user_id, name, normalized_name)
       values ('11111111-1111-1111-1111-111111111111', 'Corner Store', 'corner store') $$,
    '23505'
  ),
  'duplicate active payee (same normalized name) is rejected (23505)'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select count(*)::int from public.payees where id = 'f1111111-1111-1111-1111-111111111111'),
  0,
  'user2 cannot read user1''s payee (RLS)'
);
select is(
  (select count(*)::int from public.categories where id = 'e1111111-1111-1111-1111-111111111111'),
  0,
  'user2 cannot read user1''s custom category (RLS)'
);
select ok(
  pg_temp.throws_with_code(
    $$ insert into public.categories (user_id, category_type, name, normalized_name)
       values ('11111111-1111-1111-1111-111111111111', 'expense', 'Injected', 'injected') $$,
    '42501'
  ),
  'user2 cannot insert a category owned by user1 (RLS insert check)'
);

reset role;

-- ---------------------------------------------------------------------
-- F. create_manual_transaction: category/payee validation.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_manual_transaction(
         'expense', now(), 'Groceries run',
         jsonb_build_array(
           jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '500.0000'),
           jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-500.0000')
         ),
         null,
         (select id from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and slug = 'salary')
       ) $$,
    '23514'
  ),
  'an expense transaction with an income category is rejected (23514)'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_manual_transaction(
         'transfer', now(), 'Move funds',
         jsonb_build_array(
           jsonb_build_object('account_id', 'b2222222-2222-2222-2222-222222222222', 'amount', '100.0000'),
           jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-100.0000')
         ),
         null,
         (select id from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and slug = 'other_expense')
       ) $$,
    '23514'
  ),
  'a transfer transaction with a category set is rejected (23514)'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_manual_transaction(
         'expense', now(), 'Cross-user category',
         jsonb_build_array(
           jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '500.0000'),
           jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-500.0000')
         ),
         null,
         'e9999999-9999-9999-9999-999999999999'
       ) $$,
    '42501'
  ),
  'an expense transaction referencing another user''s category is rejected (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_manual_transaction(
         'expense', now(), 'Cross-user payee',
         jsonb_build_array(
           jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '500.0000'),
           jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-500.0000')
         ),
         null, null,
         'f9999999-9999-9999-9999-999999999999'
       ) $$,
    '42501'
  ),
  'an expense transaction referencing another user''s payee is rejected (42501)'
);

reset role;

-- ---------------------------------------------------------------------
-- G. Idempotency.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (
    select (public.create_manual_transaction(
      'income', now(), 'Salary for the month',
      jsonb_build_array(
        jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '50000.0000'),
        jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_income'), 'amount', '-50000.0000')
      ),
      null,
      (select id from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and slug = 'salary'),
      'f1111111-1111-1111-1111-111111111111',
      'idem-salary-aug'
    )).id is not null
  ),
  true,
  'create_manual_transaction with an idempotency key succeeds'
);

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111' and source_reference = 'idem-salary-aug'),
  1,
  'exactly one transaction exists for the idempotency key after the first call'
);

select is(
  (
    select (public.create_manual_transaction(
      'income', now(), 'Salary for the month (duplicate submit)',
      jsonb_build_array(
        jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '50000.0000'),
        jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_income'), 'amount', '-50000.0000')
      ),
      null, null, null,
      'idem-salary-aug'
    )).id
    =
    (select id from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111' and source_reference = 'idem-salary-aug')
  ),
  true,
  'a duplicate submission with the same idempotency key returns the existing transaction'
);

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '11111111-1111-1111-1111-111111111111' and source_reference = 'idem-salary-aug'),
  1,
  'still exactly one transaction after the duplicate submission (no second row created)'
);

reset role;

-- ---------------------------------------------------------------------
-- H. edit_manual_transaction: atomic reverse + recreate.
-- ---------------------------------------------------------------------

-- Fixture transaction inserted directly (as the privileged test role,
-- like every other direct fixture insert in this file) — `authenticated`
-- has no insert grant on ledger_transactions/ledger_entries at all, since
-- every real mutation goes exclusively through the SECURITY DEFINER
-- functions under test.
insert into public.ledger_transactions (id, user_id, transaction_type, occurred_at, description, source_type)
values ('a0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'expense', now(), 'Groceries (to be corrected)', 'manual');
insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency)
values
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 800.0000, 'INR'),
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001', 'b1111111-1111-1111-1111-111111111111', -800.0000, 'INR');

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.edit_manual_transaction(
       'a0000001-0000-0000-0000-000000000001', now(), 'Groceries (corrected amount)',
       jsonb_build_array(
         jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '650.0000'),
         jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-650.0000')
       ),
       null,
       (select id from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and slug = 'other_expense')
     ) $$,
  'edit_manual_transaction succeeds for a posted manual transaction'
);

select is(
  (select status from public.ledger_transactions where id = 'a0000001-0000-0000-0000-000000000001'),
  'reversed',
  'the original transaction is marked reversed after editing'
);

select is(
  (select count(*)::int from public.ledger_transactions where replaces_transaction_id = 'a0000001-0000-0000-0000-000000000001'),
  1,
  'exactly one replacement transaction links back via replaces_transaction_id'
);

select is(
  (
    select e.amount from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    where t.replaces_transaction_id = 'a0000001-0000-0000-0000-000000000001'
      and e.account_id = 'b1111111-1111-1111-1111-111111111111'
  ),
  -650.0000,
  'the replacement transaction carries the corrected amount'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.edit_manual_transaction(
         'a0000001-0000-0000-0000-000000000001', now(), 'Second edit attempt',
         jsonb_build_array(
           jsonb_build_object('account_id', (select id from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'), 'amount', '1.0000'),
           jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-1.0000')
         )
       ) $$,
    '25000'
  ),
  'editing an already-edited transaction a second time is rejected'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.edit_manual_transaction(
         'a0000001-0000-0000-0000-000000000001', now(), 'Cross-user edit attempt',
         jsonb_build_array(
           jsonb_build_object('account_id', 'b9999999-9999-9999-9999-999999999999', 'amount', '1.0000'),
           jsonb_build_object('account_id', 'b9999999-9999-9999-9999-999999999999', 'amount', '-1.0000')
         )
       ) $$,
    'P0002'
  ),
  'user2 cannot edit user1''s transaction (not found from user2''s perspective)'
);

reset role;

-- ---------------------------------------------------------------------
-- I. Dashboard aggregation RPCs.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- At this point user1 has (from this file): +50000 income (salary,
-- idempotent-tested), -650 expense (edited groceries). The unbalanced
-- reversal/replacement pair from section H nets to zero on its own, so it
-- does not skew these totals beyond the final -650.

select is(
  (select total_income from public.dashboard_summary(current_date - 7, current_date + 7)),
  50000.0000,
  'dashboard_summary reports the correct total_income for the period'
);
select is(
  (select total_expense from public.dashboard_summary(current_date - 7, current_date + 7)),
  650.0000,
  'dashboard_summary reports the correct total_expense for the period'
);
select is(
  (select net_cash_flow from public.dashboard_summary(current_date - 7, current_date + 7)),
  49350.0000,
  'dashboard_summary net_cash_flow equals income minus expense'
);

-- A transfer must not move the dashboard totals at all.
select public.create_manual_transaction(
  'transfer', now(), 'Move to wallet',
  jsonb_build_array(
    jsonb_build_object('account_id', 'b2222222-2222-2222-2222-222222222222', 'amount', '200.0000'),
    jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-200.0000')
  )
);

select is(
  (select total_income from public.dashboard_summary(current_date - 7, current_date + 7)),
  50000.0000,
  'a transfer does not change dashboard total_income'
);
select is(
  (select total_expense from public.dashboard_summary(current_date - 7, current_date + 7)),
  650.0000,
  'a transfer does not change dashboard total_expense'
);

select is(
  (
    select total_amount from public.dashboard_expense_by_category(current_date - 7, current_date + 7)
    where category_id = (select id from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and slug = 'other_expense')
  ),
  650.0000,
  'dashboard_expense_by_category attributes the corrected expense to the right category'
);

reset role;

-- user2's dashboard must show none of user1's activity.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select total_income from public.dashboard_summary(current_date - 7, current_date + 7)),
  0.0000,
  'dashboard_summary for user2 shows zero income (RLS-scoped, unaffected by user1''s activity)'
);
select is(
  (select total_expense from public.dashboard_summary(current_date - 7, current_date + 7)),
  0.0000,
  'dashboard_summary for user2 shows zero expense (RLS-scoped, unaffected by user1''s activity)'
);

reset role;

select * from finish();
rollback;
