-- Fixes a critical bug introduced by the Phase 11 migration
-- (20260825154818_phase11_bank_statement_import_v2.sql): widening
-- post_manual_transaction_for_user with a new 10th parameter
-- (p_source_type) via `create or replace function` did NOT replace the
-- original 9-parameter version from Phase 7 — Postgres treats a different
-- parameter list as a genuinely different function overload, so the
-- database ended up with BOTH the old 9-arg and new 10-arg versions
-- simultaneously. Every existing 9-arg call site (create_manual_
-- transaction, record_investment_purchase, and every other Phase 6/7/8
-- caller) became ambiguous ("function ... is not unique") because a 9-arg
-- call could resolve against either overload (the 10th parameter has a
-- default). This broke ordinary manual-transaction and investment-
-- purchase posting across the whole app, not just the new Phase 11 code
-- path — caught by running the full pgTAP suite locally after applying
-- the Phase 11 migration, before this fix was ever pushed to the hosted
-- project.
--
-- The fix: explicitly drop the stale 9-parameter overload, leaving only
-- the widened 10-parameter version (whose p_source_type defaults to
-- 'manual', so every existing call site's behaviour is unchanged).

drop function if exists public.post_manual_transaction_for_user(
  uuid, text, timestamptz, text, jsonb, text, uuid, uuid, text
);

-- Sanity check this migration itself: exactly one overload must remain.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc
  where proname = 'post_manual_transaction_for_user'
    and pronamespace = 'public'::regnamespace;

  if v_count <> 1 then
    raise exception 'expected exactly one post_manual_transaction_for_user overload after cleanup, found %', v_count;
  end if;
end;
$$;
