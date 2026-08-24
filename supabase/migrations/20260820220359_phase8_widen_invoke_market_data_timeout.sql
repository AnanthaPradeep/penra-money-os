-- AMFI's daily file is ~14,000 schemes; even batched into a handful of bulk
-- upsert/RPC calls inside the Edge Function, that can run longer than
-- pg_net's original 25s response-tracking window. pg_net calls are
-- fire-and-forget (this function returns immediately regardless), so
-- widening the timeout only affects how long pg_net's background worker
-- waits before giving up on recording a response — safe for every current
-- caller, all of which are async background refresh jobs, never a
-- synchronous user-facing wait.
create or replace function public.invoke_market_data_function(p_function_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://egywtxjqtfbjutlbwkfc.supabase.co/functions/v1/' || p_function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXd0eGpxdGZianV0bGJ3a2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4ODcwMTIsImV4cCI6MjEwMjQ2MzAxMn0.Va4kD23gC_XyCOii05RgDHV37S0_1wOcOh43FLbFfDY'
    ),
    body := p_body,
    timeout_milliseconds := 120000
  );
$$;
