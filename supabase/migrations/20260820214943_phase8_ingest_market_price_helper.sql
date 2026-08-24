-- Atomic, auditable single-observation upsert for market_prices, used only
-- by the Edge Functions (via their service_role client) so the
-- read-existing / supersede-old / insert-new / link-superseded_by sequence
-- happens inside one transaction instead of several separate REST calls
-- that could interleave badly under concurrent refreshes. Never callable by
-- authenticated/anon — market_prices stays writable only by trusted server
-- code, exactly like every other Phase 8 ingestion path.
create or replace function public.ingest_market_price_observation(
  p_instrument_id uuid,
  p_provider text,
  p_price_kind text,
  p_effective_date date,
  p_price numeric,
  p_currency text default 'INR',
  p_provider_timestamp timestamptz default null
)
returns public.market_prices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.market_prices;
  v_inserted public.market_prices;
begin
  select * into v_existing
  from public.market_prices
  where instrument_id = p_instrument_id
    and provider = p_provider
    and price_kind = p_price_kind
    and effective_date = p_effective_date
    and is_current = true
  for update;

  if v_existing.id is not null and v_existing.price = p_price then
    return v_existing;
  end if;

  if v_existing.id is not null then
    update public.market_prices
    set is_current = false
    where id = v_existing.id;
  end if;

  insert into public.market_prices (
    instrument_id, price_kind, effective_date, price, currency, provider, provider_timestamp, is_current
  ) values (
    p_instrument_id, p_price_kind, p_effective_date, p_price, p_currency, p_provider, p_provider_timestamp, true
  )
  returning * into v_inserted;

  if v_existing.id is not null then
    update public.market_prices
    set superseded_by = v_inserted.id
    where id = v_existing.id;

    v_inserted := v_inserted;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.ingest_market_price_observation(uuid, text, text, date, numeric, text, timestamptz) from public;
grant execute on function public.ingest_market_price_observation(uuid, text, text, date, numeric, text, timestamptz) to service_role;
