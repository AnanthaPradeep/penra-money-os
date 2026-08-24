-- Two real bugs found by testing:
--
-- 1. log_investment_thesis_version() ran as a BEFORE INSERT/UPDATE
--    trigger and tried to insert a child investment_thesis_versions row
--    referencing NEW.id — but a BEFORE trigger fires before the parent
--    row is actually written, so the FK to investment_theses(id) always
--    failed on INSERT ("thesis_id is not present in table
--    investment_theses"). Split into two triggers: a BEFORE trigger that
--    only computes current_version (must stay BEFORE, since only a
--    BEFORE trigger can modify NEW), and an AFTER trigger that writes the
--    version snapshot once the parent row genuinely exists.
--
-- 2. company_financial_periods_quarter_valid used
--    `fiscal_quarter between 1 and 4` in its quarterly branch — when
--    fiscal_quarter is NULL, that comparison evaluates to NULL, and a
--    NULL result PASSES a CHECK constraint (only an explicit FALSE
--    fails it). A quarterly period with a null fiscal_quarter therefore
--    slipped through uncaught. Fixed by adding an explicit
--    `fiscal_quarter is not null` guard.

drop trigger if exists log_investment_thesis_version_trigger on public.investment_theses;

create or replace function public.set_investment_thesis_version_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.current_version := old.current_version + 1;
  else
    new.current_version := 1;
  end if;
  return new;
end;
$$;

create trigger set_investment_thesis_version_number_trigger
  before insert or update on public.investment_theses
  for each row
  execute function public.set_investment_thesis_version_number();

create or replace function public.log_investment_thesis_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.investment_thesis_versions (
    thesis_id, user_id, version, title, summary, investment_case, opportunities,
    risks, catalysts, invalidation_conditions, time_horizon, confidence, status
  ) values (
    new.id, new.user_id, new.current_version, new.title, new.summary, new.investment_case, new.opportunities,
    new.risks, new.catalysts, new.invalidation_conditions, new.time_horizon, new.confidence, new.status
  );
  return new;
end;
$$;

create trigger log_investment_thesis_version_trigger
  after insert or update on public.investment_theses
  for each row
  execute function public.log_investment_thesis_version();

alter table public.company_financial_periods
  drop constraint company_financial_periods_quarter_valid;
alter table public.company_financial_periods
  add constraint company_financial_periods_quarter_valid check (
    (period_type = 'quarterly' and fiscal_quarter is not null and fiscal_quarter between 1 and 4) or
    (period_type = 'annual' and fiscal_quarter is null)
  );
