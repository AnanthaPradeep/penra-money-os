-- Follow-up to 20260819194141_phase6_budgets_recurring.sql: every other
-- function in that migration sets `search_path = ''`; this one was
-- accidentally omitted (flagged by the Supabase security advisor as
-- "function_search_path_mutable"). Same signature, same body — only the
-- search_path setting is added.

create or replace function public.recurring_occurrence_date(
  p_anchor date,
  p_frequency text,
  p_interval_count integer,
  p_k integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_months_per_step integer;
  v_months integer;
  v_year integer;
  v_month integer;
  v_day integer;
  v_last_day integer;
begin
  if p_frequency = 'weekly' then
    return p_anchor + (p_k * p_interval_count * 7);
  end if;

  case p_frequency
    when 'monthly' then v_months_per_step := 1;
    when 'quarterly' then v_months_per_step := 3;
    when 'half_yearly' then v_months_per_step := 6;
    when 'yearly' then v_months_per_step := 12;
    else
      raise exception 'unsupported recurrence frequency: %', p_frequency
        using errcode = 'invalid_parameter_value';
  end case;

  v_months := v_months_per_step * p_interval_count * p_k;

  v_year := extract(year from p_anchor)::integer;
  v_month := extract(month from p_anchor)::integer;
  v_day := extract(day from p_anchor)::integer;

  v_month := v_month + v_months;
  v_year := v_year + (v_month - 1) / 12;
  v_month := ((v_month - 1) % 12) + 1;

  v_last_day := extract(day from ((make_date(v_year, v_month, 1) + interval '1 month - 1 day')))::integer;

  return make_date(v_year, v_month, least(v_day, v_last_day));
end;
$$;
