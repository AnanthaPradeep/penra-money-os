-- =======================================================================
-- Phase 10 (follow-up) — wires create_ai_job() to actually dispatch the
-- ai-job-worker Edge Function after successfully queuing a job, using the
-- exact same fire-and-forget public.invoke_market_data_function(name,
-- body) -> pg_net pattern every other background job in this app already
-- uses (see run_amfi_refresh/run_fundamentals_refresh and this session's
-- own process_corporate_events_refresh_all). Without this, a queued job
-- would sit at status='queued' forever with nothing to ever pick it up —
-- run_ai_job_cleanup (already scheduled every 15 minutes) exists
-- specifically to fail such a stuck job after 30 minutes, but that is a
-- safety net, not a substitute for actually dispatching the work.
--
-- create or replace with an IDENTICAL signature/return shape preserves
-- the existing grant to authenticated and is forward-only. Every other
-- line of create_ai_job's body is unchanged from the Phase 10 migration
-- (section 14) — only the dispatch call is new, inserted right after the
-- ai_job_sources insert and before the final success return.
-- =======================================================================

create or replace function public.create_ai_job(
  p_job_kind text,
  p_provider text,
  p_model_id text,
  p_scope_type text,
  p_prompt_template_version text,
  p_input_hash text,
  p_chunk_ids uuid[] default '{}',
  p_scope_instrument_id uuid default null,
  p_scope_ipo_issue_id uuid default null,
  p_scope_compare_instrument_ids uuid[] default null,
  p_question_text text default null
)
returns table (job_id uuid, queued boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_model public.ai_provider_models;
  v_usage public.ai_usage_daily;
  v_unauthorized_chunk_count integer;
  v_new_job_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_model from public.ai_provider_models where provider = p_provider and model_id = p_model_id;
  if v_model.id is null or v_model.is_enabled is not true then
    job_id := null; queued := false; reason := 'provider_not_configured';
    return next;
    return;
  end if;

  select * into v_usage from public.ai_usage_daily where user_id = v_user_id and usage_date = current_date;
  if v_usage.id is not null and (
       v_usage.estimated_cost_usd >= v_model.daily_spend_cap_usd
    ) then
    job_id := null; queued := false; reason := 'daily_spend_cap_exceeded';
    return next;
    return;
  end if;

  if array_length(p_chunk_ids, 1) is not null then
    select count(*) into v_unauthorized_chunk_count
    from unnest(p_chunk_ids) as chunk_id
    where not exists (
      select 1 from public.source_document_chunks c
      where c.id = chunk_id and c.user_id = v_user_id
    );
    if v_unauthorized_chunk_count > 0 then
      raise exception 'One or more source chunks are not authorized for this user' using errcode = '42501';
    end if;
  end if;

  begin
    insert into public.ai_jobs (
      user_id, job_kind, provider, model_id, status, scope_type, scope_instrument_id,
      scope_ipo_issue_id, scope_compare_instrument_ids, question_text,
      prompt_template_version, input_hash
    ) values (
      v_user_id, p_job_kind, p_provider, p_model_id, 'queued', p_scope_type, p_scope_instrument_id,
      p_scope_ipo_issue_id, p_scope_compare_instrument_ids, p_question_text,
      p_prompt_template_version, p_input_hash
    )
    returning id into v_new_job_id;
  exception when unique_violation then
    job_id := null; queued := false; reason := 'duplicate_job_in_progress';
    return next;
    return;
  end;

  if array_length(p_chunk_ids, 1) is not null then
    insert into public.ai_job_sources (job_id, chunk_id)
    select v_new_job_id, chunk_id from unnest(p_chunk_ids) as chunk_id;
  end if;

  perform public.invoke_market_data_function(
    'ai-job-worker',
    jsonb_build_object('job_id', v_new_job_id)
  );

  job_id := v_new_job_id; queued := true; reason := null;
  return next;
end;
$$;

revoke all on function public.create_ai_job(text, text, text, text, text, text, uuid[], uuid, uuid, uuid[], text) from public, anon;
grant execute on function public.create_ai_job(text, text, text, text, text, text, uuid[], uuid, uuid, uuid[], text) to authenticated;
