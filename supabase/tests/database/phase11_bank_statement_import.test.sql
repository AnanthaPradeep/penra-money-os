-- pgTAP tests for Phase 11: bank statement import, CSV parsing,
-- reconciliation, duplicate detection, and account matching (see
-- supabase/migrations/20260825154818_phase11_bank_statement_import_v2.sql).

begin;

select plan(121);

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

-- Fixed literal ids:
--   user1   = 55555555-5555-5555-5555-555555555555
--   user2   = 66666666-6666-6666-6666-666666666666
--   bank1   = d1111111-1111-1111-1111-111111111111 (user1, bank_savings)
--   bank1b  = d1111111-1111-1111-1111-111111111112 (user1, bank_savings, transfer counterpart)
--   cc1     = d1111111-1111-1111-1111-111111111113 (user1, credit_card)
--   arch1   = d1111111-1111-1111-1111-111111111114 (user1, bank_savings, archived)
--   bank2   = d2222222-2222-2222-2222-222222222222 (user2, bank_savings)

insert into auth.users (id, email, raw_user_meta_data)
values ('55555555-5555-5555-5555-555555555555', 'pgtap-phase11-one@example.com', '{}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('66666666-6666-6666-6666-666666666666', 'pgtap-phase11-two@example.com', '{}'::jsonb);

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('d1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'User1 Bank', 'asset', 'bank_savings', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('d1111111-1111-1111-1111-111111111112', '55555555-5555-5555-5555-555555555555', 'User1 Second Bank', 'asset', 'bank_savings', 'INR');
insert into public.accounts (id, user_id, name, account_class, account_type, currency, credit_limit)
values ('d1111111-1111-1111-1111-111111111113', '55555555-5555-5555-5555-555555555555', 'User1 Credit Card', 'liability', 'credit_card', 'INR', 100000);
insert into public.accounts (id, user_id, name, account_class, account_type, currency, is_archived)
values ('d1111111-1111-1111-1111-111111111114', '55555555-5555-5555-5555-555555555555', 'User1 Archived', 'asset', 'bank_savings', 'INR', true);
insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('d2222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', 'User2 Bank', 'asset', 'bank_savings', 'INR');

-- ---------------------------------------------------------------------
-- A. Schema: tables, RLS, minimum grants.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'statement_imports'), 'public.statement_imports table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'statement_import_rows'), 'public.statement_import_rows table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'statement_column_mappings'), 'public.statement_column_mappings table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'statement_import_rules'), 'public.statement_import_rules table exists');
select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'statement_import_row_matches'), 'public.statement_import_row_matches table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.statement_imports'::regclass), 'RLS enabled on statement_imports');
select ok((select relforcerowsecurity from pg_class where oid = 'public.statement_imports'::regclass), 'RLS forced on statement_imports');
select ok((select relrowsecurity from pg_class where oid = 'public.statement_import_rows'::regclass), 'RLS enabled on statement_import_rows');
select ok((select relforcerowsecurity from pg_class where oid = 'public.statement_import_rows'::regclass), 'RLS forced on statement_import_rows');
select ok((select relrowsecurity from pg_class where oid = 'public.statement_column_mappings'::regclass), 'RLS enabled on statement_column_mappings');
select ok((select relforcerowsecurity from pg_class where oid = 'public.statement_column_mappings'::regclass), 'RLS forced on statement_column_mappings');
select ok((select relrowsecurity from pg_class where oid = 'public.statement_import_rules'::regclass), 'RLS enabled on statement_import_rules');
select ok((select relforcerowsecurity from pg_class where oid = 'public.statement_import_rules'::regclass), 'RLS forced on statement_import_rules');
select ok((select relrowsecurity from pg_class where oid = 'public.statement_import_row_matches'::regclass), 'RLS enabled on statement_import_row_matches');
select ok((select relforcerowsecurity from pg_class where oid = 'public.statement_import_row_matches'::regclass), 'RLS forced on statement_import_row_matches');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'statement_imports' and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated has no direct write grant on statement_imports (RPC-mediated only)'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'statement_import_rows' and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0,
  'authenticated has no direct write grant on statement_import_rows (RPC-mediated only)'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name in ('statement_imports', 'statement_import_rows', 'statement_import_row_matches')
      and grantee = 'authenticated' and privilege_type = 'DELETE'),
  0,
  'authenticated cannot hard-delete a statement_imports/rows/matches row through any grant'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'statement_column_mappings' and grantee = 'authenticated'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  4,
  'authenticated has full direct CRUD on the private statement_column_mappings preference table'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'statement_import_rules' and grantee = 'authenticated'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  4,
  'authenticated has full direct CRUD on the private statement_import_rules preference table'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name in ('statement_imports', 'statement_import_rows', 'statement_column_mappings', 'statement_import_rules', 'statement_import_row_matches')
      and grantee in ('anon', 'public')),
  0,
  'anon/public have zero grants on any Phase 11 table'
);

-- ---------------------------------------------------------------------
-- B. create_statement_import.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_statement_import(
    'd1111111-1111-1111-1111-111111111111', 'statement.csv', repeat('a', 64), 'csv', 1024, ',', 'utf-8', repeat('h', 64), 'INR', 3
  ) $$,
  'user1 can create an import for their own account'
);
create temp table pg_temp.import1 as
  select import_id from public.create_statement_import(
    'd1111111-1111-1111-1111-111111111111', 'statement.csv', repeat('a', 64), 'csv', 1024, ',', 'utf-8', repeat('h', 64), 'INR', 3
  );
grant select on pg_temp.import1 to authenticated;

select is(
  (select status from public.statement_imports where id = (select import_id from pg_temp.import1)),
  'mapping_required',
  'a freshly created import starts in mapping_required'
);

select ok(
  pg_temp.throws_with_code(
    $$ select public.create_statement_import('d2222222-2222-2222-2222-222222222222', 'statement.csv', repeat('a', 64), 'csv', 1024, ',', 'utf-8', repeat('h', 64), 'INR', 3) $$,
    '42501'
  ),
  'user1 cannot create an import against user2''s account'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.create_statement_import('d1111111-1111-1111-1111-111111111114', 'statement.csv', repeat('a', 64), 'csv', 1024, ',', 'utf-8', repeat('h', 64), 'INR', 3) $$,
    '22023'
  ),
  'importing into an archived account is rejected'
);
select ok(
  pg_temp.throws_with_code(
    $$ select public.create_statement_import('d1111111-1111-1111-1111-111111111111', 'statement.csv', repeat('a', 64), 'csv', 1024, ',', 'utf-8', repeat('h', 64), 'USD', 3) $$,
    '22023'
  ),
  'a statement currency mismatched with the account currency is rejected'
);

select is(
  (select is_duplicate_file from public.create_statement_import(
    'd1111111-1111-1111-1111-111111111111', 'statement.csv', repeat('a', 64), 'csv', 1024, ',', 'utf-8', repeat('h', 64), 'INR', 3
  )),
  true,
  're-uploading the same file hash to the same account is flagged as a duplicate file (not blocked)'
);

reset role;

-- ---------------------------------------------------------------------
-- C. Mapping and row insertion.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    $$ select public.update_statement_import_row(gen_random_uuid(), 'include') $$,
    '42501'
  ),
  'update_statement_import_row on a non-existent row is rejected'
);

select lives_ok(
  format(
    $$ select public.apply_statement_import_mapping(%L, 'Date', 'Description', 'DD/MM/YYYY', null, 'Reference', 'Debit', 'Credit', null, null, null, 'debit_negative', null) $$,
    (select import_id from pg_temp.import1)
  ),
  'user1 can confirm a column mapping for their own import'
);
select is(
  (select date_column from public.statement_imports where id = (select import_id from pg_temp.import1)),
  'Date',
  'the confirmed mapping is denormalized onto statement_imports'
);
select is(
  (select status from public.statement_imports where id = (select import_id from pg_temp.import1)),
  'mapping_required',
  'applying the mapping alone does not yet advance status past mapping_required'
);

select lives_ok(
  format(
    $$ select public.insert_statement_import_rows(%L, %L::jsonb) $$,
    (select import_id from pg_temp.import1),
    '[
      {"row_index": 0, "row_hash": "h0", "transaction_date": "2026-03-05", "description": "Grocery", "amount": "500.0000", "direction": "debit", "currency": "INR", "suggested_transaction_type": "expense", "validation_errors": []},
      {"row_index": 1, "row_hash": "h1", "transaction_date": "2026-03-06", "description": "Salary", "amount": "50000.0000", "direction": "credit", "currency": "INR", "suggested_transaction_type": "income", "validation_errors": []},
      {"row_index": 2, "row_hash": "h0", "transaction_date": "2026-03-05", "description": "Grocery", "amount": "500.0000", "direction": "debit", "currency": "INR", "suggested_transaction_type": "expense", "validation_errors": []}
    ]'
  ),
  'insert_statement_import_rows accepts a batch of normalized rows'
);
select is(
  (select status from public.statement_imports where id = (select import_id from pg_temp.import1)),
  'parsed',
  'inserting rows advances the import to parsed'
);
select is(
  (select count(*)::int from public.statement_import_rows where import_id = (select import_id from pg_temp.import1)),
  3,
  'all three rows were inserted'
);
select is(
  (select duplicate_status from public.statement_import_rows where import_id = (select import_id from pg_temp.import1) and row_index = 2),
  'exact_row_duplicate',
  'the second occurrence of the same row_hash within one import is flagged exact_row_duplicate'
);
select is(
  (select user_decision from public.statement_import_rows where import_id = (select import_id from pg_temp.import1) and row_index = 2),
  'exclude',
  'an exact_row_duplicate row is auto-excluded'
);
select is(
  (select user_decision from public.statement_import_rows where import_id = (select import_id from pg_temp.import1) and row_index = 0),
  'pending',
  'a non-duplicate row starts pending, never auto-included'
);

select ok(
  pg_temp.throws_with_code(
    format($$ select public.insert_statement_import_rows(%L, '[]'::jsonb) $$, (select import_id from pg_temp.import1)),
    '22023'
  ),
  'insert_statement_import_rows rejects a second call once the import has left mapping_required'
);

select lives_ok(
  format(
    $$ select public.apply_statement_import_row_analysis(%L, '[]'::jsonb, '[]'::jsonb) $$,
    (select import_id from pg_temp.import1)
  ),
  'apply_statement_import_row_analysis accepts an empty analysis pass'
);
select is(
  (select status from public.statement_imports where id = (select import_id from pg_temp.import1)),
  'reviewing',
  'analysis advances the import to reviewing'
);

reset role;

-- ---------------------------------------------------------------------
-- D. Cross-user isolation on rows/imports.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

select is(
  (select count(*)::int from public.statement_imports where id = (select import_id from pg_temp.import1)),
  0,
  'user2 cannot see user1''s import through RLS'
);
select is(
  (select count(*)::int from public.statement_import_rows where import_id = (select import_id from pg_temp.import1)),
  0,
  'user2 cannot see user1''s import rows through RLS'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.mark_statement_import_ready(%L) $$, (select import_id from pg_temp.import1)),
    '42501'
  ),
  'user2 cannot mark user1''s import ready'
);
select ok(
  pg_temp.throws_with_code(
    format(
      $$ select public.update_statement_import_row((select id from public.statement_import_rows where import_id = %L limit 1), 'include') $$,
      (select import_id from pg_temp.import1)
    ),
    '42501'
  ),
  'user2 cannot update a row belonging to user1''s import (subselect returns null -> not-found rejection)'
);

reset role;

-- ---------------------------------------------------------------------
-- E. Review edits and bulk actions (user1).
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

create temp table pg_temp.row0 as
  select id from public.statement_import_rows where import_id = (select import_id from pg_temp.import1) and row_index = 0;
create temp table pg_temp.row1 as
  select id from public.statement_import_rows where import_id = (select import_id from pg_temp.import1) and row_index = 1;
grant select on pg_temp.row0 to authenticated;
grant select on pg_temp.row1 to authenticated;

select lives_ok(
  format($$ select public.update_statement_import_row(%L, 'include', null, null, 'expense') $$, (select id from pg_temp.row0)),
  'user1 can mark their own row included with a resolved type'
);
select is(
  (select user_decision from public.statement_import_rows where id = (select id from pg_temp.row0)),
  'include',
  'the decision was saved'
);

select lives_ok(
  format($$ select public.bulk_update_statement_import_rows(%L, array[%L]::uuid[], 'include') $$, (select import_id from pg_temp.import1), (select id from pg_temp.row1)),
  'bulk_update_statement_import_rows updates the targeted row'
);
select is(
  (select user_decision from public.statement_import_rows where id = (select id from pg_temp.row1)),
  'include',
  'the bulk-included row is now include'
);
select lives_ok(
  format(
    $$ select public.bulk_update_statement_import_rows(%L, array[(select id from public.statement_import_rows where import_id = %L and row_index = 2)]::uuid[], 'include') $$,
    (select import_id from pg_temp.import1), (select import_id from pg_temp.import1)
  ),
  'a bulk-include call targeting a hard duplicate row does not error'
);
select is(
  (select user_decision from public.statement_import_rows where import_id = (select import_id from pg_temp.import1) and row_index = 2),
  'exclude',
  'bulk-include never overrides an exact_row_duplicate row''s exclude decision'
);

select lives_ok(
  format($$ select public.update_statement_import_row(%L, null, null, null, null, null, 'a personal note') $$, (select id from pg_temp.row1)),
  'a row''s notes can be edited independently of its decision'
);

reset role;

-- ---------------------------------------------------------------------
-- F. Existing-transaction linking.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_manual_transaction(
    'income', now(), 'Existing salary', jsonb_build_array(
      jsonb_build_object('account_id', 'd1111111-1111-1111-1111-111111111111', 'amount', '50000.0000'),
      jsonb_build_object('account_id', (select id from public.accounts where user_id = '55555555-5555-5555-5555-555555555555' and is_system and system_code = 'uncategorized_income'), 'amount', '-50000.0000')
    )
  ) $$,
  'a pre-existing posted transaction is created to link against'
);
create temp table pg_temp.existing_txn as
  select id from public.ledger_transactions where user_id = '55555555-5555-5555-5555-555555555555' and description = 'Existing salary';
grant select on pg_temp.existing_txn to authenticated;

select lives_ok(
  format($$ select public.link_statement_import_row_to_transaction(%L, %L) $$, (select id from pg_temp.row1), (select id from pg_temp.existing_txn)),
  'user1 can link a row to their own existing posted transaction'
);
select is(
  (select linked_existing_transaction_id from public.statement_import_rows where id = (select id from pg_temp.row1)),
  (select id from pg_temp.existing_txn),
  'the link was recorded'
);
select is(
  (select match_status from public.statement_import_rows where id = (select id from pg_temp.row1)),
  'existing_match_confirmed',
  'linking sets match_status to existing_match_confirmed'
);
select ok(
  pg_temp.throws_with_code(
    format(
      $$ select public.link_statement_import_row_to_transaction((select id from public.statement_import_rows where import_id = %L and row_index = 0), %L) $$,
      (select import_id from pg_temp.import1), (select id from pg_temp.existing_txn)
    ),
    -- link_statement_import_row_to_transaction's own explicit
    -- already-claimed check (22023) fires before the row-level unique
    -- index on linked_existing_transaction_id could ever be reached —
    -- the RPC's application-level error is what a caller actually sees.
    '22023'
  ),
  'a second row cannot claim a transaction another row already linked'
);

select lives_ok(
  format($$ select public.unlink_statement_import_row(%L) $$, (select id from pg_temp.row1)),
  'user1 can undo their own link'
);
select is(
  (select linked_existing_transaction_id from public.statement_import_rows where id = (select id from pg_temp.row1)),
  null,
  'unlinking clears the link'
);
-- Re-link row1 so the batch-posting section below can exercise the linked path.
select public.link_statement_import_row_to_transaction((select id from pg_temp.row1), (select id from pg_temp.existing_txn));

reset role;

-- ---------------------------------------------------------------------
-- G. Transfer matching — a second import on bank1b with the opposite leg.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

create temp table pg_temp.import2 as
  select import_id from public.create_statement_import(
    'd1111111-1111-1111-1111-111111111112', 'statement2.csv', repeat('b', 64), 'csv', 1024, ',', 'utf-8', repeat('i', 64), 'INR', 1
  );
grant select on pg_temp.import2 to authenticated;

select public.apply_statement_import_mapping((select import_id from pg_temp.import2), 'Date', 'Description', 'DD/MM/YYYY', null, null, null, null, 'Amount', null, null, 'debit_negative', null);
select public.insert_statement_import_rows(
  (select import_id from pg_temp.import2),
  '[{"row_index": 0, "row_hash": "t0", "transaction_date": "2026-03-07", "description": "To second bank", "amount": "2000.0000", "direction": "credit", "currency": "INR", "suggested_transaction_type": "income", "validation_errors": []}]'::jsonb
);
select public.apply_statement_import_row_analysis((select import_id from pg_temp.import2), '[]'::jsonb, '[]'::jsonb);

create temp table pg_temp.import3 as
  select import_id from public.create_statement_import(
    'd1111111-1111-1111-1111-111111111111', 'statement3.csv', repeat('c', 64), 'csv', 1024, ',', 'utf-8', repeat('j', 64), 'INR', 1
  );
grant select on pg_temp.import3 to authenticated;
select public.apply_statement_import_mapping((select import_id from pg_temp.import3), 'Date', 'Description', 'DD/MM/YYYY', null, null, null, null, 'Amount', null, null, 'debit_negative', null);
select public.insert_statement_import_rows(
  (select import_id from pg_temp.import3),
  '[{"row_index": 0, "row_hash": "t1", "transaction_date": "2026-03-07", "description": "To second bank", "amount": "2000.0000", "direction": "debit", "currency": "INR", "suggested_transaction_type": "expense", "validation_errors": []}]'::jsonb
);
select public.apply_statement_import_row_analysis((select import_id from pg_temp.import3), '[]'::jsonb, '[]'::jsonb);

create temp table pg_temp.transfer_row_a as
  select id, import_id from public.statement_import_rows where import_id = (select import_id from pg_temp.import2) and row_index = 0;
create temp table pg_temp.transfer_row_b as
  select id, import_id from public.statement_import_rows where import_id = (select import_id from pg_temp.import3) and row_index = 0;
grant select on pg_temp.transfer_row_a to authenticated;
grant select on pg_temp.transfer_row_b to authenticated;

select ok(
  pg_temp.throws_with_code(
    format($$ select public.confirm_statement_transfer_match(%L, %L) $$, (select id from pg_temp.transfer_row_a), (select id from pg_temp.row0)),
    '22023'
  ),
  'a transfer match with an unequal amount is rejected'
);

select lives_ok(
  format($$ select public.confirm_statement_transfer_match(%L, %L) $$, (select id from pg_temp.transfer_row_a), (select id from pg_temp.transfer_row_b)),
  'user1 can confirm a valid cross-import transfer match (equal amount, opposite direction, different accounts)'
);
select isnt(
  (select transfer_group_id from public.statement_import_rows where id = (select id from pg_temp.transfer_row_a)),
  null,
  'confirming the match assigns a transfer_group_id'
);
select is(
  (select transfer_group_id from public.statement_import_rows where id = (select id from pg_temp.transfer_row_a)),
  (select transfer_group_id from public.statement_import_rows where id = (select id from pg_temp.transfer_row_b)),
  'both sides of the pair share the same transfer_group_id'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.confirm_statement_transfer_match(%L, %L) $$, (select id from pg_temp.transfer_row_a), (select id from pg_temp.row0)),
    '22023'
  ),
  'a row already in a transfer group cannot be matched again'
);

reset role;

-- ---------------------------------------------------------------------
-- H. Lifecycle transitions.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select ok(
  pg_temp.throws_with_code(
    format($$ update public.statement_imports set status = 'completed' where id = %L $$, (select import_id from pg_temp.import1)),
    '42501'
  ),
  'authenticated cannot forge status directly via UPDATE (no grant) — must go through an RPC'
);

select lives_ok(
  format($$ select public.mark_statement_import_ready(%L) $$, (select import_id from pg_temp.import1)),
  'user1 can mark their own reviewing import ready'
);
select is(
  (select status from public.statement_imports where id = (select import_id from pg_temp.import1)),
  'ready',
  'the import is now ready'
);
select lives_ok(
  format($$ select public.revert_statement_import_to_reviewing(%L) $$, (select import_id from pg_temp.import1)),
  'user1 can revert a ready import back to reviewing'
);
select lives_ok(
  format($$ select public.update_statement_import_row(%L, 'include') $$, (select id from pg_temp.row0)),
  'a reverted-to-reviewing import accepts row edits again'
);
select lives_ok(
  format($$ select public.mark_statement_import_ready(%L) $$, (select import_id from pg_temp.import1)),
  're-marking ready succeeds'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.mark_statement_import_ready(%L) $$, (select import_id from pg_temp.import1)),
    '22023'
  ),
  'mark_statement_import_ready on an import that is already ready (not reviewing) is rejected'
);

reset role;

-- ---------------------------------------------------------------------
-- I. Posting: happy path, sum-to-zero, linked/transfer rows, idempotent retry.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select is(
  (select count(*)::int from public.ledger_transactions where user_id = '55555555-5555-5555-5555-555555555555' and description = 'Grocery'),
  0,
  'before posting, no transaction exists yet for the plain (unlinked, non-duplicate) row -- pre-confirmation non-mutation'
);

create temp table pg_temp.post_result1 as
  select * from public.post_statement_import_batch((select import_id from pg_temp.import1));
grant select on pg_temp.post_result1 to authenticated;

select is((select success from pg_temp.post_result1), true, 'posting import1 succeeds');
select is((select posted_count from pg_temp.post_result1), 1, 'exactly one plain row was newly posted (row0)');
select is((select linked_count from pg_temp.post_result1), 1, 'exactly one row was linked to an existing transaction (row1)');
select is(
  (select status from public.statement_imports where id = (select import_id from pg_temp.import1)),
  'completed',
  'import1 is now completed'
);

select is(
  (select posting_result from public.statement_import_rows where id = (select id from pg_temp.row0)),
  'created',
  'row0 posting_result is created'
);
select isnt(
  (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.row0)),
  null,
  'row0 now has a created transaction linked'
);
select is(
  (select posting_result from public.statement_import_rows where id = (select id from pg_temp.row1)),
  'linked',
  'row1 (existing-transaction link) posting_result is linked, not created'
);
select is(
  (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.row1)),
  null,
  'linking to an existing transaction never creates a second (new) transaction for that row'
);

select is(
  (select count(*)::int from public.ledger_entries e join public.ledger_transactions t on t.id = e.transaction_id
    where t.id = (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.row0))),
  2,
  'the newly created transaction has exactly two entries'
);
select is(
  (select sum(amount) from public.ledger_entries where transaction_id = (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.row0))),
  0::numeric,
  'the newly created transaction''s entries sum to exactly zero'
);

-- Retry safety: posting an already-completed import is a safe, idempotent no-op.
create temp table pg_temp.post_result1_retry as
  select * from public.post_statement_import_batch((select import_id from pg_temp.import1));
grant select on pg_temp.post_result1_retry to authenticated;
select is((select success from pg_temp.post_result1_retry), false, 'retrying post on an already-completed import reports failure rather than reposting');
select is((select error_code from pg_temp.post_result1_retry), 'invalid_status', 'the retry is rejected with invalid_status, not a partial repost');
select is(
  (select count(*)::int from public.ledger_transactions where user_id = '55555555-5555-5555-5555-555555555555' and description = 'Grocery'),
  1,
  'the retry did not create a duplicate Grocery transaction'
);

-- Transfer pair posting (import2 + import3): confirm both statuses first.
select public.mark_statement_import_ready((select import_id from pg_temp.import2));
select public.mark_statement_import_ready((select import_id from pg_temp.import3));

create temp table pg_temp.post_result2 as
  select * from public.post_statement_import_batch((select import_id from pg_temp.import2));
grant select on pg_temp.post_result2 to authenticated;
select is((select success from pg_temp.post_result2), true, 'posting import2 (first leg of the transfer) succeeds');
select is((select transfer_count from pg_temp.post_result2), 1, 'import2 posts one transfer-path row');

create temp table pg_temp.post_result3 as
  select * from public.post_statement_import_batch((select import_id from pg_temp.import3));
grant select on pg_temp.post_result3 to authenticated;
select is((select success from pg_temp.post_result3), true, 'posting import3 (second leg of the transfer) succeeds');
select is((select transfer_count from pg_temp.post_result3), 1, 'import3 posts one transfer-path row');

select is(
  (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.transfer_row_a)),
  (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.transfer_row_b)),
  'both legs of the transfer link to exactly the same single created transaction'
);
select is(
  (select count(*)::int from public.ledger_transactions where id = (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.transfer_row_a))),
  1,
  'exactly one transaction exists for the whole transfer pair (never a separate expense+income pair)'
);
select is(
  (select posting_result from public.statement_import_rows where id = (select id from pg_temp.transfer_row_a)),
  'transfer_created',
  'the first leg to post creates the transaction'
);
select is(
  (select posting_result from public.statement_import_rows where id = (select id from pg_temp.transfer_row_b)),
  'transfer_linked',
  'the second leg to post links to the transaction the first leg already created'
);

reset role;

-- ---------------------------------------------------------------------
-- J. Credit-card-payment transfer semantics.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

create temp table pg_temp.import_cc_bank as
  select import_id from public.create_statement_import('d1111111-1111-1111-1111-111111111111', 'cc_pay_bank.csv', repeat('d', 64), 'csv', 1024, ',', 'utf-8', repeat('k', 64), 'INR', 1);
create temp table pg_temp.import_cc_card as
  select import_id from public.create_statement_import('d1111111-1111-1111-1111-111111111113', 'cc_pay_card.csv', repeat('e', 64), 'csv', 1024, ',', 'utf-8', repeat('l', 64), 'INR', 1);
grant select on pg_temp.import_cc_bank to authenticated;
grant select on pg_temp.import_cc_card to authenticated;

select public.apply_statement_import_mapping((select import_id from pg_temp.import_cc_bank), 'Date', 'Description', 'DD/MM/YYYY', null, null, null, null, 'Amount', null, null, 'debit_negative', null);
select public.insert_statement_import_rows(
  (select import_id from pg_temp.import_cc_bank),
  '[{"row_index": 0, "row_hash": "cc0", "transaction_date": "2026-03-10", "description": "CC payment", "amount": "3000.0000", "direction": "debit", "currency": "INR", "suggested_transaction_type": "expense", "validation_errors": []}]'::jsonb
);
select public.apply_statement_import_row_analysis((select import_id from pg_temp.import_cc_bank), '[]'::jsonb, '[]'::jsonb);

select public.apply_statement_import_mapping((select import_id from pg_temp.import_cc_card), 'Date', 'Description', 'DD/MM/YYYY', null, null, null, null, 'Amount', null, null, 'debit_negative', null);
select public.insert_statement_import_rows(
  (select import_id from pg_temp.import_cc_card),
  '[{"row_index": 0, "row_hash": "cc1", "transaction_date": "2026-03-10", "description": "Payment received", "amount": "3000.0000", "direction": "credit", "currency": "INR", "suggested_transaction_type": "credit_card_payment", "validation_errors": []}]'::jsonb
);
select public.apply_statement_import_row_analysis((select import_id from pg_temp.import_cc_card), '[]'::jsonb, '[]'::jsonb);

create temp table pg_temp.cc_bank_row as select id from public.statement_import_rows where import_id = (select import_id from pg_temp.import_cc_bank) and row_index = 0;
create temp table pg_temp.cc_card_row as select id from public.statement_import_rows where import_id = (select import_id from pg_temp.import_cc_card) and row_index = 0;
grant select on pg_temp.cc_bank_row to authenticated;
grant select on pg_temp.cc_card_row to authenticated;

select public.confirm_statement_transfer_match((select id from pg_temp.cc_bank_row), (select id from pg_temp.cc_card_row));
select is(
  (select resolved_transaction_type from public.statement_import_rows where id = (select id from pg_temp.cc_bank_row)),
  'credit_card_payment',
  'a transfer touching a credit-card account resolves to credit_card_payment, not a plain transfer'
);

select public.mark_statement_import_ready((select import_id from pg_temp.import_cc_bank));
select public.mark_statement_import_ready((select import_id from pg_temp.import_cc_card));
select public.post_statement_import_batch((select import_id from pg_temp.import_cc_bank));
select public.post_statement_import_batch((select import_id from pg_temp.import_cc_card));

select is(
  (select transaction_type from public.ledger_transactions where id = (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.cc_bank_row))),
  'credit_card_payment',
  'the posted transaction is a credit_card_payment, never a plain transfer or an expense'
);
select is(
  (select e.amount from public.ledger_entries e where e.transaction_id = (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.cc_bank_row)) and e.account_id = 'd1111111-1111-1111-1111-111111111113'),
  3000.0000,
  'the credit card account receives the positive (liability-reducing) entry'
);
select is(
  (select e.amount from public.ledger_entries e where e.transaction_id = (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.cc_bank_row)) and e.account_id = 'd1111111-1111-1111-1111-111111111111'),
  -3000.0000,
  'the paying bank account receives the negative entry'
);

reset role;

-- ---------------------------------------------------------------------
-- K. Discard: pre-posting allowed and preserves rows; post-posting blocked.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

create temp table pg_temp.import_discard as
  select import_id from public.create_statement_import('d1111111-1111-1111-1111-111111111111', 'discard_me.csv', repeat('f', 64), 'csv', 1024, ',', 'utf-8', repeat('m', 64), 'INR', 1);
grant select on pg_temp.import_discard to authenticated;
select public.apply_statement_import_mapping((select import_id from pg_temp.import_discard), 'Date', 'Description', 'DD/MM/YYYY', null, null, null, null, 'Amount', null, null, 'debit_negative', null);
select public.insert_statement_import_rows(
  (select import_id from pg_temp.import_discard),
  '[{"row_index": 0, "row_hash": "z0", "transaction_date": "2026-03-11", "description": "Discard test", "amount": "100.0000", "direction": "debit", "currency": "INR", "suggested_transaction_type": "expense", "validation_errors": []}]'::jsonb
);

select lives_ok(
  format($$ select public.discard_statement_import(%L) $$, (select import_id from pg_temp.import_discard)),
  'a not-yet-posted import can be discarded'
);
select is(
  (select status from public.statement_imports where id = (select import_id from pg_temp.import_discard)),
  'discarded',
  'the import is now discarded'
);
select is(
  (select count(*)::int from public.statement_import_rows where import_id = (select import_id from pg_temp.import_discard)),
  1,
  'discarding never deletes the staged rows -- they remain for audit'
);

select ok(
  pg_temp.throws_with_code(
    format($$ select public.discard_statement_import(%L) $$, (select import_id from pg_temp.import1)),
    '22023'
  ),
  'a completed (posted) import cannot be discarded'
);

reset role;

-- ---------------------------------------------------------------------
-- L. Rules CRUD and cross-user isolation.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select lives_ok(
  $$ select public.save_statement_import_rule(
    p_name => 'Swiggy expense', p_match_field => 'description_contains', p_match_value => 'swiggy',
    p_direction_filter => 'debit', p_suggested_transaction_type => 'expense', p_priority => 5
  ) $$,
  'user1 can save a categorization rule'
);
create temp table pg_temp.rule1 as select id from public.statement_import_rules where user_id = '55555555-5555-5555-5555-555555555555' and match_value = 'swiggy';
grant select on pg_temp.rule1 to authenticated;

select lives_ok(
  format(
    $$ select public.save_statement_import_rule(
      p_name => 'Updated', p_match_field => 'description_contains', p_match_value => 'swiggy',
      p_rule_id => %L, p_suggested_transaction_type => 'expense', p_priority => 9
    ) $$,
    (select id from pg_temp.rule1)
  ),
  'user1 can update their own rule by id'
);
select is(
  (select priority from public.statement_import_rules where id = (select id from pg_temp.rule1)),
  9,
  'the rule update was applied'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

select is(
  (select count(*)::int from public.statement_import_rules where id = (select id from pg_temp.rule1)),
  0,
  'user2 cannot see user1''s rule through RLS'
);
select ok(
  pg_temp.throws_with_code(
    format($$ select public.delete_statement_import_rule(%L) $$, (select id from pg_temp.rule1)),
    '42501'
  ),
  'user2 cannot delete user1''s rule'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select lives_ok(
  format($$ select public.delete_statement_import_rule(%L) $$, (select id from pg_temp.rule1)),
  'user1 can delete their own rule'
);
select is(
  (select count(*)::int from public.statement_import_rules where id = (select id from pg_temp.rule1)),
  0,
  'the rule is gone after deletion'
);

reset role;

-- ---------------------------------------------------------------------
-- M. Exact-decimal precision roundtrip.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

create temp table pg_temp.import_decimal as
  select import_id from public.create_statement_import('d1111111-1111-1111-1111-111111111111', 'decimal.csv', repeat('g', 64), 'csv', 1024, ',', 'utf-8', repeat('n', 64), 'INR', 1);
grant select on pg_temp.import_decimal to authenticated;
select public.apply_statement_import_mapping((select import_id from pg_temp.import_decimal), 'Date', 'Description', 'DD/MM/YYYY', null, null, null, null, 'Amount', null, null, 'debit_negative', null);
select public.insert_statement_import_rows(
  (select import_id from pg_temp.import_decimal),
  '[{"row_index": 0, "row_hash": "dec0", "transaction_date": "2026-03-12", "description": "Precise", "amount": "1234.5678", "direction": "debit", "currency": "INR", "suggested_transaction_type": "expense", "validation_errors": []}]'::jsonb
);
select is(
  (select amount from public.statement_import_rows where import_id = (select import_id from pg_temp.import_decimal) and row_index = 0),
  1234.5678::numeric,
  'a 4-decimal-place amount round-trips through insert_statement_import_rows with no rounding loss'
);

reset role;

-- ---------------------------------------------------------------------
-- N. Wallet pre-assignment + rule-conflict flag (Phase 13 follow-up —
--    20260828093000_phase13_bank_import_wallet_and_rule_conflict.sql).
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

create temp table pg_temp.wallet1 as select * from public.create_purpose_wallet(p_name => 'Groceries Wallet');
grant select on pg_temp.wallet1 to authenticated;

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';

create temp table pg_temp.wallet2 as select * from public.create_purpose_wallet(p_name => 'Other User Wallet');
grant select on pg_temp.wallet2 to authenticated;

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

create temp table pg_temp.import_wallet as
  select import_id from public.create_statement_import(
    'd1111111-1111-1111-1111-111111111111', 'wallet_test.csv', repeat('w', 64), 'csv', 1024, ',', 'utf-8', repeat('x', 64), 'INR', 2
  );
grant select on pg_temp.import_wallet to authenticated;
select public.apply_statement_import_mapping((select import_id from pg_temp.import_wallet), 'Date', 'Description', 'DD/MM/YYYY', null, null, null, null, 'Amount', null, null, 'debit_negative', null);
select public.insert_statement_import_rows(
  (select import_id from pg_temp.import_wallet),
  '[
    {"row_index": 0, "row_hash": "w0", "transaction_date": "2026-03-15", "description": "Groceries", "amount": "600.0000", "direction": "debit", "currency": "INR", "suggested_transaction_type": "expense", "validation_errors": []},
    {"row_index": 1, "row_hash": "w1", "transaction_date": "2026-03-16", "description": "Refund", "amount": "200.0000", "direction": "credit", "currency": "INR", "suggested_transaction_type": "income", "validation_errors": []}
  ]'::jsonb
);

create temp table pg_temp.wrow0 as select id from public.statement_import_rows where import_id = (select import_id from pg_temp.import_wallet) and row_index = 0;
create temp table pg_temp.wrow1 as select id from public.statement_import_rows where import_id = (select import_id from pg_temp.import_wallet) and row_index = 1;
grant select on pg_temp.wrow0 to authenticated;
grant select on pg_temp.wrow1 to authenticated;

-- Simulates what runRowAnalysis (src/lib/bank-import/actions.ts) sends
-- when evaluateImportRules (src/lib/bank-import/rules.ts) returns a
-- "conflict" result for row0 (two active equal-priority rules that
-- disagree) and a plain "matched"/"no_match" result for row1.
select public.apply_statement_import_row_analysis(
  (select import_id from pg_temp.import_wallet),
  format(
    '[{"row_id": "%s", "resolved_transaction_type": "expense", "has_rule_conflict": true}, {"row_id": "%s", "resolved_transaction_type": "income"}]',
    (select id from pg_temp.wrow0), (select id from pg_temp.wrow1)
  )::jsonb,
  '[]'::jsonb
);

select is(
  (select has_rule_conflict from public.statement_import_rows where id = (select id from pg_temp.wrow0)),
  true,
  'apply_statement_import_row_analysis persists has_rule_conflict when the analysis pass flags a conflict'
);
select is(
  (select has_rule_conflict from public.statement_import_rows where id = (select id from pg_temp.wrow1)),
  false,
  'has_rule_conflict defaults to false for a row the analysis pass never flagged'
);

select ok(
  pg_temp.throws_with_code(
    format($$ select public.update_statement_import_row(%L, p_wallet_id => %L) $$, (select id from pg_temp.wrow0), (select id from pg_temp.wallet2)),
    '42501'
  ),
  'update_statement_import_row rejects a wallet_id belonging to another user'
);

select lives_ok(
  format($$ select public.update_statement_import_row(%L, 'include', p_wallet_id => %L) $$, (select id from pg_temp.wrow0), (select id from pg_temp.wallet1)),
  'user1 can pre-assign their own wallet to their own row'
);
select is(
  (select wallet_id from public.statement_import_rows where id = (select id from pg_temp.wrow0)),
  (select id from pg_temp.wallet1),
  'the wallet_id was saved on the row'
);

select ok(
  pg_temp.throws_with_code(
    format($$ select public.bulk_update_statement_import_rows(%L, array[%L]::uuid[], p_wallet_id => %L) $$, (select import_id from pg_temp.import_wallet), (select id from pg_temp.wrow1), (select id from pg_temp.wallet2)),
    '42501'
  ),
  'bulk_update_statement_import_rows rejects a wallet_id belonging to another user'
);
select lives_ok(
  format($$ select public.bulk_update_statement_import_rows(%L, array[%L]::uuid[], 'include', null, null, %L) $$, (select import_id from pg_temp.import_wallet), (select id from pg_temp.wrow1), (select id from pg_temp.wallet1)),
  'bulk_update_statement_import_rows accepts the caller''s own wallet_id'
);

select public.mark_statement_import_ready((select import_id from pg_temp.import_wallet));
create temp table pg_temp.post_result_wallet as
  select * from public.post_statement_import_batch((select import_id from pg_temp.import_wallet));
grant select on pg_temp.post_result_wallet to authenticated;

select is((select success from pg_temp.post_result_wallet), true, 'posting the wallet-tagged import succeeds');
select is((select posted_count from pg_temp.post_result_wallet), 2, 'both rows post (one expense wallet-eligible, one income wallet-ineligible)');

select is(
  (select count(*)::int from public.transaction_purpose_allocations
    where transaction_id = (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.wrow0))),
  1,
  'the expense row''s newly created transaction was assigned to its pre-selected wallet'
);
select is(
  (select wallet_id from public.transaction_purpose_allocations
    where transaction_id = (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.wrow0))),
  (select id from pg_temp.wallet1),
  'the allocation points at the correct wallet'
);
select is(
  (select count(*)::int from public.transaction_purpose_allocations
    where transaction_id = (select linked_created_transaction_id from public.statement_import_rows where id = (select id from pg_temp.wrow1))),
  0,
  'the income row''s wallet_id is silently ignored at posting -- assign_transaction_to_purpose_wallet only accepts expense/credit_card_purchase, and posting still succeeds rather than failing the batch'
);
select is(
  (select count(*)::int from public.purpose_wallet_movements where wallet_id = (select id from pg_temp.wallet1) and movement_kind = 'expense_spend'),
  1,
  'the wallet assignment recorded a real expense_spend movement, not just a bare allocation row'
);

reset role;

select * from finish();
rollback;
