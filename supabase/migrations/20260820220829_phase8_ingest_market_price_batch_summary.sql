drop function public.ingest_market_price_observations_batch(text, text, text, jsonb);

-- Replaces the per-row-table return shape with a single summary row
-- (updated_count, skipped_count) computed entirely inside Postgres. The
-- previous version returned one row per input (up to 2000 per call), and
-- in production that large a response was observed to under-report
-- (instruments_updated=7028 vs. 8047 real rows actually written) — safer
-- and simpler to have Postgres itself tally the outcome once, since the
-- ingestion loop's writes are the source of truth either way and a huge
-- pass-through result table added risk for no benefit.
create function public.ingest_market_price_observations_batch(
  p_provider text,
  p_price_kind text,
  p_currency text,
  p_rows jsonb
)
returns table (updated_count integer, skipped_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  for r in
    select *
    from jsonb_to_recordset(p_rows) as x(instrument_id uuid, effective_date date, price numeric)
  loop
    begin
      perform public.ingest_market_price_observation(
        r.instrument_id, p_provider, p_price_kind, r.effective_date, r.price, p_currency, null
      );
      v_updated := v_updated + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  updated_count := v_updated;
  skipped_count := v_skipped;
  return next;
end;
$$;

revoke all on function public.ingest_market_price_observations_batch(text, text, text, jsonb) from public;
grant execute on function public.ingest_market_price_observations_batch(text, text, text, jsonb) to service_role;
