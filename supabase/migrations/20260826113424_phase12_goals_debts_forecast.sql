-- =======================================================================
-- Phase 12b — Financial goals (including emergency fund / sinking funds
-- as goal subtypes), debts/loans, EMI amortization, and the planning-
-- reminders function. Builds on 20260826120000_phase12_purpose_wallets.sql
-- (purpose wallets, income allocation plans, eligible_liquid_balance).
--
-- Design notes:
--   * Emergency fund and sinking funds are NOT separate table
--     hierarchies — they are public.financial_goals rows with
--     goal_type in ('emergency_fund', 'sinking_fund'), sharing the exact
--     same lifecycle/contribution machinery as every other goal type.
--     A handful of nullable columns hold the config unique to those two
--     subtypes (months-of-expenses method, selected essential categories,
--     sinking-fund contribution frequency) rather than two more tables.
--   * A debt's *current* outstanding principal is never stored as an
--     independently-editable column — public.debts has only
--     original_principal (a fixed historical fact). "Current principal"
--     is always derived from public.account_balances for the debt's own
--     liability account (the same ledger-backed source of truth every
--     other balance in this app already uses), via
--     public.debt_current_principal() below.
--   * debt_payment_schedules rows are projections. Whether a row is
--     "paid" is never a stored, independently-settable status column —
--     it is derived by whether any debt_payments row references it
--     (schedule_row_id), so the two can never drift apart.
--   * EMI due dates step by the exact same day-of-month-clamped month
--     arithmetic as Phase 6's recurring items — this migration calls
--     public.recurring_occurrence_date(...) directly for month-based
--     frequencies rather than duplicating that logic.
--   * Payoff-strategy comparison and cash-flow forecasting are
--     deliberately NOT persisted here (no debt_scenarios/forecast_*
--     tables) — both are pure, deterministic, reproducible computations
--     over already-persisted data (debts, schedules, recurring items,
--     budgets, goals), implemented as pure TypeScript
--     (src/lib/planning/payoff.ts, src/lib/planning/forecast.ts) so they
--     stay exhaustively unit-testable the same way Phase 11's
--     matching.ts is, and so a scenario can never accidentally persist a
--     side effect. This directly satisfies "Scenarios must not post
--     transactions" and "Scenarios must not change debt terms" by
--     construction: there is nothing in the database for a scenario
--     computation to write to.
-- =======================================================================

-- =======================================================================
-- 1. public.financial_goals
-- =======================================================================

create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  goal_type text not null,
  currency text not null default 'INR',
  target_amount numeric(20, 4) not null,
  target_date date null,
  start_date date not null default current_date,
  priority integer not null default 0,
  funding_mode text not null default 'earmarked',
  purpose_wallet_id uuid null references public.purpose_wallets (id) on delete set null,
  status text not null default 'active',
  notes text null,

  -- Emergency-fund-specific configuration (null for every other goal_type).
  ef_target_method text null,
  ef_target_months integer null,
  ef_essential_monthly_expense numeric(20, 4) null,
  ef_essential_category_ids uuid[] null,
  ef_essential_period_start date null,
  ef_essential_period_end date null,

  -- Sinking-fund-specific configuration (null for every other goal_type).
  sf_contribution_frequency text null,
  sf_linked_recurring_item_id uuid null references public.recurring_items (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint financial_goals_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint financial_goals_type_valid check (
    goal_type in (
      'emergency_fund', 'sinking_fund', 'major_purchase', 'travel', 'education', 'wedding',
      'home', 'vehicle', 'retirement', 'investment', 'custom'
    )
  ),
  constraint financial_goals_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint financial_goals_target_amount_positive check (target_amount > 0),
  constraint financial_goals_target_after_start check (target_date is null or target_date >= start_date),
  constraint financial_goals_funding_mode_valid check (funding_mode in ('earmarked', 'planning_only')),
  constraint financial_goals_status_valid check (
    status in ('draft', 'active', 'paused', 'completed', 'cancelled', 'archived')
  ),
  constraint financial_goals_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint financial_goals_ef_target_method_valid check (
    ef_target_method is null or ef_target_method in ('fixed_amount', 'months_of_expenses')
  ),
  constraint financial_goals_ef_target_months_positive check (ef_target_months is null or ef_target_months > 0),
  constraint financial_goals_ef_essential_expense_nonnegative check (
    ef_essential_monthly_expense is null or ef_essential_monthly_expense >= 0
  ),
  constraint financial_goals_sf_frequency_valid check (
    sf_contribution_frequency is null
    or sf_contribution_frequency in ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly')
  )
);

comment on table public.financial_goals is
  'A savings goal, including emergency_fund and sinking_fund as goal_type values sharing this same table/lifecycle rather than separate hierarchies. target_amount/target_date are always the user''s own planning input — this migration never assumes an investment return or inflation rate on their behalf.';

create index if not exists financial_goals_user_status_idx
  on public.financial_goals (user_id, status, priority desc);
create index if not exists financial_goals_wallet_idx
  on public.financial_goals (purpose_wallet_id) where purpose_wallet_id is not null;

drop trigger if exists set_financial_goals_updated_at on public.financial_goals;
create trigger set_financial_goals_updated_at
  before update on public.financial_goals
  for each row
  execute function public.set_updated_at();

create table if not exists public.goal_account_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.financial_goals (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint goal_account_links_unique unique (goal_id, account_id)
);

comment on table public.goal_account_links is
  'Optional real accounts associated with a goal (e.g. a dedicated savings account an account-transfer contribution funds into) — informational linkage only, never a source of additional balance.';

create table if not exists public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.financial_goals (id) on delete cascade,
  name text not null,
  target_amount numeric(20, 4) not null,
  achieved_at timestamptz null,
  created_at timestamptz not null default now(),

  constraint goal_milestones_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint goal_milestones_target_amount_positive check (target_amount > 0)
);

comment on table public.goal_milestones is
  'A display-only progress checkpoint within a goal (e.g. "50% there"). achieved_at is set explicitly by the user, never inferred automatically.';

create index if not exists goal_milestones_goal_idx on public.goal_milestones (goal_id);

-- =======================================================================
-- 2. public.goal_contributions
-- =======================================================================

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.financial_goals (id) on delete restrict,
  contribution_type text not null,
  direction text not null,
  amount numeric(20, 4) not null,
  currency text not null default 'INR',
  from_account_id uuid null references public.accounts (id) on delete restrict,
  to_account_id uuid null references public.accounts (id) on delete restrict,
  related_transaction_id uuid null references public.ledger_transactions (id) on delete set null,
  idempotency_key text not null,
  status text not null default 'recorded',
  occurred_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now(),

  constraint goal_contributions_type_valid check (contribution_type in ('allocation_only', 'account_transfer')),
  constraint goal_contributions_direction_valid check (direction in ('contribution', 'withdrawal')),
  constraint goal_contributions_amount_positive check (amount > 0),
  constraint goal_contributions_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint goal_contributions_status_valid check (status in ('recorded', 'reversed')),
  constraint goal_contributions_notes_length check (notes is null or char_length(notes) <= 1000),
  -- An account_transfer contribution/withdrawal must carry the real
  -- transfer's account pair and posted transaction; allocation_only must
  -- carry neither, so the two shapes are never confused.
  constraint goal_contributions_transfer_shape check (
    (contribution_type = 'account_transfer' and from_account_id is not null and to_account_id is not null and related_transaction_id is not null)
    or (contribution_type = 'allocation_only' and from_account_id is null and to_account_id is null and related_transaction_id is null)
  ),
  constraint goal_contributions_idempotency_unique unique (user_id, idempotency_key)
);

comment on table public.goal_contributions is
  'One record per contribution or withdrawal against a goal. An account_transfer row''s related_transaction_id is unique (transaction_purpose_allocations-style one-to-one, see goal_contributions_related_transaction_unique) so the same real transfer can never be linked to two contributions.';

create unique index if not exists goal_contributions_related_transaction_unique
  on public.goal_contributions (related_transaction_id) where related_transaction_id is not null;
create index if not exists goal_contributions_goal_idx
  on public.goal_contributions (goal_id, occurred_at desc);

-- =======================================================================
-- 3. RLS — goals.
-- =======================================================================

alter table public.financial_goals enable row level security;
alter table public.financial_goals force row level security;
alter table public.goal_account_links enable row level security;
alter table public.goal_account_links force row level security;
alter table public.goal_milestones enable row level security;
alter table public.goal_milestones force row level security;
alter table public.goal_contributions enable row level security;
alter table public.goal_contributions force row level security;

drop policy if exists financial_goals_select on public.financial_goals;
create policy financial_goals_select on public.financial_goals for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.financial_goals from public, anon, authenticated;
grant select on public.financial_goals to authenticated;

drop policy if exists goal_account_links_select on public.goal_account_links;
create policy goal_account_links_select on public.goal_account_links for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.goal_account_links from public, anon, authenticated;
grant select on public.goal_account_links to authenticated;

drop policy if exists goal_milestones_select on public.goal_milestones;
create policy goal_milestones_select on public.goal_milestones for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.goal_milestones from public, anon, authenticated;
grant select on public.goal_milestones to authenticated;

drop policy if exists goal_contributions_select on public.goal_contributions;
create policy goal_contributions_select on public.goal_contributions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.goal_contributions from public, anon, authenticated;
grant select on public.goal_contributions to authenticated;

-- =======================================================================
-- 4. Goal RPCs.
-- =======================================================================

create or replace function public.create_financial_goal(
  p_name text,
  p_goal_type text,
  p_target_amount numeric,
  p_currency text default 'INR',
  p_target_date date default null,
  p_start_date date default null,
  p_priority integer default 0,
  p_funding_mode text default 'earmarked',
  p_purpose_wallet_id uuid default null,
  p_notes text default null,
  p_ef_target_method text default null,
  p_ef_target_months integer default null,
  p_ef_essential_monthly_expense numeric default null,
  p_ef_essential_category_ids uuid[] default null,
  p_ef_essential_period_start date default null,
  p_ef_essential_period_end date default null,
  p_sf_contribution_frequency text default null
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

  if p_purpose_wallet_id is not null then
    if not exists (select 1 from public.purpose_wallets where id = p_purpose_wallet_id and user_id = v_user_id) then
      raise exception 'Wallet not found' using errcode = '42501';
    end if;
  end if;

  insert into public.financial_goals (
    user_id, name, goal_type, currency, target_amount, target_date, start_date, priority,
    funding_mode, purpose_wallet_id, notes,
    ef_target_method, ef_target_months, ef_essential_monthly_expense, ef_essential_category_ids,
    ef_essential_period_start, ef_essential_period_end, sf_contribution_frequency
  ) values (
    v_user_id, p_name, p_goal_type, p_currency, p_target_amount, p_target_date,
    coalesce(p_start_date, current_date), p_priority, p_funding_mode, p_purpose_wallet_id, p_notes,
    p_ef_target_method, p_ef_target_months, p_ef_essential_monthly_expense, p_ef_essential_category_ids,
    p_ef_essential_period_start, p_ef_essential_period_end, p_sf_contribution_frequency
  )
  returning * into v_goal;

  return v_goal;
end;
$$;

revoke all on function public.create_financial_goal(
  text, text, numeric, text, date, date, integer, text, uuid, text, text, integer, numeric, uuid[], date, date, text
) from public, anon, authenticated;
grant execute on function public.create_financial_goal(
  text, text, numeric, text, date, date, integer, text, uuid, text, text, integer, numeric, uuid[], date, date, text
) to authenticated;

create or replace function public.update_financial_goal(
  p_goal_id uuid,
  p_name text default null,
  p_target_amount numeric default null,
  p_target_date date default null,
  p_priority integer default null,
  p_notes text default null,
  p_ef_target_method text default null,
  p_ef_target_months integer default null,
  p_ef_essential_monthly_expense numeric default null,
  p_ef_essential_category_ids uuid[] default null,
  p_sf_contribution_frequency text default null
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

  update public.financial_goals set
    name = coalesce(p_name, name),
    target_amount = coalesce(p_target_amount, target_amount),
    target_date = coalesce(p_target_date, target_date),
    priority = coalesce(p_priority, priority),
    notes = coalesce(p_notes, notes),
    ef_target_method = coalesce(p_ef_target_method, ef_target_method),
    ef_target_months = coalesce(p_ef_target_months, ef_target_months),
    ef_essential_monthly_expense = coalesce(p_ef_essential_monthly_expense, ef_essential_monthly_expense),
    ef_essential_category_ids = coalesce(p_ef_essential_category_ids, ef_essential_category_ids),
    sf_contribution_frequency = coalesce(p_sf_contribution_frequency, sf_contribution_frequency)
  where id = p_goal_id and user_id = v_user_id
  returning * into v_goal;

  if v_goal.id is null then
    raise exception 'Goal not found' using errcode = '42501';
  end if;

  return v_goal;
end;
$$;

revoke all on function public.update_financial_goal(uuid, text, numeric, date, integer, text, text, integer, numeric, uuid[], text) from public, anon, authenticated;
grant execute on function public.update_financial_goal(uuid, text, numeric, date, integer, text, text, integer, numeric, uuid[], text) to authenticated;

create or replace function public.set_financial_goal_status(p_goal_id uuid, p_status text)
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
  if p_status not in ('draft', 'active', 'paused', 'completed', 'cancelled', 'archived') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.financial_goals set status = p_status
  where id = p_goal_id and user_id = v_user_id
  returning * into v_goal;

  if v_goal.id is null then
    raise exception 'Goal not found' using errcode = '42501';
  end if;

  return v_goal;
end;
$$;

comment on function public.set_financial_goal_status is
  'Every transition (including completing, cancelling, or reopening a goal) is a plain status change here — completing never creates a transaction, cancelling never deletes goal_contributions history, and reopening a cancelled/completed goal is always allowed (the status history itself, visible via this table''s row, is the audit trail).';

revoke all on function public.set_financial_goal_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_financial_goal_status(uuid, text) to authenticated;

create or replace function public.link_goal_account(p_goal_id uuid, p_account_id uuid)
returns public.goal_account_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_link public.goal_account_links;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.financial_goals where id = p_goal_id and user_id = v_user_id) then
    raise exception 'Goal not found' using errcode = '42501';
  end if;
  if not exists (select 1 from public.accounts where id = p_account_id and user_id = v_user_id) then
    raise exception 'Account not found' using errcode = '42501';
  end if;

  insert into public.goal_account_links (user_id, goal_id, account_id)
  values (v_user_id, p_goal_id, p_account_id)
  on conflict (goal_id, account_id) do nothing
  returning * into v_link;

  if v_link.id is null then
    select * into v_link from public.goal_account_links where goal_id = p_goal_id and account_id = p_account_id;
  end if;

  return v_link;
end;
$$;

revoke all on function public.link_goal_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_goal_account(uuid, uuid) to authenticated;

create or replace function public.unlink_goal_account(p_goal_id uuid, p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  delete from public.goal_account_links
    where goal_id = p_goal_id and account_id = p_account_id and user_id = v_user_id;
end;
$$;

revoke all on function public.unlink_goal_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.unlink_goal_account(uuid, uuid) to authenticated;

create or replace function public.save_goal_milestone(
  p_goal_id uuid,
  p_name text,
  p_target_amount numeric,
  p_achieved boolean default false
)
returns public.goal_milestones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_milestone public.goal_milestones;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.financial_goals where id = p_goal_id and user_id = v_user_id) then
    raise exception 'Goal not found' using errcode = '42501';
  end if;

  insert into public.goal_milestones (user_id, goal_id, name, target_amount, achieved_at)
  values (v_user_id, p_goal_id, p_name, p_target_amount, case when p_achieved then now() else null end)
  returning * into v_milestone;

  return v_milestone;
end;
$$;

revoke all on function public.save_goal_milestone(uuid, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.save_goal_milestone(uuid, text, numeric, boolean) to authenticated;

-- 4a. Allocation-only contribution/withdrawal — earmarks/releases already-
-- held money, creates no ledger transaction, and (when the goal has a
-- linked wallet) writes a matching wallet movement so the two stay
-- consistent.
create or replace function public.record_goal_contribution_allocation(
  p_goal_id uuid,
  p_amount numeric,
  p_direction text,
  p_idempotency_key text,
  p_notes text default null
)
returns public.goal_contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_goal public.financial_goals;
  v_contribution public.goal_contributions;
  v_already_funded numeric;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;
  if p_direction not in ('contribution', 'withdrawal') then
    raise exception 'Invalid direction' using errcode = '22023';
  end if;

  select * into v_goal from public.financial_goals where id = p_goal_id and user_id = v_user_id;
  if v_goal.id is null then
    raise exception 'Goal not found' using errcode = '42501';
  end if;

  select id into v_contribution from public.goal_contributions
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if v_contribution.id is not null then
    select * into v_contribution from public.goal_contributions where id = v_contribution.id;
    return v_contribution;
  end if;

  if p_direction = 'contribution' and v_goal.funding_mode = 'earmarked' then
    select coalesce(sum(gc.amount) filter (where gc.direction = 'contribution')
      - sum(gc.amount) filter (where gc.direction = 'withdrawal'), 0) into v_already_funded
    from public.goal_contributions gc where gc.goal_id = p_goal_id and gc.status = 'recorded';

    if v_already_funded + p_amount > public.eligible_liquid_balance(v_user_id, v_goal.currency) then
      raise exception 'Contribution would exceed eligible liquid balance' using errcode = '22023';
    end if;
  end if;

  insert into public.goal_contributions (
    user_id, goal_id, contribution_type, direction, amount, currency, idempotency_key, notes
  ) values (
    v_user_id, p_goal_id, 'allocation_only', p_direction, p_amount, v_goal.currency, p_idempotency_key, p_notes
  )
  returning * into v_contribution;

  if v_goal.purpose_wallet_id is not null then
    insert into public.purpose_wallet_movements (
      user_id, wallet_id, movement_kind, amount, currency, memo
    ) values (
      v_user_id, v_goal.purpose_wallet_id,
      case when p_direction = 'contribution' then 'goal_contribution' else 'goal_withdrawal' end,
      case when p_direction = 'contribution' then p_amount else -p_amount end,
      v_goal.currency, 'Goal: ' || v_goal.name
    );
  end if;

  return v_contribution;
end;
$$;

revoke all on function public.record_goal_contribution_allocation(uuid, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.record_goal_contribution_allocation(uuid, numeric, text, text, text) to authenticated;

-- 4b. Account-transfer contribution — moves real money between two owned
-- accounts via the same trusted posting core every other transfer uses,
-- and links that one transaction to exactly one goal_contributions row.
create or replace function public.record_goal_contribution_transfer(
  p_goal_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_idempotency_key text,
  p_notes text default null
)
returns public.goal_contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_goal public.financial_goals;
  v_from_account public.accounts;
  v_to_account public.accounts;
  v_transaction public.ledger_transactions;
  v_entries jsonb;
  v_contribution public.goal_contributions;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'Choose two different accounts' using errcode = '22023';
  end if;

  select * into v_goal from public.financial_goals where id = p_goal_id and user_id = v_user_id;
  if v_goal.id is null then
    raise exception 'Goal not found' using errcode = '42501';
  end if;

  select id into v_contribution from public.goal_contributions
    where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if v_contribution.id is not null then
    select * into v_contribution from public.goal_contributions where id = v_contribution.id;
    return v_contribution;
  end if;

  select * into v_from_account from public.accounts where id = p_from_account_id and user_id = v_user_id;
  select * into v_to_account from public.accounts where id = p_to_account_id and user_id = v_user_id;
  if v_from_account.id is null or v_to_account.id is null then
    raise exception 'Account not found' using errcode = '42501';
  end if;
  if v_from_account.currency <> v_to_account.currency or v_from_account.currency <> v_goal.currency then
    raise exception 'Account and goal currencies must match' using errcode = '22023';
  end if;

  v_entries := jsonb_build_array(
    jsonb_build_object('account_id', p_to_account_id, 'amount', p_amount),
    jsonb_build_object('account_id', p_from_account_id, 'amount', -p_amount)
  );

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'transfer', p_occurred_at, 'Goal contribution: ' || v_goal.name, v_entries,
    p_notes, null, null, p_idempotency_key, 'manual'
  );

  select id into v_contribution from public.goal_contributions where related_transaction_id = v_transaction.id;
  if v_contribution.id is not null then
    select * into v_contribution from public.goal_contributions where id = v_contribution.id;
    return v_contribution;
  end if;

  insert into public.goal_contributions (
    user_id, goal_id, contribution_type, direction, amount, currency,
    from_account_id, to_account_id, related_transaction_id, idempotency_key, notes
  ) values (
    v_user_id, p_goal_id, 'account_transfer', 'contribution', p_amount, v_goal.currency,
    p_from_account_id, p_to_account_id, v_transaction.id, p_idempotency_key, p_notes
  )
  returning * into v_contribution;

  if v_goal.purpose_wallet_id is not null then
    insert into public.purpose_wallet_movements (
      user_id, wallet_id, movement_kind, amount, currency, related_transaction_id, memo
    ) values (
      v_user_id, v_goal.purpose_wallet_id, 'goal_contribution', p_amount, v_goal.currency, v_transaction.id,
      'Goal: ' || v_goal.name
    );
  end if;

  return v_contribution;
end;
$$;

revoke all on function public.record_goal_contribution_transfer(uuid, uuid, uuid, numeric, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.record_goal_contribution_transfer(uuid, uuid, uuid, numeric, timestamptz, text, text) to authenticated;

-- Reversal-safety trigger for account-transfer goal contributions —
-- exactly the same shape as the purpose-wallet reversal trigger.
create or replace function public.reverse_goal_contribution_on_transaction_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contribution public.goal_contributions;
  v_goal public.financial_goals;
begin
  if new.reversal_of is null then
    return new;
  end if;

  select * into v_contribution from public.goal_contributions where related_transaction_id = new.reversal_of;
  if v_contribution.id is null then
    return new;
  end if;

  update public.goal_contributions set status = 'reversed' where id = v_contribution.id;

  select * into v_goal from public.financial_goals where id = v_contribution.goal_id;
  if v_goal.purpose_wallet_id is not null then
    insert into public.purpose_wallet_movements (
      user_id, wallet_id, movement_kind, amount, currency, related_transaction_id, memo
    ) values (
      v_contribution.user_id, v_goal.purpose_wallet_id, 'goal_withdrawal', -v_contribution.amount, v_contribution.currency,
      new.id, 'Goal contribution reversed'
    );
  end if;

  return new;
end;
$$;

revoke all on function public.reverse_goal_contribution_on_transaction_reversal() from public, anon, authenticated;

drop trigger if exists reverse_goal_contribution_on_reversal on public.ledger_transactions;
create trigger reverse_goal_contribution_on_reversal
  after insert on public.ledger_transactions
  for each row
  execute function public.reverse_goal_contribution_on_transaction_reversal();

-- =======================================================================
-- 5. public.debts and related tables.
-- =======================================================================

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  debt_type text not null,
  liability_account_id uuid not null references public.accounts (id) on delete restrict,
  currency text not null default 'INR',
  original_principal numeric(20, 4) not null,
  annual_interest_rate numeric(7, 4) not null default 0,
  interest_method text not null default 'reducing_balance',
  payment_frequency text not null default 'monthly',
  start_date date not null,
  contractual_end_date date null,
  minimum_payment numeric(20, 4) null,
  due_day smallint null,
  status text not null default 'active',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint debts_liability_account_unique unique (liability_account_id),
  constraint debts_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint debts_type_valid check (
    debt_type in ('personal_loan', 'home_loan', 'vehicle_loan', 'education_loan', 'credit_card', 'borrowed_money', 'other')
  ),
  constraint debts_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint debts_original_principal_positive check (original_principal > 0),
  constraint debts_rate_nonnegative check (annual_interest_rate >= 0 and annual_interest_rate <= 100),
  constraint debts_interest_method_valid check (interest_method in ('reducing_balance', 'flat_rate', 'manual_schedule')),
  constraint debts_frequency_valid check (payment_frequency in ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
  constraint debts_end_after_start check (contractual_end_date is null or contractual_end_date >= start_date),
  constraint debts_minimum_payment_positive check (minimum_payment is null or minimum_payment > 0),
  constraint debts_due_day_range check (due_day is null or (due_day between 1 and 31)),
  constraint debts_status_valid check (
    status in ('draft', 'active', 'paused', 'paid_off', 'closed', 'defaulted', 'archived')
  ),
  constraint debts_notes_length check (notes is null or char_length(notes) <= 2000)
);

comment on table public.debts is
  'A debt/loan''s terms, one row per liability account (debts_liability_account_unique). This table never stores a mutable "current principal" — see public.debt_current_principal(), which always derives it from public.account_balances for the linked liability account, the same ledger-backed value every other balance in this app already uses.';

create index if not exists debts_user_status_idx on public.debts (user_id, status);

drop trigger if exists set_debts_updated_at on public.debts;
create trigger set_debts_updated_at
  before update on public.debts
  for each row
  execute function public.set_updated_at();

create table if not exists public.debt_rate_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  annual_interest_rate numeric(7, 4) not null,
  effective_date date not null,
  notes text null,
  created_at timestamptz not null default now(),

  constraint debt_rate_history_rate_nonnegative check (annual_interest_rate >= 0 and annual_interest_rate <= 100),
  constraint debt_rate_history_notes_length check (notes is null or char_length(notes) <= 500),
  constraint debt_rate_history_debt_date_unique unique (debt_id, effective_date)
);

comment on table public.debt_rate_history is
  'Append-only record of every interest-rate change over a debt''s life — never updated or deleted, so a past rate is never lost even after debts.annual_interest_rate is changed to reflect the current rate.';

create index if not exists debt_rate_history_debt_idx on public.debt_rate_history (debt_id, effective_date desc);

create table if not exists public.debt_payment_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  installment_number integer not null,
  due_date date not null,
  opening_principal numeric(20, 4) not null,
  scheduled_payment numeric(20, 4) not null,
  principal_component numeric(20, 4) not null,
  interest_component numeric(20, 4) not null,
  fees_component numeric(20, 4) not null default 0,
  closing_principal numeric(20, 4) not null,
  generated_at timestamptz not null default now(),

  constraint debt_payment_schedules_debt_installment_unique unique (debt_id, installment_number),
  constraint debt_payment_schedules_installment_positive check (installment_number > 0),
  constraint debt_payment_schedules_amounts_nonnegative check (
    opening_principal >= 0 and scheduled_payment >= 0 and principal_component >= 0
    and interest_component >= 0 and fees_component >= 0 and closing_principal >= 0
  )
);

comment on table public.debt_payment_schedules is
  'Generated amortization projections — a row here is a projection until a debt_payments row actually references it (schedule_row_id), which this table deliberately never stores as its own status column (would let "paid" drift from reality). Regenerating deletes and reinserts only rows with no linked payment (see regenerate_debt_payment_schedule) — a paid installment is structurally unrewritable.';

create index if not exists debt_payment_schedules_debt_idx
  on public.debt_payment_schedules (debt_id, installment_number);
create index if not exists debt_payment_schedules_due_date_idx
  on public.debt_payment_schedules (user_id, due_date);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete restrict,
  schedule_row_id uuid null references public.debt_payment_schedules (id) on delete set null,
  payment_type text not null default 'scheduled',
  principal_amount numeric(20, 4) not null,
  interest_amount numeric(20, 4) not null default 0,
  fees_amount numeric(20, 4) not null default 0,
  payment_account_id uuid not null references public.accounts (id) on delete restrict,
  related_transaction_id uuid not null references public.ledger_transactions (id) on delete restrict,
  prepayment_assumption text null,
  status text not null default 'posted',
  effective_date date not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),

  constraint debt_payments_type_valid check (payment_type in ('scheduled', 'prepayment')),
  constraint debt_payments_principal_nonnegative check (principal_amount >= 0),
  constraint debt_payments_interest_nonnegative check (interest_amount >= 0),
  constraint debt_payments_fees_nonnegative check (fees_amount >= 0),
  constraint debt_payments_total_positive check (principal_amount + interest_amount + fees_amount > 0),
  constraint debt_payments_prepayment_assumption_valid check (
    prepayment_assumption is null or prepayment_assumption in ('reduce_tenure', 'reduce_payment', 'custom')
  ),
  constraint debt_payments_status_valid check (status in ('posted', 'reversed')),
  constraint debt_payments_related_transaction_unique unique (related_transaction_id),
  constraint debt_payments_idempotency_unique unique (user_id, idempotency_key)
);

comment on table public.debt_payments is
  'One row per posted debt payment, one-to-one with the ledger transaction that actually moved money (debt_payments_related_transaction_unique) — the accounting effect always lives in ledger_entries via the trusted posting core, never duplicated here. total payment = principal_amount + interest_amount + fees_amount (debt_payments_total_positive); the principal portion is never itself an expense (see record_debt_payment''s entry construction).';

create index if not exists debt_payments_debt_idx on public.debt_payments (debt_id, effective_date desc);

-- =======================================================================
-- 6. RLS — debts.
-- =======================================================================

alter table public.debts enable row level security;
alter table public.debts force row level security;
alter table public.debt_rate_history enable row level security;
alter table public.debt_rate_history force row level security;
alter table public.debt_payment_schedules enable row level security;
alter table public.debt_payment_schedules force row level security;
alter table public.debt_payments enable row level security;
alter table public.debt_payments force row level security;

drop policy if exists debts_select on public.debts;
create policy debts_select on public.debts for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.debts from public, anon, authenticated;
grant select on public.debts to authenticated;

drop policy if exists debt_rate_history_select on public.debt_rate_history;
create policy debt_rate_history_select on public.debt_rate_history for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.debt_rate_history from public, anon, authenticated;
grant select on public.debt_rate_history to authenticated;

drop policy if exists debt_payment_schedules_select on public.debt_payment_schedules;
create policy debt_payment_schedules_select on public.debt_payment_schedules for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.debt_payment_schedules from public, anon, authenticated;
grant select on public.debt_payment_schedules to authenticated;

drop policy if exists debt_payments_select on public.debt_payments;
create policy debt_payments_select on public.debt_payments for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.debt_payments from public, anon, authenticated;
grant select on public.debt_payments to authenticated;

-- =======================================================================
-- 7. Derived current-principal helper.
-- =======================================================================

create or replace function public.debt_current_principal(p_debt_id uuid)
returns numeric
language sql
security invoker
stable
as $$
  select b.display_balance
  from public.debts d
  join public.account_balances b on b.account_id = d.liability_account_id
  where d.id = p_debt_id;
$$;

comment on function public.debt_current_principal is
  'The debt''s current outstanding principal, always derived live from account_balances for its liability account — never a stored column that could diverge from the ledger.';

-- Granted directly to authenticated (not internal-only): a genuinely
-- useful read for the debt detail page/TypeScript queries layer, and
-- safe to expose since it is security invoker over RLS-protected tables
-- — calling it with another user's debt id simply returns no row rather
-- than leaking a balance.
revoke all on function public.debt_current_principal(uuid) from public, anon;
grant execute on function public.debt_current_principal(uuid) to authenticated;

-- =======================================================================
-- 8. Debt RPCs.
-- =======================================================================

create or replace function public.create_debt(
  p_name text,
  p_debt_type text,
  p_liability_account_id uuid,
  p_original_principal numeric,
  p_start_date date,
  p_currency text default 'INR',
  p_annual_interest_rate numeric default 0,
  p_interest_method text default 'reducing_balance',
  p_payment_frequency text default 'monthly',
  p_contractual_end_date date default null,
  p_minimum_payment numeric default null,
  p_due_day integer default null,
  p_notes text default null
)
returns public.debts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_account public.accounts;
  v_debt public.debts;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_account from public.accounts where id = p_liability_account_id and user_id = v_user_id;
  if v_account.id is null then
    raise exception 'Account not found' using errcode = '42501';
  end if;
  if v_account.account_class <> 'liability' then
    raise exception 'A debt must be linked to a liability account' using errcode = '22023';
  end if;
  if v_account.currency <> p_currency then
    raise exception 'Debt currency must match the liability account currency' using errcode = '22023';
  end if;

  insert into public.debts (
    user_id, name, debt_type, liability_account_id, currency, original_principal, annual_interest_rate,
    interest_method, payment_frequency, start_date, contractual_end_date, minimum_payment, due_day, notes
  ) values (
    v_user_id, p_name, p_debt_type, p_liability_account_id, p_currency, p_original_principal, p_annual_interest_rate,
    p_interest_method, p_payment_frequency, p_start_date, p_contractual_end_date, p_minimum_payment, p_due_day, p_notes
  )
  returning * into v_debt;

  insert into public.debt_rate_history (user_id, debt_id, annual_interest_rate, effective_date)
  values (v_user_id, v_debt.id, p_annual_interest_rate, p_start_date);

  return v_debt;
end;
$$;

revoke all on function public.create_debt(text, text, uuid, numeric, date, text, numeric, text, text, date, numeric, integer, text) from public, anon, authenticated;
grant execute on function public.create_debt(text, text, uuid, numeric, date, text, numeric, text, text, date, numeric, integer, text) to authenticated;

-- 8a. Record a NEW loan's disbursement — proceeds land in a real asset
-- account, the liability increases by the same amount, in one balanced
-- transaction via the existing trusted posting core. Only for a brand-new
-- loan; an existing mid-loan debt is instead recorded via the liability
-- account's own opening balance (create_account_with_opening_balance),
-- exactly like any other liability account.
create or replace function public.record_debt_proceeds(
  p_debt_id uuid,
  p_receiving_account_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_idempotency_key text
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_debt public.debts;
  v_receiving_account public.accounts;
  v_entries jsonb;
  v_transaction public.ledger_transactions;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;

  select * into v_debt from public.debts where id = p_debt_id and user_id = v_user_id;
  if v_debt.id is null then
    raise exception 'Debt not found' using errcode = '42501';
  end if;

  select * into v_receiving_account from public.accounts where id = p_receiving_account_id and user_id = v_user_id;
  if v_receiving_account.id is null then
    raise exception 'Receiving account not found' using errcode = '42501';
  end if;
  if v_receiving_account.currency <> v_debt.currency then
    raise exception 'Receiving account currency must match the debt currency' using errcode = '22023';
  end if;

  v_entries := jsonb_build_array(
    jsonb_build_object('account_id', p_receiving_account_id, 'amount', p_amount),
    jsonb_build_object('account_id', v_debt.liability_account_id, 'amount', -p_amount)
  );

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'debt_proceeds', p_occurred_at, 'Loan proceeds: ' || v_debt.name, v_entries,
    null, null, null, p_idempotency_key, 'manual'
  );

  return v_transaction;
end;
$$;

revoke all on function public.record_debt_proceeds(uuid, uuid, numeric, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_debt_proceeds(uuid, uuid, numeric, timestamptz, text) to authenticated;

-- 8b. Change a debt's rate going forward — appends to debt_rate_history
-- and updates the debt's own current-rate column; never rewrites a past
-- history row.
create or replace function public.change_debt_rate(
  p_debt_id uuid,
  p_annual_interest_rate numeric,
  p_effective_date date,
  p_notes text default null
)
returns public.debts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_debt public.debts;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_debt from public.debts where id = p_debt_id and user_id = v_user_id;
  if v_debt.id is null then
    raise exception 'Debt not found' using errcode = '42501';
  end if;

  insert into public.debt_rate_history (user_id, debt_id, annual_interest_rate, effective_date, notes)
  values (v_user_id, p_debt_id, p_annual_interest_rate, p_effective_date, p_notes)
  on conflict (debt_id, effective_date) do update set annual_interest_rate = excluded.annual_interest_rate, notes = excluded.notes;

  update public.debts set annual_interest_rate = p_annual_interest_rate
  where id = p_debt_id
  returning * into v_debt;

  return v_debt;
end;
$$;

revoke all on function public.change_debt_rate(uuid, numeric, date, text) from public, anon, authenticated;
grant execute on function public.change_debt_rate(uuid, numeric, date, text) to authenticated;

-- 8c. Generate (or regenerate) a reducing-balance/flat-rate amortization
-- schedule. Regeneration only ever removes/replaces rows with no linked
-- debt_payments row — a paid installment can never be rewritten. EMI due
-- dates step using the exact same day-of-month-clamped month arithmetic
-- as Phase 6's recurring items (public.recurring_occurrence_date),
-- called directly rather than duplicated, for every frequency other than
-- 'weekly' which recurring_occurrence_date already also handles.
create or replace function public.regenerate_debt_payment_schedule(
  p_debt_id uuid,
  p_installment_count integer,
  p_installment_payment numeric default null
)
returns setof public.debt_payment_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_debt public.debts;
  v_last_paid_installment integer;
  v_opening numeric;
  v_start_installment integer;
  v_anchor date;
  v_periods_per_year numeric;
  v_period_rate numeric;
  v_k integer;
  v_due_date date;
  v_interest numeric;
  v_principal numeric;
  v_payment numeric;
  v_closing numeric;
  v_row public.debt_payment_schedules;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_installment_count is null or p_installment_count < 1 or p_installment_count > 600 then
    raise exception 'Installment count must be between 1 and 600' using errcode = '22023';
  end if;

  select * into v_debt from public.debts where id = p_debt_id and user_id = v_user_id;
  if v_debt.id is null then
    raise exception 'Debt not found' using errcode = '42501';
  end if;
  if v_debt.interest_method = 'manual_schedule' then
    raise exception 'A manual_schedule debt does not use generated amortization rows' using errcode = '22023';
  end if;

  select max(installment_number) into v_last_paid_installment
  from public.debt_payment_schedules s
  where s.debt_id = p_debt_id and exists (select 1 from public.debt_payments p where p.schedule_row_id = s.id);

  -- Delete only future, unpaid projection rows.
  delete from public.debt_payment_schedules
  where debt_id = p_debt_id
    and installment_number > coalesce(v_last_paid_installment, 0)
    and not exists (select 1 from public.debt_payments p where p.schedule_row_id = debt_payment_schedules.id);

  v_start_installment := coalesce(v_last_paid_installment, 0) + 1;
  -- nullif(..., 0): a debt with no ledger activity yet (proceeds/opening
  -- balance not posted) has a real display_balance of exactly 0, which
  -- would otherwise silently start the schedule from a zero principal
  -- instead of the debt's own stated original_principal.
  v_opening := coalesce(
    (select closing_principal from public.debt_payment_schedules where debt_id = p_debt_id and installment_number = v_last_paid_installment),
    nullif(public.debt_current_principal(p_debt_id), 0),
    v_debt.original_principal
  );
  v_anchor := coalesce(
    (select due_date from public.debt_payment_schedules where debt_id = p_debt_id and installment_number = v_last_paid_installment),
    v_debt.start_date
  );

  v_periods_per_year := case v_debt.payment_frequency
    when 'weekly' then 52 when 'monthly' then 12 when 'quarterly' then 4
    when 'half_yearly' then 2 when 'yearly' then 1 else 12
  end;
  v_period_rate := (v_debt.annual_interest_rate / 100) / v_periods_per_year;

  -- A level payment amount: explicit override, else the debt's own
  -- minimum_payment, else a standard reducing-balance annuity formula
  -- (falls back to straight-line principal when the rate is zero, since
  -- the annuity formula divides by zero at rate = 0).
  v_payment := coalesce(
    p_installment_payment,
    v_debt.minimum_payment,
    case
      when v_period_rate = 0 then round(v_opening / p_installment_count, 4)
      else round(v_opening * v_period_rate / (1 - power(1 + v_period_rate, -p_installment_count)), 4)
    end
  );

  for v_k in 0 .. (p_installment_count - 1) loop
    v_due_date := case
      when v_debt.payment_frequency = 'weekly' then public.recurring_occurrence_date(v_anchor, 'weekly', 1, v_k + 1)
      else public.recurring_occurrence_date(v_anchor, v_debt.payment_frequency, 1, v_k + 1)
    end;

    if v_debt.interest_method = 'flat_rate' then
      v_interest := round(v_debt.original_principal * v_period_rate, 4);
      v_principal := round(v_debt.original_principal / p_installment_count, 4);
    else
      v_interest := round(v_opening * v_period_rate, 4);
      v_principal := v_payment - v_interest;
    end if;

    -- Final-installment rounding adjustment: the last row always closes
    -- the schedule to exactly zero rather than leaving a stray paisa.
    if v_k = p_installment_count - 1 or v_opening - v_principal < 0 then
      v_principal := v_opening;
      v_payment := v_principal + v_interest;
    end if;

    v_closing := v_opening - v_principal;

    insert into public.debt_payment_schedules (
      user_id, debt_id, installment_number, due_date, opening_principal, scheduled_payment,
      principal_component, interest_component, fees_component, closing_principal
    ) values (
      v_user_id, p_debt_id, v_start_installment + v_k, v_due_date, v_opening, v_payment,
      v_principal, v_interest, 0, v_closing
    )
    returning * into v_row;

    return next v_row;

    v_opening := v_closing;
    exit when v_opening <= 0;
  end loop;
end;
$$;

comment on function public.regenerate_debt_payment_schedule is
  'Generates a bounded (<=600 rows) set of projected amortization rows. Never modifies a row a debt_payments entry already references — only deletes/replaces future, unpaid rows, so a rate change or extra payment can be reflected in a revised future scenario without rewriting history.';

revoke all on function public.regenerate_debt_payment_schedule(uuid, integer, numeric) from public, anon, authenticated;
grant execute on function public.regenerate_debt_payment_schedule(uuid, integer, numeric) to authenticated;

-- 8d. Record an actual debt payment — principal reduces the liability
-- (never an expense), interest/fees are the expense, one balanced
-- transaction via the trusted posting core. Idempotent: retrying the
-- same idempotency_key returns the already-recorded row rather than
-- erroring or duplicating.
create or replace function public.record_debt_payment(
  p_debt_id uuid,
  p_principal_amount numeric,
  p_interest_amount numeric,
  p_fees_amount numeric,
  p_payment_account_id uuid,
  p_effective_date date,
  p_idempotency_key text,
  p_payment_type text default 'scheduled',
  p_schedule_row_id uuid default null,
  p_prepayment_assumption text default null,
  p_allow_overpayment boolean default false
)
returns public.debt_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_debt public.debts;
  v_account public.accounts;
  v_current_principal numeric;
  v_total numeric;
  v_entries jsonb;
  v_transaction public.ledger_transactions;
  v_payment public.debt_payments;
  v_system_expense_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_payment from public.debt_payments where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if v_payment.id is not null then
    return v_payment;
  end if;

  if coalesce(p_principal_amount, 0) < 0 or coalesce(p_interest_amount, 0) < 0 or coalesce(p_fees_amount, 0) < 0 then
    raise exception 'Payment components cannot be negative' using errcode = '22023';
  end if;
  v_total := coalesce(p_principal_amount, 0) + coalesce(p_interest_amount, 0) + coalesce(p_fees_amount, 0);
  if v_total <= 0 then
    raise exception 'Payment total must be positive' using errcode = '22023';
  end if;

  select * into v_debt from public.debts where id = p_debt_id and user_id = v_user_id;
  if v_debt.id is null then
    raise exception 'Debt not found' using errcode = '42501';
  end if;

  select * into v_account from public.accounts where id = p_payment_account_id and user_id = v_user_id;
  if v_account.id is null then
    raise exception 'Payment account not found' using errcode = '42501';
  end if;
  if v_account.currency <> v_debt.currency then
    raise exception 'Payment account currency must match the debt currency' using errcode = '22023';
  end if;

  v_current_principal := public.debt_current_principal(p_debt_id);
  if not p_allow_overpayment and p_principal_amount > v_current_principal then
    raise exception 'Principal payment (%) exceeds the outstanding principal (%) — pass p_allow_overpayment to force it',
      p_principal_amount, v_current_principal using errcode = '22023';
  end if;

  if p_interest_amount + p_fees_amount > 0 then
    select id into v_system_expense_id from public.accounts
      where user_id = v_user_id and is_system = true and system_code = 'uncategorized_expense';
    if v_system_expense_id is null then
      raise exception 'uncategorized_expense system account is missing for this user' using errcode = '22023';
    end if;
    v_entries := jsonb_build_array(
      jsonb_build_object('account_id', p_payment_account_id, 'amount', -v_total),
      jsonb_build_object('account_id', v_debt.liability_account_id, 'amount', p_principal_amount),
      jsonb_build_object('account_id', v_system_expense_id, 'amount', p_interest_amount + p_fees_amount)
    );
  else
    v_entries := jsonb_build_array(
      jsonb_build_object('account_id', p_payment_account_id, 'amount', -v_total),
      jsonb_build_object('account_id', v_debt.liability_account_id, 'amount', p_principal_amount)
    );
  end if;

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'debt_payment', p_effective_date::timestamptz, 'Debt payment: ' || v_debt.name, v_entries,
    null, null, null, p_idempotency_key, 'manual'
  );

  select * into v_payment from public.debt_payments where related_transaction_id = v_transaction.id;
  if v_payment.id is not null then
    return v_payment;
  end if;

  insert into public.debt_payments (
    user_id, debt_id, schedule_row_id, payment_type, principal_amount, interest_amount, fees_amount,
    payment_account_id, related_transaction_id, prepayment_assumption, effective_date, idempotency_key
  ) values (
    v_user_id, p_debt_id, p_schedule_row_id, p_payment_type, p_principal_amount, p_interest_amount, p_fees_amount,
    p_payment_account_id, v_transaction.id, p_prepayment_assumption, p_effective_date, p_idempotency_key
  )
  returning * into v_payment;

  if v_current_principal - p_principal_amount <= 0 then
    update public.debts set status = 'paid_off' where id = p_debt_id and status = 'active';
  end if;

  return v_payment;
end;
$$;

comment on function public.record_debt_payment is
  'The one trusted boundary for posting a debt payment (scheduled or prepayment) — builds a 2-or-3-entry balanced transaction (payment account out; liability reduced by principal only; interest+fees as an expense) via post_manual_transaction_for_user, never duplicating its logic. Idempotent per idempotency_key; retrying returns the already-recorded row.';

revoke all on function public.record_debt_payment(uuid, numeric, numeric, numeric, uuid, date, text, text, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.record_debt_payment(uuid, numeric, numeric, numeric, uuid, date, text, text, uuid, text, boolean) to authenticated;

create or replace function public.reverse_debt_payment_on_transaction_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reversal_of is null then
    return new;
  end if;

  update public.debt_payments set status = 'reversed' where related_transaction_id = new.reversal_of;

  return new;
end;
$$;

revoke all on function public.reverse_debt_payment_on_transaction_reversal() from public, anon, authenticated;

drop trigger if exists reverse_debt_payment_on_reversal on public.ledger_transactions;
create trigger reverse_debt_payment_on_reversal
  after insert on public.ledger_transactions
  for each row
  execute function public.reverse_debt_payment_on_transaction_reversal();

create or replace function public.set_debt_status(p_debt_id uuid, p_status text)
returns public.debts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_debt public.debts;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'active', 'paused', 'paid_off', 'closed', 'defaulted', 'archived') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.debts set status = p_status
  where id = p_debt_id and user_id = v_user_id
  returning * into v_debt;

  if v_debt.id is null then
    raise exception 'Debt not found' using errcode = '42501';
  end if;

  return v_debt;
end;
$$;

revoke all on function public.set_debt_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_debt_status(uuid, text) to authenticated;

-- =======================================================================
-- 9. Purpose-wallet available-balance summary (moved here since it needs
--    both purpose_wallets and, for overspent/coverage context, nothing
--    from this file specifically — kept adjacent to get_safe_to_spend_
--    summary's sibling reads for discoverability).
-- =======================================================================

create or replace function public.get_purpose_wallet_summary()
returns table (
  wallet_id uuid,
  name text,
  currency text,
  funding_mode text,
  status text,
  target_amount numeric,
  allocated_balance numeric,
  spent_amount numeric,
  overspent_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  return query
  select
    w.id,
    w.name,
    w.currency,
    w.funding_mode,
    w.status,
    w.target_amount,
    coalesce(sum(m.amount), 0)::numeric(20, 4) as allocated_balance,
    coalesce(-sum(m.amount) filter (where m.movement_kind = 'expense_spend'), 0)::numeric(20, 4)
      - coalesce(sum(m.amount) filter (where m.movement_kind = 'expense_reversal'), 0)::numeric(20, 4) as spent_amount,
    greatest(-coalesce(sum(m.amount), 0), 0)::numeric(20, 4) as overspent_amount
  from public.purpose_wallets w
  left join public.purpose_wallet_movements m on m.wallet_id = w.id
  where w.user_id = v_user_id
  group by w.id, w.name, w.currency, w.funding_mode, w.status, w.target_amount
  order by w.priority desc, w.name;
end;
$$;

comment on function public.get_purpose_wallet_summary is
  'allocated_balance is always the sum of purpose_wallet_movements for that wallet — never a cached total. overspent_amount is only ever positive (a negative allocated_balance), and is always shown, never hidden, per the spec''s "negative available balance is a visible overspent state, never hidden" requirement.';

revoke all on function public.get_purpose_wallet_summary() from public, anon;
grant execute on function public.get_purpose_wallet_summary() to authenticated;

-- =======================================================================
-- 10. Planning reminders — computed live, never persisted, following the
--     exact same pattern as public.research_review_reminders() /
--     public.upcoming_maturity_events().
-- =======================================================================

create or replace function public.financial_planning_reminders()
returns table (reminder_type text, related_id uuid, title text, due_date date)
language sql
security invoker
stable
as $$
  -- Goal contribution / target approaching / off track.
  select 'goal_target_approaching'::text, g.id, g.name, g.target_date
  from public.financial_goals g
  where g.status = 'active' and g.target_date is not null
    and g.target_date between current_date and current_date + 30

  union all

  select 'emergency_fund_below_target'::text, g.id, g.name, null::date
  from public.financial_goals g
  where g.status = 'active' and g.goal_type = 'emergency_fund'
    and g.target_amount > coalesce((
      select sum(c.amount) filter (where c.direction = 'contribution') - sum(c.amount) filter (where c.direction = 'withdrawal')
      from public.goal_contributions c where c.goal_id = g.id and c.status = 'recorded'
    ), 0)

  union all

  select 'sinking_fund_due_soon'::text, g.id, g.name, g.target_date
  from public.financial_goals g
  where g.status = 'active' and g.goal_type = 'sinking_fund' and g.target_date is not null
    and g.target_date between current_date and current_date + 30

  union all

  select 'debt_payment_due'::text, s.debt_id, d.name, s.due_date
  from public.debt_payment_schedules s
  join public.debts d on d.id = s.debt_id
  where d.status = 'active'
    and s.due_date between current_date and current_date + 7
    and not exists (select 1 from public.debt_payments p where p.schedule_row_id = s.id)

  union all

  select 'debt_payment_overdue'::text, s.debt_id, d.name, s.due_date
  from public.debt_payment_schedules s
  join public.debts d on d.id = s.debt_id
  where d.status = 'active'
    and s.due_date < current_date
    and not exists (select 1 from public.debt_payments p where p.schedule_row_id = s.id)

  union all

  select 'purpose_wallet_overspent'::text, w.id, w.name, null::date
  from public.purpose_wallets w
  where w.status = 'active'
    and (select coalesce(sum(m.amount), 0) from public.purpose_wallet_movements m where m.wallet_id = w.id) < 0
$$;

comment on function public.financial_planning_reminders is
  'Deliberately never persisted — computed live from goals/debts/wallets, mirroring public.research_review_reminders()''s established convention. security invoker so RLS naturally scopes every underlying query to the caller.';

revoke all on function public.financial_planning_reminders() from public, anon;
grant execute on function public.financial_planning_reminders() to authenticated;
