-- Cosmetic follow-up: remove a pointless self-assignment left over from the
-- initial draft of this function (harmless, but dead code). Forward-only
-- create-or-replace; behavior is unchanged.
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
  end if;

  return v_inserted;
end;
$$;
