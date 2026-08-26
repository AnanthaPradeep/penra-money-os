-- Fixes a pre-existing (pre-Phase-12), previously-undetected ambiguous-
-- overload bug on the hosted project, found while auditing pg_proc as
-- part of Phase 12's function-overload vigilance (the Phase 11 postmortem
-- specifically asked for this check before every new migration).
--
-- public.create_account_with_opening_balance currently exists as TWO
-- overloads on the hosted database:
--   1. (..., p_credit_limit text, ..., p_opening_balance text, ...) —
--      the version defined by every migration file in this repo
--      (20260817153217_create_ledger_foundation.sql, later widened by
--      20260820184332_phase7_investments_networth.sql via a same-
--      signature `create or replace`).
--   2. (..., p_credit_limit numeric, ..., p_opening_balance numeric, ...)
--      — an older, more primitive version (no 'investment' account-type
--      support) that is NOT defined anywhere in supabase/migrations/,
--      meaning it was applied to the hosted project directly at some
--      point before the current migration history was consolidated, and
--      never dropped.
--
-- Any call that doesn't supply an explicit type for both ambiguous
-- parameters — exactly how PostgREST invokes an RPC from the app's own
-- supabase.rpc('create_account_with_opening_balance', {...}) calls, and
-- exactly how src/lib/accounts/actions.ts calls it — fails with "function
-- ... is not unique", verified directly against the hosted project:
--
--   select public.create_account_with_opening_balance(
--     p_name => 'Ambiguity Probe', p_account_type => 'cash'
--   );
--   -- ERROR: 42725: function ... is not unique
--
-- This means ordinary account creation through the real app has likely
-- been broken on the hosted project independent of anything in Phase 12.
-- The fix is the same shape as the Phase 11
-- post_manual_transaction_for_user fix: drop the stale overload, keeping
-- only the text-typed version every current migration file defines (text
-- was chosen deliberately — see the comment on the text-typed function —
-- so the exact decimal string the TypeScript money layer produces is
-- parsed with no JS floating-point round-trip).

drop function if exists public.create_account_with_opening_balance(
  text, text, uuid, text, text, numeric, date, text, numeric, timestamptz
);

-- Sanity check: exactly one overload must remain.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc
  where proname = 'create_account_with_opening_balance'
    and pronamespace = 'public'::regnamespace;

  if v_count <> 1 then
    raise exception 'expected exactly one create_account_with_opening_balance overload after cleanup, found %', v_count;
  end if;
end;
$$;
