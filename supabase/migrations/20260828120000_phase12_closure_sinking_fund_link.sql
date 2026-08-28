-- Phase 12 closure — sinking-fund linked-recurring-item management.
--
-- financial_goals.sf_linked_recurring_item_id (added in
-- 20260826113424_phase12_goals_debts_forecast.sql) had a column but no
-- function ever set or cleared it — create_financial_goal and
-- update_financial_goal never reference it. This migration adds a small
-- dedicated setter (accepting null to clear the link, mirroring
-- set_financial_goal_status's pattern rather than overloading
-- update_financial_goal's coalesce-based partial-update semantics, since
-- coalesce can never express "clear this back to null").

create or replace function public.set_goal_linked_recurring_item(
  p_goal_id uuid,
  p_recurring_item_id uuid default null
)
returns public.financial_goals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_goal public.financial_goals;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_goal from public.financial_goals where id = p_goal_id and user_id = v_user_id;
  if v_goal.id is null then
    raise exception 'Goal not found' using errcode = '42501';
  end if;
  if v_goal.goal_type <> 'sinking_fund' then
    raise exception 'Only a sinking fund can be linked to a recurring item' using errcode = '22023';
  end if;

  if p_recurring_item_id is not null then
    if not exists (
      select 1 from public.recurring_items where id = p_recurring_item_id and user_id = v_user_id
    ) then
      raise exception 'Recurring item not found' using errcode = '42501';
    end if;
  end if;

  update public.financial_goals set sf_linked_recurring_item_id = p_recurring_item_id
    where id = p_goal_id and user_id = v_user_id
    returning * into v_goal;

  return v_goal;
end;
$$;

revoke all on function public.set_goal_linked_recurring_item(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_goal_linked_recurring_item(uuid, uuid) to authenticated;
