-- Follow-up to 20260819194141_phase6_budgets_recurring.sql: several
-- create_recurring_item/update_recurring_item parameters are genuinely
-- optional in practice (a transfer has no category; an income item has no
-- source account; notes/end date are always optional) but were declared
-- without a SQL default, so the generated TypeScript Args type marked them
-- as required non-nullable strings — forcing the caller to invent a
-- placeholder value instead of the app's established "omit the key
-- entirely" convention (see create_account_with_opening_balance's
-- optional uuid/text params for the existing precedent this now matches).
--
-- Defaulted parameters must trail non-defaulted ones in a SQL function
-- signature, so this reorders the parameter lists — a genuinely different
-- signature identity, hence the explicit drops below (mirrors Phase 5's
-- create_manual_transaction migration note on the same overload-identity
-- rule). PostgREST/supabase-js always calls RPCs with named arguments, so
-- this reordering has no effect on any existing call site.

drop function if exists public.create_recurring_item(
  text, text, numeric, text, uuid, uuid, uuid, uuid, text, date, date, text, integer, text, date, date
);

create or replace function public.create_recurring_item(
  p_name text,
  p_kind text,
  p_amount numeric,
  p_currency text,
  p_start_date date,
  p_frequency text,
  p_interval_count integer,
  p_processing_mode text,
  p_source_account_id uuid default null,
  p_destination_account_id uuid default null,
  p_category_id uuid default null,
  p_payee_id uuid default null,
  p_notes text default null,
  p_end_date date default null,
  p_trial_end_date date default null,
  p_cancellation_date date default null
)
returns public.recurring_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.recurring_items;
  v_horizon_end date;
begin
  if v_user_id is null then
    raise exception 'create_recurring_item requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.recurring_items (
    user_id, name, kind, amount, currency, source_account_id, destination_account_id,
    category_id, payee_id, notes, start_date, end_date, frequency, interval_count,
    processing_mode, trial_end_date, cancellation_date
  )
  values (
    v_user_id, p_name, p_kind, p_amount, p_currency, p_source_account_id, p_destination_account_id,
    p_category_id, p_payee_id, p_notes, p_start_date, p_end_date, p_frequency, p_interval_count,
    p_processing_mode, p_trial_end_date, p_cancellation_date
  )
  returning * into v_item;

  v_horizon_end := ((now() at time zone 'Asia/Kolkata')::date) + 60;
  perform public.generate_occurrences_for_item(v_item, v_horizon_end);

  select * into v_item from public.recurring_items where id = v_item.id;
  return v_item;
end;
$$;

revoke all on function public.create_recurring_item(
  text, text, numeric, text, date, text, integer, text, uuid, uuid, uuid, uuid, text, date, date, date
) from public, anon;
grant execute on function public.create_recurring_item(
  text, text, numeric, text, date, text, integer, text, uuid, uuid, uuid, uuid, text, date, date, date
) to authenticated;

comment on function public.create_recurring_item(
  text, text, numeric, text, date, text, integer, text, uuid, uuid, uuid, uuid, text, date, date, date
) is
  'Creates a recurring item and immediately generates its first 60 days '
  'of occurrences. source/destination account, category, payee, notes, '
  'and end date are all optional (kind-dependent — enforced by '
  'validate_recurring_item) — the caller omits whichever do not apply.';

drop function if exists public.update_recurring_item(
  uuid, text, numeric, uuid, uuid, text, date, text, integer, text
);

create or replace function public.update_recurring_item(
  p_id uuid,
  p_name text,
  p_amount numeric,
  p_frequency text,
  p_interval_count integer,
  p_processing_mode text,
  p_category_id uuid default null,
  p_payee_id uuid default null,
  p_notes text default null,
  p_end_date date default null
)
returns public.recurring_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.recurring_items;
  v_horizon_end date;
begin
  if v_user_id is null then
    raise exception 'update_recurring_item requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  update public.recurring_items
    set name = p_name, amount = p_amount, category_id = p_category_id, payee_id = p_payee_id,
        notes = p_notes, end_date = p_end_date, frequency = p_frequency,
        interval_count = p_interval_count, processing_mode = p_processing_mode
    where id = p_id and user_id = v_user_id
    returning * into v_item;

  if v_item.id is null then
    raise exception 'recurring item not found' using errcode = 'no_data_found';
  end if;

  delete from public.recurring_occurrences
    where recurring_item_id = v_item.id and status = 'upcoming';

  v_horizon_end := ((now() at time zone 'Asia/Kolkata')::date) + 60;
  perform public.generate_occurrences_for_item(v_item, v_horizon_end);

  select * into v_item from public.recurring_items where id = v_item.id;
  return v_item;
end;
$$;

revoke all on function public.update_recurring_item(
  uuid, text, numeric, text, integer, text, uuid, uuid, text, date
) from public, anon;
grant execute on function public.update_recurring_item(
  uuid, text, numeric, text, integer, text, uuid, uuid, text, date
) to authenticated;

comment on function public.update_recurring_item(
  uuid, text, numeric, text, integer, text, uuid, uuid, text, date
) is
  'Edits a recurring item''s revisable fields. category/payee/notes/end '
  'date are all optional — the caller omits whichever it does not want '
  'to set. kind/accounts/currency/start date are intentionally not '
  'editable here (see the section 11b header comment in the original '
  'migration).';
