-- Batched counterpart to ingest_market_price_observation, so the Edge
-- Functions can ingest an entire day's AMFI file (~14,000 schemes) or a
-- stock-price batch in a small, fixed number of network round trips
-- instead of one per instrument — a single-row-at-a-time loop over ~14,000
-- HTTP calls would run well past pg_net's 25s response-tracking window in
-- invoke_market_data_function. Reuses ingest_market_price_observation
-- per row (same audit/correction semantics, single source of truth for
-- that logic) inside one transaction; a bad individual row is caught and
-- reported, never allowed to abort the whole batch.
create or replace function public.ingest_market_price_observations_batch(
  p_provider text,
  p_price_kind text,
  p_currency text,
  p_rows jsonb
)
returns table (instrument_id uuid, ok boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select *
    from jsonb_to_recordset(p_rows) as x(instrument_id uuid, effective_date date, price numeric)
  loop
    begin
      perform public.ingest_market_price_observation(
        r.instrument_id, p_provider, p_price_kind, r.effective_date, r.price, p_currency, null
      );
      instrument_id := r.instrument_id;
      ok := true;
      return next;
    exception when others then
      instrument_id := r.instrument_id;
      ok := false;
      return next;
    end;
  end loop;
  return;
end;
$$;

revoke all on function public.ingest_market_price_observations_batch(text, text, text, jsonb) from public;
grant execute on function public.ingest_market_price_observations_batch(text, text, text, jsonb) to service_role;
