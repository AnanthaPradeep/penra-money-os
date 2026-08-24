-- run_fundamentals_refresh_self() and process_company_fundamentals_refresh_all()
-- each called run_fundamentals_refresh(uuid[]), which itself inserted a
-- fundamentals_sync_runs row whenever the provider was not configured —
-- while run_fundamentals_refresh_self() ALSO unconditionally inserted its
-- own tracking row first. A single logical refresh attempt was therefore
-- recorded as two rows. Fixed by making run_fundamentals_refresh a pure
-- boolean "was it actually dispatched" helper with no logging side effect
-- of its own; each caller now owns exactly one fundamentals_sync_runs
-- insert for its own attempt.

drop function if exists public.run_fundamentals_refresh(uuid[]);

create function public.run_fundamentals_refresh(p_instrument_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_configured boolean;
begin
  select is_configured into v_configured from public.market_data_provider_state where provider = 'twelve_data';

  if v_configured is not true or p_instrument_ids is null or array_length(p_instrument_ids, 1) is null then
    return false;
  end if;

  perform public.invoke_market_data_function(
    'company-fundamentals-refresh',
    jsonb_build_object('instrument_ids', to_jsonb(p_instrument_ids))
  );
  return true;
end;
$$;

revoke all on function public.run_fundamentals_refresh(uuid[]) from public;
grant execute on function public.run_fundamentals_refresh(uuid[]) to service_role;

create or replace function public.process_company_fundamentals_refresh_all()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_invoked boolean;
begin
  select array_agg(distinct mi.id) into v_ids
  from public.market_instruments mi
  where mi.instrument_kind = 'stock' and mi.is_active = true
    and (
      exists (select 1 from public.investment_assets a where a.market_instrument_id = mi.id)
      or exists (select 1 from public.watchlist_items wi where wi.instrument_id = mi.id)
    );

  v_invoked := public.run_fundamentals_refresh(v_ids);

  insert into public.fundamentals_sync_runs (provider, scope, status, instruments_requested, error_code, completed_at)
  values (
    'twelve_data', 'all',
    case when v_invoked then 'running' else 'skipped' end,
    coalesce(array_length(v_ids, 1), 0),
    case when v_invoked then null else 'provider_not_configured' end,
    case when v_invoked then null else now() end
  );
end;
$$;

revoke all on function public.process_company_fundamentals_refresh_all() from public;
grant execute on function public.process_company_fundamentals_refresh_all() to service_role;

create or replace function public.run_fundamentals_refresh_self()
returns table (queued boolean, retry_after_seconds integer, instruments_requested integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_last_run timestamptz;
  v_cooldown_seconds constant integer := 900;
  v_ids uuid[];
  v_invoked boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select max(started_at) into v_last_run
  from public.fundamentals_sync_runs
  where triggered_by_user_id = v_user_id;

  if v_last_run is not null and v_last_run > now() - make_interval(secs => v_cooldown_seconds) then
    queued := false;
    retry_after_seconds := v_cooldown_seconds - floor(extract(epoch from (now() - v_last_run)))::integer;
    instruments_requested := 0;
    return next;
    return;
  end if;

  select array_agg(distinct mi.id) into v_ids
  from public.market_instruments mi
  where mi.instrument_kind = 'stock' and mi.is_active = true
    and (
      exists (
        select 1 from public.investment_assets a
        join public.investment_holdings h on h.investment_asset_id = a.id
        where a.market_instrument_id = mi.id and a.user_id = v_user_id and h.status = 'active'
      )
      or exists (
        select 1 from public.watchlist_items wi where wi.instrument_id = mi.id and wi.user_id = v_user_id
      )
    );

  v_invoked := public.run_fundamentals_refresh(v_ids);

  insert into public.fundamentals_sync_runs (provider, scope, status, instruments_requested, error_code, completed_at, triggered_by_user_id)
  values (
    'twelve_data', 'all',
    case when v_invoked then 'running' else 'skipped' end,
    coalesce(array_length(v_ids, 1), 0),
    case when v_invoked then null else 'provider_not_configured' end,
    case when v_invoked then null else now() end,
    v_user_id
  );

  queued := v_invoked and coalesce(array_length(v_ids, 1), 0) > 0;
  retry_after_seconds := v_cooldown_seconds;
  instruments_requested := coalesce(array_length(v_ids, 1), 0);
  return next;
end;
$$;

revoke all on function public.run_fundamentals_refresh_self() from public;
grant execute on function public.run_fundamentals_refresh_self() to authenticated;
