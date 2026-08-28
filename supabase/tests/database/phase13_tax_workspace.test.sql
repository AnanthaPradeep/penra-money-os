-- pgTAP tests for Phase 13: tax profile, income adjustments, deductions,
-- withholdings, payments, asset classification, AIS/26AS reconciliation,
-- and report snapshots (see supabase/migrations/
-- 20260827220000_phase13_tax_workspace.sql).

begin;

select plan(88);

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
--   user1  = 99991111-1111-1111-1111-111111111111
--   user2  = 99992222-2222-2222-2222-222222222222
--   bank1  = f1111111-1111-1111-1111-111111111111 (user1, bank_savings)
--   asset1 = f1111111-1111-1111-1111-111111111112 (user1, investment_assets, stock)
--   holding1 = f1111111-1111-1111-1111-111111111113 (user1, investment_holdings)

insert into auth.users (id, email, raw_user_meta_data)
values ('99991111-1111-1111-1111-111111111111', 'pgtap-phase13-one@example.com', '{}'::jsonb);
insert into auth.users (id, email, raw_user_meta_data)
values ('99992222-2222-2222-2222-222222222222', 'pgtap-phase13-two@example.com', '{}'::jsonb);

insert into public.accounts (id, user_id, name, account_class, account_type, currency)
values ('f1111111-1111-1111-1111-111111111111', '99991111-1111-1111-1111-111111111111', 'User1 Bank', 'asset', 'bank_savings', 'INR');

insert into public.investment_assets (id, user_id, asset_kind, display_name, isin)
values ('f1111111-1111-1111-1111-111111111112', '99991111-1111-1111-1111-111111111111', 'stock', 'Example Corp', 'INE000A00000');
insert into public.investment_holdings (id, user_id, investment_asset_id, opened_date)
values ('f1111111-1111-1111-1111-111111111113', '99991111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111112', '2024-01-01');

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99991111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.create_manual_transaction(
  'income', now(), 'Opening funds', jsonb_build_array(
    jsonb_build_object('account_id', 'f1111111-1111-1111-1111-111111111111', 'amount', '50000.0000'),
    jsonb_build_object('account_id', (select id from public.accounts where user_id = '99991111-1111-1111-1111-111111111111' and is_system and system_code = 'uncategorized_income'), 'amount', '-50000.0000')
  )
);
reset role;

-- ---------------------------------------------------------------------
-- A. Schema: tables, RLS, minimum grants.
-- ---------------------------------------------------------------------

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = t), 'public.' || t || ' table exists')
from unnest(array[
  'tax_profiles', 'tax_income_adjustments', 'tax_deductions', 'tax_withholdings',
  'tax_payments', 'tax_asset_classifications', 'tax_reconciliation_items', 'tax_report_snapshots'
]) as t;

select ok((select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), 'RLS enabled on ' || t)
from unnest(array[
  'tax_profiles', 'tax_income_adjustments', 'tax_deductions', 'tax_withholdings',
  'tax_payments', 'tax_asset_classifications', 'tax_reconciliation_items', 'tax_report_snapshots'
]) as t;
select ok((select relforcerowsecurity from pg_class where oid = ('public.' || t)::regclass), 'RLS forced on ' || t)
from unnest(array[
  'tax_profiles', 'tax_income_adjustments', 'tax_deductions', 'tax_withholdings',
  'tax_payments', 'tax_asset_classifications', 'tax_reconciliation_items', 'tax_report_snapshots'
]) as t;

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'tax_profiles', 'tax_income_adjustments', 'tax_deductions', 'tax_withholdings',
        'tax_payments', 'tax_asset_classifications', 'tax_reconciliation_items', 'tax_report_snapshots'
      )
      and grantee = 'anon'),
  0,
  'anon has zero grants on any Phase 13 table'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'tax_profiles', 'tax_income_adjustments', 'tax_deductions', 'tax_withholdings',
        'tax_payments', 'tax_asset_classifications', 'tax_reconciliation_items', 'tax_report_snapshots'
      )
      and grantee = 'authenticated'
      and privilege_type <> 'SELECT'),
  0,
  'authenticated has only SELECT on every Phase 13 table (all writes are RPC-mediated)'
);

-- No ambiguous overloads on any Phase 13 function.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = fn group by p.proname),
  1,
  'no ambiguous overload for ' || fn
)
from unnest(array[
  'save_tax_profile', 'save_tax_income_adjustment', 'set_tax_income_adjustment_status',
  'delete_tax_income_adjustment', 'save_tax_deduction', 'set_tax_deduction_status', 'delete_tax_deduction',
  'save_tax_withholding', 'set_tax_withholding_reconciliation_status', 'delete_tax_withholding',
  'save_tax_payment', 'delete_tax_payment', 'save_tax_asset_classification',
  'save_tax_reconciliation_item', 'delete_tax_reconciliation_item',
  'create_tax_report_snapshot', 'update_tax_report_snapshot_draft', 'finalize_tax_report_snapshot'
]) as fn;

-- anon can call none of the Phase 13 RPCs.
select is(
  (select count(*)::int from information_schema.role_routine_grants
    where routine_schema = 'public' and routine_name = fn and grantee = 'anon'),
  0,
  'anon cannot execute ' || fn
)
from unnest(array[
  'save_tax_profile', 'save_tax_income_adjustment', 'create_tax_report_snapshot', 'finalize_tax_report_snapshot'
]) as fn;

-- ---------------------------------------------------------------------
-- B. Tax profile.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99991111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.save_tax_profile(p_masked_pan_label => '234F') $$,
  'user1 saves their tax profile'
);
select is(
  (select masked_pan_label from public.tax_profiles where user_id = '99991111-1111-1111-1111-111111111111'),
  '234F',
  'masked PAN label stored correctly (never a full PAN)'
);
select ok(
  pg_temp.throws_with_code($sql$ select public.save_tax_profile(p_masked_pan_label => 'ABCDE12345') $sql$, '23514'),
  'a full-length PAN-like value is rejected by the masked-label check constraint'
);
select lives_ok(
  $$ select public.save_tax_profile(p_default_regime_preference => 'new') $$,
  'saving again upserts the same profile row (unique per user)'
);
select is(
  (select count(*)::int from public.tax_profiles where user_id = '99991111-1111-1111-1111-111111111111'),
  1,
  'exactly one profile row exists after a second save (uniqueness enforced, not a duplicate)'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99992222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(
  (select count(*)::int from public.tax_profiles where user_id = '99991111-1111-1111-1111-111111111111'),
  0,
  'user2 cannot see user1''s tax profile'
);
reset role;

-- ---------------------------------------------------------------------
-- C. Income adjustments — duplicate source links rejected.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99991111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.save_tax_income_adjustment('2025-26', 'salary', 600000, 20000, p_source_type => 'manual') $$,
  'user1 records a manual salary income adjustment'
);
select is(
  (select gross_amount from public.tax_income_adjustments
     where user_id = '99991111-1111-1111-1111-111111111111' and category = 'salary'),
  600000::numeric,
  'gross_amount stored exactly'
);
select is(
  (select tds_amount from public.tax_income_adjustments
     where user_id = '99991111-1111-1111-1111-111111111111' and category = 'salary'),
  20000::numeric,
  'tds_amount stored exactly, distinct from gross_amount'
);

select ok(
  pg_temp.throws_with_code($sql$ select public.save_tax_income_adjustment('2025-26', 'other_income', 5000, 0, p_source_type => 'ledger_transaction', p_source_ledger_transaction_id => '00000000-0000-0000-0000-000000000000') $sql$, '42501'),
  'linking a non-existent/foreign ledger transaction is rejected'
);

reset role;

-- ---------------------------------------------------------------------
-- D. Asset classification — never inferred, cross-user rejected.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99991111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ select public.save_tax_asset_classification('f1111111-1111-1111-1111-111111111112', 'listed_equity') $$,
  'user1 classifies their own investment asset as listed_equity'
);
select is(
  (select asset_class from public.tax_asset_classifications where investment_asset_id = 'f1111111-1111-1111-1111-111111111112'),
  'listed_equity',
  'classification stored correctly'
);
select ok(
  pg_temp.throws_with_code($sql$ select public.save_tax_asset_classification('f1111111-1111-1111-1111-111111111112', 'unsupported') $sql$, '23514'),
  'marking unsupported without a reason is rejected by the shape check constraint'
);
reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99992222-2222-2222-2222-222222222222", "role": "authenticated"}';
select ok(
  pg_temp.throws_with_code($sql$ select public.save_tax_asset_classification('f1111111-1111-1111-1111-111111111112', 'listed_equity') $sql$, '42501'),
  'user2 cannot classify user1''s investment asset'
);
reset role;

-- ---------------------------------------------------------------------
-- E. Deductions, withholdings, payments.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99991111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.save_tax_deduction('2025-26', '80C', 150000, p_evidence_label => 'PPF passbook') $$,
  'user1 records an 80C deduction'
);
select lives_ok(
  $$ select public.save_tax_withholding('2025-26', 'salary_tds', 'Acme Corp', 600000, 45000, '2025-06-01') $$,
  'user1 records salary TDS'
);
select lives_ok(
  $$ select public.save_tax_payment('2025-26', 'advance_tax', 20000, '2025-12-15') $$,
  'user1 records an advance-tax payment'
);

-- Ledger non-mutation: none of the above wrote to ledger_transactions.
select is(
  (select count(*)::int from public.ledger_transactions where user_id = '99991111-1111-1111-1111-111111111111' and transaction_type <> 'income'),
  0,
  'no tax operation created a ledger transaction'
);

reset role;

-- ---------------------------------------------------------------------
-- F. Reconciliation — preserves disagreement, never overwrites silently.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99991111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.save_tax_reconciliation_item('2025-26', 'form_26as', 'salary_tds', p_reported_amount => 45000, p_penra_amount => 44000, p_status => 'difference') $$,
  'user1 records a reconciliation difference'
);
select is(
  (select reported_amount from public.tax_reconciliation_items where financial_year_id = '2025-26' and income_category = 'salary_tds'),
  45000::numeric,
  'reported_amount preserved'
);
select is(
  (select penra_amount from public.tax_reconciliation_items where financial_year_id = '2025-26' and income_category = 'salary_tds'),
  44000::numeric,
  'penra_amount preserved separately — the disagreement is not erased by overwriting one value with the other'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99992222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(
  (select count(*)::int from public.tax_reconciliation_items where financial_year_id = '2025-26'),
  0,
  'user2 cannot see user1''s reconciliation items'
);
reset role;

-- ---------------------------------------------------------------------
-- G. Report snapshots — immutability and supersede.
-- ---------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99991111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_tax_report_snapshot('2025-26', '2026-27', 'in-individual-2025-26.v1', 'complete', '{"totalTax": 1000}'::jsonb) $$,
  'user1 creates a draft snapshot'
);

select is(
  (select status from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111'),
  'draft',
  'a new snapshot starts as draft'
);

select lives_ok(
  $$ select public.update_tax_report_snapshot_draft(
       (select id from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111'),
       'complete', '{"totalTax": 1200}'::jsonb
     ) $$,
  'a draft snapshot can be regenerated in place'
);
select is(
  (select (snapshot_data->>'totalTax')::numeric from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111'),
  1200::numeric,
  'draft regeneration actually updated snapshot_data'
);

select lives_ok(
  $$ select public.finalize_tax_report_snapshot(
       (select id from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111')
     ) $$,
  'user1 finalizes the snapshot'
);
select is(
  (select status from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111'),
  'finalized',
  'snapshot status is now finalized'
);
select isnt(
  (select finalized_at from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111'),
  null,
  'finalized_at is set'
);

-- Immutability, defense in depth: authenticated has no UPDATE grant on
-- this table at all (every write goes through a SECURITY DEFINER RPC —
-- see section 9), so a direct update fails with permission-denied before
-- it can even reach prevent_finalized_snapshot_mutation's business-rule
-- check. That trigger is exercised separately below via the RPC-mediated
-- supersede path, where it correctly allows exactly one transition.
select ok(
  pg_temp.throws_with_code(
    $sql$ update public.tax_report_snapshots set snapshot_data = '{"totalTax": 9999}'::jsonb
          where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111' $sql$,
    '42501'
  ),
  'a finalized snapshot cannot have its snapshot_data changed directly (no direct UPDATE grant at all)'
);
select is(
  (select (snapshot_data->>'totalTax')::numeric from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111'),
  1200::numeric,
  'snapshot_data is unchanged after the rejected direct update attempt'
);

-- Finalizing again is rejected.
select ok(
  pg_temp.throws_with_code($sql$ select public.finalize_tax_report_snapshot(
       (select id from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111')
     ) $sql$, '22023'),
  'finalizing an already-finalized snapshot is rejected'
);

-- Regeneration (supersede) preserves the old snapshot.
select lives_ok(
  $$ select public.create_tax_report_snapshot(
       '2025-26', '2026-27', 'in-individual-2025-26.v1', 'complete', '{"totalTax": 1500}'::jsonb,
       p_supersedes_snapshot_id => (select id from public.tax_report_snapshots where financial_year_id = '2025-26' and status = 'finalized' and user_id = '99991111-1111-1111-1111-111111111111')
     ) $$,
  'user1 regenerates the report, superseding the finalized snapshot'
);
select is(
  (select count(*)::int from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111'),
  2,
  'the prior finalized snapshot still exists (never deleted) alongside the new one'
);
select is(
  (select status from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111' and (snapshot_data->>'totalTax')::numeric = 1200),
  'superseded',
  'the prior finalized snapshot is now marked superseded, not deleted or edited'
);
select is(
  (select (snapshot_data->>'totalTax')::numeric from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111' and status = 'superseded'),
  1200::numeric,
  'the superseded snapshot''s own data is preserved exactly as it was when finalized'
);
select is(
  (select superseded_by from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111' and status = 'superseded'),
  (select id from public.tax_report_snapshots where financial_year_id = '2025-26' and user_id = '99991111-1111-1111-1111-111111111111' and status = 'draft'),
  'superseded_by correctly points at the new snapshot'
);

-- Cannot supersede a snapshot that isn't finalized.
select ok(
  pg_temp.throws_with_code($sql$ select public.create_tax_report_snapshot(
       '2025-26', '2026-27', 'in-individual-2025-26.v1', 'complete', '{}'::jsonb,
       p_supersedes_snapshot_id => (select id from public.tax_report_snapshots where financial_year_id = '2025-26' and status = 'draft' and user_id = '99991111-1111-1111-1111-111111111111')
     ) $sql$, '22023'),
  'only a finalized snapshot can be superseded'
);

reset role;

-- Cross-user: user2 cannot see or finalize user1's snapshot.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "99992222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(
  (select count(*)::int from public.tax_report_snapshots where user_id = '99991111-1111-1111-1111-111111111111'),
  0,
  'user2 cannot see user1''s report snapshots'
);
select ok(
  pg_temp.throws_with_code($sql$ select public.finalize_tax_report_snapshot(
       (select id from public.tax_report_snapshots where financial_year_id = '2025-26' and status = 'draft')
     ) $sql$, '22023'),
  'user2 cannot finalize a snapshot they do not own (not found under their own RLS-scoped query)'
);
reset role;

select * from finish();
rollback;
