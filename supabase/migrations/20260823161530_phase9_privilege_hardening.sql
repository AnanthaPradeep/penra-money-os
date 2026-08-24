-- Privilege hardening: Supabase provisions every project with default
-- privileges that grant EXECUTE on newly created public-schema functions
-- directly to anon/authenticated/service_role (in addition to the
-- implicit PUBLIC-pseudo-role grant) -- see the established, correct
-- convention already used by create_manual_transaction/run_amfi_refresh/
-- run_market_data_refresh_self ("revoke all ... from public, anon[,
-- authenticated]"). A handful of service-role-only ingestion/refresh
-- functions -- two from Phase 8 (ingest_market_price_observation,
-- ingest_market_price_observations_batch) and every new Phase 9
-- ingestion/refresh-orchestration function -- were instead written with
-- the shorter "revoke all ... from public" form, which does NOT strip
-- those direct anon/authenticated grants. Confirmed via
-- information_schema.role_routine_grants against the live remote project:
-- anon and authenticated both currently hold EXECUTE on every function
-- fixed below, meaning an unauthenticated or ordinary signed-in client
-- could call these directly via /rest/v1/rpc/... and forge shared
-- provider fundamentals/prices or trigger a global refresh -- a direct
-- violation of spec section 19 ("authenticated cannot write shared
-- provider fundamentals or forge provenance or run global refresh
-- processors"). This migration is corrective only: it revokes the
-- unintended grants and leaves every already-correct grant (including
-- run_fundamentals_refresh_self's intentional authenticated access)
-- untouched.
--
-- Note: this class of bug cannot be caught by the local pgTAP suite (see
-- supabase/tests/database/phase9_research_workspace.test.sql's existing
-- "authenticated cannot call ingest_company_profile() directly" assertion
-- et al, which already passed locally both before and after this fix) --
-- the local Supabase CLI stack does not reproduce the hosted platform's
-- extra default-privilege grant, so local pgTAP alone is not sufficient
-- evidence that a service-role-only function is actually locked down on
-- the real remote project; verify directly against remote grants
-- (information_schema.role_routine_grants) too.

-- Phase 8 (pre-existing gap, fixed now)
revoke all on function public.ingest_market_price_observation(uuid, text, text, date, numeric, text, timestamptz)
  from anon, authenticated;
revoke all on function public.ingest_market_price_observations_batch(text, text, text, jsonb)
  from anon, authenticated;

-- Phase 9 (new gap, fixed in the same pass)
revoke all on function public.ingest_company_profile(uuid, text, text, text, text, text, text, text, text)
  from anon, authenticated;
revoke all on function public.ensure_company_financial_period(uuid, text, date, integer, integer, date, text, text, text)
  from anon, authenticated;
revoke all on function public.ingest_company_financial_metric(uuid, text, text, numeric, text, text)
  from anon, authenticated;
revoke all on function public.ingest_company_financial_metrics_batch(jsonb)
  from anon, authenticated;
revoke all on function public.run_fundamentals_refresh(uuid[])
  from anon, authenticated;
revoke all on function public.process_company_fundamentals_refresh_all()
  from anon, authenticated;
revoke all on function public.mark_overdue_theses_needs_review()
  from anon, authenticated;

-- run_fundamentals_refresh_self() is intentionally authenticated-callable
-- (the self-scoped, cooldown-limited manual refresh trigger, mirroring
-- run_market_data_refresh_self) -- only anon needs to be stripped here.
revoke all on function public.run_fundamentals_refresh_self()
  from anon;
