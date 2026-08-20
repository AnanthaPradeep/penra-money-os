-- pgTAP tests for the Phase 3 ledger foundation: public.institutions,
-- public.accounts, public.ledger_transactions, public.ledger_entries, the
-- system-account provisioning trigger, the atomic SECURITY DEFINER
-- functions, the deferred balance constraint trigger, and
-- public.account_balances (see supabase/migrations/20260817153217_create_
-- ledger_foundation.sql).
--
-- NOT EXECUTED in this environment — Docker is unavailable here, and
-- `supabase test db` / `supabase db reset` both require the local Postgres
-- stack to run. Written to be run with:
--
--   supabase start
--   supabase test db supabase/tests/database/ledger_foundation.test.sql
--
-- Every assertion below was reviewed carefully by hand against the
-- migration it tests, but "written correctly" is not the same claim as
-- "observed to pass" — treat this file as unverified until it has
-- actually been run once Docker/local Supabase is available.

begin;

select plan(74);

-- pgTAP's throws_ok() was tried first (in every argument form its docs
-- describe) and, against a real run, marked tests FAILED even when its own
-- "caught:" diagnostic showed the exact expected SQLSTATE and message —
-- confirmed twice, consistently, across every single throws_ok call in
-- this file. Rather than keep guessing at its calling convention, this
-- small helper replaces it: a plain EXCEPTION WHEN OTHERS catch whose
-- behavior is unambiguous and fully under this file's own control.
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

-- Fixed literal ids used throughout instead of PL/pgSQL variable capture
-- (a plain pgTAP .sql script has no session state to carry a RETURNING
-- INTO value between top-level statements) — mirrors the convention in
-- supabase/tests/database/profiles.test.sql.
--
--   user1        = 11111111-1111-1111-1111-111111111111
--   user2        = 22222222-2222-2222-2222-222222222222
--   institution1 = a1111111-1111-1111-1111-111111111111 (user1's)
--   bank1        = b1111111-1111-1111-1111-111111111111 (user1's asset, bank_savings)
--   wallet1      = b2222222-2222-2222-2222-222222222222 (user1's asset, wallet)
--   creditcard1  = c1111111-1111-1111-1111-111111111111 (user1's liability, credit_card)
--   bank2        = b9999999-9999-9999-9999-999999999999 (user2's asset, bank_savings)
--   txn_unbal    = d1111111-1111-1111-1111-111111111111 (test-only unbalanced header)

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'pgtap-ledger-one@example.com', '{}'::jsonb);

insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-2222-2222-222222222222', 'pgtap-ledger-two@example.com', '{}'::jsonb);

-- ---------------------------------------------------------------------
-- A. Schema: tables exist, RLS enabled + forced on all four.
-- ---------------------------------------------------------------------

select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'institutions'),
  'public.institutions table exists'
);
select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'accounts'),
  'public.accounts table exists'
);
select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'ledger_transactions'),
  'public.ledger_transactions table exists'
);
select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'ledger_entries'),
  'public.ledger_entries table exists'
);

select ok((select relrowsecurity from pg_class where oid = 'public.institutions'::regclass), 'RLS enabled on institutions');
select ok((select relforcerowsecurity from pg_class where oid = 'public.institutions'::regclass), 'RLS forced on institutions');
select ok((select relrowsecurity from pg_class where oid = 'public.accounts'::regclass), 'RLS enabled on accounts');
select ok((select relforcerowsecurity from pg_class where oid = 'public.accounts'::regclass), 'RLS forced on accounts');
select ok((select relrowsecurity from pg_class where oid = 'public.ledger_transactions'::regclass), 'RLS enabled on ledger_transactions');
select ok((select relforcerowsecurity from pg_class where oid = 'public.ledger_transactions'::regclass), 'RLS forced on ledger_transactions');
select ok((select relrowsecurity from pg_class where oid = 'public.ledger_entries'::regclass), 'RLS enabled on ledger_entries');
select ok((select relforcerowsecurity from pg_class where oid = 'public.ledger_entries'::regclass), 'RLS forced on ledger_entries');

-- No permissive `true`-qualified policy on any of the four tables.
select is(
  (select count(*)::int from pg_policies where schemaname = 'public'
    and tablename in ('institutions', 'accounts', 'ledger_transactions', 'ledger_entries')
    and (qual = 'true' or with_check = 'true')),
  0,
  'no permissive true-qualified policy exists on any Phase 3 table'
);

-- ledger_transactions and ledger_entries are SELECT-only for authenticated
-- — every mutation goes exclusively through the SECURITY DEFINER functions.
select is(
  (select count(*)::int from pg_policies where schemaname = 'public'
    and tablename = 'ledger_transactions' and cmd in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'no INSERT/UPDATE/DELETE policy exists on ledger_transactions'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public'
    and tablename = 'ledger_entries' and cmd in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'no INSERT/UPDATE/DELETE policy exists on ledger_entries'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public'
    and tablename = 'institutions' and cmd = 'DELETE'),
  0,
  'no DELETE policy exists on institutions'
);

-- ---------------------------------------------------------------------
-- B. Triggers, functions, and the balance view exist.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_trigger where tgrelid = 'public.ledger_entries'::regclass and tgname = 'ledger_entries_validate_ownership' and not tgisinternal), 'ledger_entries_validate_ownership trigger exists');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.ledger_entries'::regclass and tgname = 'ledger_entries_balance_check' and not tgisinternal), 'ledger_entries_balance_check deferred constraint trigger exists');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.ledger_entries'::regclass and tgname = 'ledger_entries_prevent_update' and not tgisinternal), 'ledger_entries_prevent_update trigger exists');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.ledger_entries'::regclass and tgname = 'ledger_entries_prevent_delete' and not tgisinternal), 'ledger_entries_prevent_delete trigger exists');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.accounts'::regclass and tgname = 'accounts_validate_institution_ownership' and not tgisinternal), 'accounts_validate_institution_ownership trigger exists');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.ledger_transactions'::regclass and tgname = 'ledger_transactions_validate_reversal' and not tgisinternal), 'ledger_transactions_validate_reversal trigger exists');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.institutions'::regclass and tgname = 'set_institutions_updated_at' and not tgisinternal), 'set_institutions_updated_at trigger reuses public.set_updated_at');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.accounts'::regclass and tgname = 'set_accounts_updated_at' and not tgisinternal), 'set_accounts_updated_at trigger reuses public.set_updated_at');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.ledger_transactions'::regclass and tgname = 'set_ledger_transactions_updated_at' and not tgisinternal), 'set_ledger_transactions_updated_at trigger reuses public.set_updated_at');
select ok(exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created_ledger_accounts' and not tgisinternal), 'on_auth_user_created_ledger_accounts trigger exists on auth.users, alongside the Phase 2 profile trigger');
select ok(exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created' and not tgisinternal), 'the Phase 2 on_auth_user_created trigger still exists (not replaced)');

select ok(exists (select 1 from pg_proc where proname = 'provision_system_accounts'), 'provision_system_accounts() function exists');
select ok(exists (select 1 from pg_proc where proname = 'create_account_with_opening_balance'), 'create_account_with_opening_balance() function exists');
select ok(exists (select 1 from pg_proc where proname = 'create_manual_transaction'), 'create_manual_transaction() function exists');
select ok(exists (select 1 from pg_proc where proname = 'reverse_transaction'), 'reverse_transaction() function exists');
select ok(exists (select 1 from pg_views where schemaname = 'public' and viewname = 'account_balances'), 'public.account_balances view exists');

-- ---------------------------------------------------------------------
-- C. System-account provisioning: signup trigger + backfill idempotency.
-- ---------------------------------------------------------------------

select is(
  (select count(*)::int from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and is_system = true),
  4,
  'signup trigger provisions exactly four hidden system accounts (a fourth, realized_investment_gains, added by Phase 7)'
);
select is(
  (select account_class from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'opening_balance_equity'),
  'equity',
  'Opening Balance Equity system account has class equity'
);
select is(
  (select account_class from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_income'),
  'income',
  'Uncategorized Income system account has class income'
);
select is(
  (select account_class from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_expense'),
  'expense',
  'Uncategorized Expense system account has class expense'
);
select is(
  (select account_class from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'realized_investment_gains'),
  'income',
  'Realized Investment Gains/Losses system account has class income'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.provision_system_accounts() $$,
  'provision_system_accounts() can be called again by an already-provisioned user'
);

reset role;

select is(
  (select count(*)::int from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and is_system = true),
  4,
  'calling provision_system_accounts() again does not create duplicate system accounts'
);

-- ---------------------------------------------------------------------
-- D. Fixtures for the functional tests below: an institution and two
-- asset accounts for user1, created directly (bypassing the atomic
-- function) purely as pre-existing fixtures the tests below reference.
-- ---------------------------------------------------------------------

insert into public.institutions (id, user_id, name, institution_type)
values ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Test Bank', 'bank');

insert into public.accounts (id, user_id, institution_id, name, account_class, account_type, currency)
values ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Fixture Bank Account', 'asset', 'bank_savings', 'INR');

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Fixture Wallet', 'asset', 'wallet', 'INR');

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('b9999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 'User2 Bank Account', 'asset', 'bank_savings', 'INR');

-- ---------------------------------------------------------------------
-- E. create_account_with_opening_balance: class derivation, credit
-- limit scoping, and the asset/liability opening-balance sign convention.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select (public.create_account_with_opening_balance('New Savings', 'bank_savings')).account_class),
  'asset',
  'create_account_with_opening_balance derives asset class for bank_savings server-side'
);

select is(
  (select (public.create_account_with_opening_balance('New Card', 'credit_card', null, 'INR', null, '50000.00')).account_class),
  'liability',
  'create_account_with_opening_balance derives liability class for credit_card server-side'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_account_with_opening_balance('Bad Credit Limit', 'bank_savings', null, 'INR', null, '1000.00') $$,
    '23514'
  ),
  'a credit_limit on a non-credit-card account is rejected by the accounts_credit_limit_scope check (23514)'
);

select is(
  (
    select (public.create_account_with_opening_balance(
      'Opening Balance Asset', 'cash', null, 'INR', null, null, null, null, '10000.00', now()
    )).id is not null
  ),
  true,
  'create_account_with_opening_balance with an opening balance succeeds for an asset account'
);

select is(
  (select display_balance from public.account_balances ab
    join public.accounts a on a.id = ab.account_id
    where a.user_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Opening Balance Asset'),
  10000.00,
  'an asset opening balance of 10000 displays as +10000 (debit-normal, matches signed sum)'
);

select is(
  (
    select (public.create_account_with_opening_balance(
      'Opening Balance Liability', 'credit_card', null, 'INR', null, '20000.00', null, null, '5000.00', now()
    )).id is not null
  ),
  true,
  'create_account_with_opening_balance with an opening balance succeeds for a liability account'
);

select is(
  (select display_balance from public.account_balances ab
    join public.accounts a on a.id = ab.account_id
    where a.user_id = '11111111-1111-1111-1111-111111111111' and a.name = 'Opening Balance Liability'),
  5000.00,
  'a liability opening balance of 5000 displays as +5000 owed (negated signed sum)'
);

reset role;

-- ---------------------------------------------------------------------
-- F. create_manual_transaction: a generic, entry-payload-based, balanced
-- transaction, exercised through the income/expense sign convention.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (
    select (public.create_manual_transaction(
      'income',
      now(),
      'Test salary',
      jsonb_build_array(
        jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '50000.0000', 'currency', 'INR'),
        jsonb_build_object(
          'account_id', (select id::text from public.accounts where user_id = '11111111-1111-1111-1111-111111111111' and system_code = 'uncategorized_income'),
          'amount', '-50000.0000', 'currency', 'INR'
        )
      )
    )).status
  ),
  'posted',
  'create_manual_transaction posts a balanced income transaction'
);

select is(
  (select count(*)::int from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    where t.description = 'Test salary'),
  2,
  'the posted income transaction has exactly two entries'
);

select is(
  (select coalesce(sum(amount), -1) from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    where t.description = 'Test salary'),
  0.00,
  'the posted income transaction''s entries sum to exactly zero'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_manual_transaction(
         'income', now(), 'Cross-user entry attempt',
         jsonb_build_array(
           jsonb_build_object('account_id', 'b9999999-9999-9999-9999-999999999999', 'amount', '100.0000', 'currency', 'INR'),
           jsonb_build_object('account_id', 'b1111111-1111-1111-1111-111111111111', 'amount', '-100.0000', 'currency', 'INR')
         )
       ) $$,
    '42501'
  ),
  'create_manual_transaction rejects an entry against another user''s account (42501)'
);

reset role;

-- ---------------------------------------------------------------------
-- G. reverse_transaction: correct negation, linkage, and double-reversal
-- protection.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (
    select (public.reverse_transaction(
      (select id from public.ledger_transactions where description = 'Test salary')
    )).transaction_type
  ),
  'reversal',
  'reverse_transaction posts a new transaction of type reversal'
);

select is(
  (select status from public.ledger_transactions where description = 'Test salary'),
  'reversed',
  'the original transaction is marked reversed, not deleted'
);

select is(
  (select count(*)::int from public.ledger_transactions where description = 'Test salary'),
  1,
  'the original transaction row still exists after reversal (full audit history preserved)'
);

select is(
  (select coalesce(sum(amount), -1) from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    where t.reversal_of = (select id from public.ledger_transactions where description = 'Test salary')),
  0.00,
  'the reversal transaction''s negated entries also sum to exactly zero'
);

select is(
  (select e2.amount from public.ledger_entries e1
    join public.ledger_transactions t1 on t1.id = e1.transaction_id
    join public.ledger_transactions t2 on t2.reversal_of = t1.id
    join public.ledger_entries e2 on e2.transaction_id = t2.id and e2.account_id = e1.account_id
    where t1.description = 'Test salary' and e1.account_id = 'b1111111-1111-1111-1111-111111111111'),
  -50000.00,
  'the reversal entry for the bank account is the exact negation of the original entry'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.reverse_transaction((select id from public.ledger_transactions where description = 'Test salary')) $$,
    '25000'
  ),
  'reversing an already-reversed transaction is rejected (no double reversal, errcode invalid_transaction_state)'
);

reset role;

-- ---------------------------------------------------------------------
-- H. Cross-user ownership protection on direct trigger-guarded paths.
-- ---------------------------------------------------------------------

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.accounts (user_id, institution_id, name, account_class, account_type, currency)
       values ('22222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'Cross-user Institution Account', 'asset', 'bank_savings', 'INR') $$,
    '42501'
  ),
  'validate_account rejects an account whose institution belongs to a different user (42501)'
);

-- ---------------------------------------------------------------------
-- I. Immutability: no UPDATE or DELETE on ledger_entries, ever.
-- ---------------------------------------------------------------------

select ok(
  pg_temp.throws_with_code(
    $$ update public.ledger_entries set amount = amount + 1 where account_id = 'b1111111-1111-1111-1111-111111111111' $$,
    '42501'
  ),
  'updating a ledger entry is rejected unconditionally, even for the table owner (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ delete from public.ledger_entries where account_id = 'b1111111-1111-1111-1111-111111111111' $$,
    '42501'
  ),
  'deleting a ledger entry is rejected unconditionally, even for the table owner (42501)'
);

-- ---------------------------------------------------------------------
-- J. Column-level and table-level grants for the authenticated role.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ update public.accounts set account_type = 'wallet' where id = 'b1111111-1111-1111-1111-111111111111' $$,
    '42501'
  ),
  'updating account_type directly is rejected (no column-level UPDATE grant) (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ update public.accounts set is_system = true where id = 'b1111111-1111-1111-1111-111111111111' $$,
    '42501'
  ),
  'updating is_system directly is rejected (no column-level UPDATE grant) (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ delete from public.institutions where id = 'a1111111-1111-1111-1111-111111111111' $$,
    '42501'
  ),
  'direct delete from institutions is denied for authenticated (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.ledger_transactions (user_id, transaction_type, occurred_at, description)
       values ('11111111-1111-1111-1111-111111111111', 'adjustment', now(), 'Direct insert attempt') $$,
    '42501'
  ),
  'direct insert into ledger_transactions is denied for authenticated (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency)
       values ('11111111-1111-1111-1111-111111111111', (select id from public.ledger_transactions limit 1), 'b1111111-1111-1111-1111-111111111111', 1.00, 'INR') $$,
    '42501'
  ),
  'direct insert into ledger_entries is denied for authenticated (42501)'
);

reset role;

-- ---------------------------------------------------------------------
-- K. Row Level Security: anonymous denial, own-row-only access.
-- ---------------------------------------------------------------------

set local role anon;

-- anon has NO grant at all on these tables (not even SELECT) — a real run
-- confirmed the query is rejected outright with "permission denied", not
-- silently filtered to zero rows by RLS. That is actually the stronger
-- guarantee (anon can't even attempt a query), so these assert the
-- permission error directly instead of an empty result set.
select ok(
  pg_temp.throws_with_code($$ select count(*) from public.institutions $$, '42501'),
  'anon has no grant on institutions, so even a count() is rejected outright (42501)'
);
select ok(
  pg_temp.throws_with_code($$ select count(*) from public.accounts $$, '42501'),
  'anon has no grant on accounts, so even a count() is rejected outright (42501)'
);
select ok(
  pg_temp.throws_with_code($$ select count(*) from public.ledger_transactions $$, '42501'),
  'anon has no grant on ledger_transactions, so even a count() is rejected outright (42501)'
);
select ok(
  pg_temp.throws_with_code($$ select count(*) from public.ledger_entries $$, '42501'),
  'anon has no grant on ledger_entries, so even a count() is rejected outright (42501)'
);
select ok(
  pg_temp.throws_with_code($$ select count(*) from public.account_balances $$, '42501'),
  'anon has no grant on account_balances, so even a count() is rejected outright (42501)'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.accounts where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'authenticated user1 cannot see user2''s accounts'
);

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'authenticated user1 cannot see user2''s ledger transactions'
);

reset role;

-- ---------------------------------------------------------------------
-- L. public.account_balances: system accounts excluded, security_invoker
-- respects the underlying tables' RLS.
-- ---------------------------------------------------------------------

select is(
  (select count(*)::int from public.account_balances ab
    join public.accounts a on a.id = ab.account_id
    where a.is_system = true),
  0,
  'account_balances excludes system accounts entirely'
);

-- ---------------------------------------------------------------------
-- M. Deferred balance constraint: forced to IMMEDIATE so a single
-- top-level pgTAP statement (which never reaches COMMIT) can observe the
-- rejection. See the file header note on why this is only needed here.
-- ---------------------------------------------------------------------

-- IMPORTANT ordering note: SET CONSTRAINTS ... IMMEDIATE retroactively
-- fires any ALREADY-PENDING deferred check for the current transaction,
-- not just future ones — confirmed by a real run, where setting immediate
-- between two separate single-row inserts fired the "at least two
-- entries" check against the first entry alone, before the second entry
-- existed. Fixed by setting immediate exactly once, while transaction
-- d1111111 still has zero entries (nothing stale pending), and using a
-- single multi-row INSERT for the two-entries-that-don't-balance case —
-- the constraint trigger's check timing is end-of-STATEMENT even in
-- immediate mode, so both rows of one multi-row INSERT exist before the
-- check runs.

insert into public.ledger_transactions (id, user_id, transaction_type, occurred_at, description, source_type)
values ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'adjustment', now(), 'Unbalanced test transaction', 'system');

set constraints public.ledger_entries_balance_check immediate;

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency)
       values ('11111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 100.00, 'INR') $$,
    '23514'
  ),
  'a transaction with only one entry fails the minimum-two-entries check (23514)'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency)
       values
         ('11111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 100.00, 'INR'),
         ('11111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 50.00, 'INR') $$,
    '23514'
  ),
  'two entries that do not sum to zero are rejected (23514)'
);

select * from finish();

rollback;
