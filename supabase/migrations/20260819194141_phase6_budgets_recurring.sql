-- Phase 6: monthly category budgets, recurring items (subscriptions,
-- bills, recurring income, recurring transfers), generated occurrences,
-- Supabase Cron automation, and a self-scoped catch-up path.
--
-- Scope: two new independent feature areas built entirely on top of the
-- existing Phase 3/5 double-entry ledger — neither budgets nor recurring
-- items introduce a second source of financial truth. Budget "actuals" are
-- always derived live from posted ledger entries (never a stored, mutable
-- running total); every recurring auto-post transaction is created through
-- the exact same posting core Phase 5 already uses for manual transactions
-- (see section 5), not a parallel/weaker re-implementation.
--
-- No investments, market data, bank sync, or CSV import. No email/SMS/push
-- reminders — only in-app surfaces derived from occurrence rows. Tags
-- remain out of scope, unchanged from Phase 5's decision.

-- =======================================================================
-- 1. Shared helper: Asia/Kolkata calendar-month boundaries
-- =======================================================================
-- The rest of the app hardcodes Asia/Kolkata throughout (see
-- src/lib/dates/timezone.ts — this is a single-user, India-focused app;
-- profiles.timezone exists but nothing branches on a value other than the
-- IST default). Budgets follow the same convention rather than inventing
-- per-row timezone handling nothing else in the codebase supports yet.
-- Embedding the explicit +05:30 offset in the cast (rather than relying on
-- the session/database timezone for a bare `date::timestamptz`) is what
-- makes this correct regardless of how the connection's timezone GUC is
-- configured.

create or replace function public.ist_month_bounds(p_period_month date)
returns table (period_start timestamptz, period_end timestamptz)
language sql
immutable
set search_path = ''
as $$
  select
    (p_period_month::text || ' 00:00:00+05:30')::timestamptz,
    (((p_period_month + interval '1 month')::date)::text || ' 00:00:00+05:30')::timestamptz;
$$;

comment on function public.ist_month_bounds(date) is
  'Given the first day of a calendar month, returns [period_start, '
  'period_end) as Asia/Kolkata-anchored UTC instants — the half-open '
  'window every budget aggregation query below filters occurred_at with.';

-- =======================================================================
-- 2. public.budget_periods
-- =======================================================================

create table if not exists public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_month date not null,
  currency text not null default 'INR',
  planned_income numeric(20, 4) null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budget_periods_month_is_first_of_month check (
    extract(day from period_month) = 1
  ),
  constraint budget_periods_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint budget_periods_planned_income_nonnegative check (
    planned_income is null or planned_income >= 0
  ),
  constraint budget_periods_notes_length check (
    notes is null or char_length(notes) <= 2000
  ),
  constraint budget_periods_unique_user_month_currency
    unique (user_id, period_month, currency)
);

comment on table public.budget_periods is
  'One row per user/calendar-month/currency. Actual spending is never '
  'stored here — only the plan (optional planned_income) and, via '
  'budget_allocations, per-category planned amounts. Historical periods '
  'are viewed, never mutated by anything other than the user''s own '
  'explicit edit — there is no automatic rollover between months (see '
  'budget_allocations comment).';

drop trigger if exists set_budget_periods_updated_at on public.budget_periods;
create trigger set_budget_periods_updated_at
  before update on public.budget_periods
  for each row
  execute function public.set_updated_at();

create index if not exists budget_periods_user_id_idx on public.budget_periods (user_id);

-- =======================================================================
-- 3. public.budget_allocations
-- =======================================================================
-- No currency column here by design: an allocation has no inherent
-- currency of its own, only the numeric planned_amount it contributes
-- under its parent budget_period's currency — so "must use the same
-- currency as its budget period" holds by construction, with nothing to
-- ever validate or drift out of sync.
--
-- No rollover: editing or copying (section 6c) are the only ways an
-- allocation's amount ever changes between months — nothing here reads a
-- previous period's actuals/leftover and carries it forward automatically.

create table if not exists public.budget_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_period_id uuid not null references public.budget_periods (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  planned_amount numeric(20, 4) not null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budget_allocations_amount_nonnegative check (planned_amount >= 0),
  constraint budget_allocations_notes_length check (
    notes is null or char_length(notes) <= 1000
  ),
  constraint budget_allocations_unique_period_category
    unique (budget_period_id, category_id)
);

comment on table public.budget_allocations is
  'A planned amount for one expense category within one budget period. '
  'Actual spending is never stored as a column here — see budget_summary '
  '/ budget_category_progress, which derive it live from posted ledger '
  'entries the same way the Phase 5 dashboard does.';

drop trigger if exists set_budget_allocations_updated_at on public.budget_allocations;
create trigger set_budget_allocations_updated_at
  before update on public.budget_allocations
  for each row
  execute function public.set_updated_at();

create index if not exists budget_allocations_user_id_idx on public.budget_allocations (user_id);
create index if not exists budget_allocations_budget_period_id_idx on public.budget_allocations (budget_period_id);

-- 3a. Cross-row validation: category must be the caller's own expense
-- category; budget_period must be the caller's own. Mirrors
-- validate_ledger_entry's ownership-lookup style (Phase 3).
create or replace function public.validate_budget_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_user_id uuid;
  v_category_type text;
  v_period_user_id uuid;
begin
  select user_id, category_type into v_category_user_id, v_category_type
    from public.categories
    where id = new.category_id;

  if v_category_user_id is null then
    raise exception 'budget allocation references a non-existent category'
      using errcode = 'foreign_key_violation';
  end if;

  if v_category_user_id <> new.user_id then
    raise exception 'budget allocation category does not belong to the caller'
      using errcode = 'insufficient_privilege';
  end if;

  if v_category_type <> 'expense' then
    raise exception 'budget allocations can only reference an expense category'
      using errcode = 'check_violation';
  end if;

  select user_id into v_period_user_id
    from public.budget_periods
    where id = new.budget_period_id;

  if v_period_user_id is null then
    raise exception 'budget allocation references a non-existent budget period'
      using errcode = 'foreign_key_violation';
  end if;

  if v_period_user_id <> new.user_id then
    raise exception 'budget allocation budget period does not belong to the caller'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_budget_allocation() from public, anon, authenticated;

drop trigger if exists budget_allocations_validate_refs on public.budget_allocations;
create trigger budget_allocations_validate_refs
  before insert or update on public.budget_allocations
  for each row
  execute function public.validate_budget_allocation();

-- =======================================================================
-- 4. Budget read/write functions
-- =======================================================================
-- Writes follow the same "table grants are read-only; every mutation goes
-- through a SECURITY DEFINER function" pattern Phase 3/5 use for the
-- ledger itself (not the simpler direct-RLS-write pattern Phase 5 used for
-- categories/payees) — budget writes need the same kind of atomic,
-- multi-row, cross-validated handling manual transactions do.

-- 4a. Get or create this month's budget period for the caller. Race-safe
-- insert-or-fetch, same shape as create_manual_transaction's idempotent
-- insert (Phase 5): the unique index is the single source of truth for
-- "does this period already exist," never a separate select-then-insert.
create or replace function public.get_or_create_budget_period(
  p_period_month date,
  p_currency text default 'INR'
)
returns public.budget_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_month date := date_trunc('month', p_period_month)::date;
  v_period public.budget_periods;
begin
  if v_user_id is null then
    raise exception 'get_or_create_budget_period requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.budget_periods (user_id, period_month, currency)
  values (v_user_id, v_month, p_currency)
  on conflict (user_id, period_month, currency) do nothing
  returning * into v_period;

  if v_period.id is null then
    select * into v_period
      from public.budget_periods
      where user_id = v_user_id and period_month = v_month and currency = p_currency;
  end if;

  return v_period;
end;
$$;

revoke all on function public.get_or_create_budget_period(date, text) from public, anon;
grant execute on function public.get_or_create_budget_period(date, text) to authenticated;

comment on function public.get_or_create_budget_period(date, text) is
  'Fetches the caller''s budget period for a calendar month, creating an '
  'empty one (no allocations, no planned_income) on first access. Always '
  'scoped to auth.uid() — never accepts or trusts a caller-supplied user '
  'id.';

-- 4b. Atomically replace every allocation for a budget period in one call
-- — a full delete-then-reinsert within a single function invocation, so
-- there is no window where only some categories have been saved (this is
-- what "avoid partial allocation updates" means here). planned_income is
-- optional per call: passing null leaves the period's existing value
-- untouched rather than clearing it.
create or replace function public.save_budget_allocations(
  p_budget_period_id uuid,
  p_allocations jsonb,
  p_planned_income numeric default null,
  p_notes text default null
)
returns public.budget_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_period public.budget_periods;
  v_alloc jsonb;
begin
  if v_user_id is null then
    raise exception 'save_budget_allocations requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_period
    from public.budget_periods
    where id = p_budget_period_id and user_id = v_user_id;

  if v_period.id is null then
    raise exception 'budget period not found' using errcode = 'no_data_found';
  end if;

  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'p_allocations must be a JSON array'
      using errcode = 'invalid_parameter_value';
  end if;

  delete from public.budget_allocations where budget_period_id = p_budget_period_id;

  for v_alloc in select * from jsonb_array_elements(p_allocations)
  loop
    insert into public.budget_allocations (
      user_id, budget_period_id, category_id, planned_amount, notes
    )
    values (
      v_user_id,
      p_budget_period_id,
      (v_alloc ->> 'category_id')::uuid,
      (v_alloc ->> 'planned_amount')::numeric(20, 4),
      nullif(v_alloc ->> 'notes', '')
    );
  end loop;

  update public.budget_periods
    set planned_income = coalesce(p_planned_income, planned_income),
        notes = coalesce(p_notes, notes)
    where id = p_budget_period_id
    returning * into v_period;

  return v_period;
end;
$$;

revoke all on function public.save_budget_allocations(uuid, jsonb, numeric, text) from public, anon;
grant execute on function public.save_budget_allocations(uuid, jsonb, numeric, text) to authenticated;

comment on function public.save_budget_allocations(uuid, jsonb, numeric, text) is
  'Replaces every allocation for one of the caller''s own budget periods '
  'atomically (delete-then-reinsert in one call). Each inserted row is '
  'still validated by budget_allocations_validate_refs (ownership, '
  'expense-only category) and the (budget_period_id, category_id) unique '
  'index, so a duplicate category in p_allocations is rejected.';

-- 4c. Copy a previous period's allocations into a (possibly new) target
-- period. Idempotent "fill in missing categories" semantics — never
-- overwrites an allocation the target period already has, so calling this
-- twice, or copying into a period the user has already started editing,
-- never destroys their work.
create or replace function public.copy_budget_period(
  p_source_period_month date,
  p_target_period_month date,
  p_currency text default 'INR'
)
returns public.budget_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.budget_periods;
  v_target public.budget_periods;
begin
  if v_user_id is null then
    raise exception 'copy_budget_period requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_source
    from public.budget_periods
    where user_id = v_user_id
      and period_month = date_trunc('month', p_source_period_month)::date
      and currency = p_currency;

  if v_source.id is null then
    raise exception 'source budget period not found' using errcode = 'no_data_found';
  end if;

  v_target := public.get_or_create_budget_period(
    date_trunc('month', p_target_period_month)::date, p_currency
  );

  insert into public.budget_allocations (user_id, budget_period_id, category_id, planned_amount, notes)
  select v_user_id, v_target.id, ba.category_id, ba.planned_amount, ba.notes
  from public.budget_allocations ba
  where ba.budget_period_id = v_source.id
  on conflict (budget_period_id, category_id) do nothing;

  if v_target.planned_income is null and v_source.planned_income is not null then
    update public.budget_periods
      set planned_income = v_source.planned_income
      where id = v_target.id
      returning * into v_target;
  end if;

  return v_target;
end;
$$;

revoke all on function public.copy_budget_period(date, date, text) from public, anon;
grant execute on function public.copy_budget_period(date, date, text) to authenticated;

comment on function public.copy_budget_period(date, date, text) is
  'Copies the caller''s own source period''s allocations into the target '
  'period (creating it if needed). Never overwrites an allocation the '
  'target already has for a category — safe to call repeatedly.';

-- 4d. Summary totals for a period. security invoker + no explicit
-- auth.uid() filter on ledger_entries/ledger_transactions/accounts,
-- mirroring dashboard_summary (Phase 5) exactly: RLS alone scopes those
-- reads to the caller. No status = 'posted' filter either, for the same
-- reason documented there — a reversal's negated entries must stay in the
-- sum so an edited transaction's original + reversal + replacement still
-- net out correctly.
create or replace function public.budget_summary(p_period_month date, p_currency text default 'INR')
returns table (
  planned_expense numeric(20, 4),
  actual_expense numeric(20, 4),
  remaining numeric(20, 4),
  overspent numeric(20, 4),
  planned_income numeric(20, 4),
  actual_income numeric(20, 4),
  planned_surplus numeric(20, 4),
  actual_net_cash_flow numeric(20, 4),
  unbudgeted_expense_total numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  with bounds as (
    select * from public.ist_month_bounds(date_trunc('month', p_period_month)::date)
  ),
  period as (
    select bp.id, coalesce(bp.planned_income, 0) as planned_income
    from public.budget_periods bp
    where bp.period_month = date_trunc('month', p_period_month)::date
      and bp.currency = p_currency
  ),
  planned as (
    select coalesce(sum(ba.planned_amount), 0) as total
    from public.budget_allocations ba
    join period p on p.id = ba.budget_period_id
  ),
  actual_income as (
    select coalesce(-sum(e.amount), 0) as total
    from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    join public.accounts a on a.id = e.account_id
    cross join bounds
    where a.account_class = 'income' and e.currency = p_currency
      and t.occurred_at >= bounds.period_start and t.occurred_at < bounds.period_end
  ),
  actual_expense as (
    select coalesce(sum(e.amount), 0) as total
    from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    join public.accounts a on a.id = e.account_id
    cross join bounds
    where a.account_class = 'expense' and e.currency = p_currency
      and t.occurred_at >= bounds.period_start and t.occurred_at < bounds.period_end
  ),
  unbudgeted as (
    -- A reversal transaction never carries its own category_id (see
    -- validate_ledger_transaction_refs, Phase 5) — its effective category
    -- for aggregation purposes is the original transaction's, resolved via
    -- reversal_of, so a reversed categorized expense nets to zero within
    -- that category instead of leaking a spurious negative "Uncategorized"
    -- amount. Every other transaction type already has its own
    -- category_id (or null), so coalesce is a no-op for them.
    select coalesce(sum(e.amount), 0) as total
    from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    left join public.ledger_transactions orig on orig.id = t.reversal_of
    join public.accounts a on a.id = e.account_id
    cross join bounds
    where a.account_class = 'expense' and e.currency = p_currency
      and t.occurred_at >= bounds.period_start and t.occurred_at < bounds.period_end
      and not exists (
        select 1 from public.budget_allocations ba
        join period p on p.id = ba.budget_period_id
        where ba.category_id is not distinct from coalesce(t.category_id, orig.category_id)
      )
  )
  select
    planned.total,
    actual_expense.total,
    planned.total - actual_expense.total,
    greatest(actual_expense.total - planned.total, 0),
    coalesce((select planned_income from period), 0),
    actual_income.total,
    coalesce((select planned_income from period), 0) - planned.total,
    actual_income.total - actual_expense.total,
    unbudgeted.total
  from planned, actual_income, actual_expense, unbudgeted;
$$;

revoke all on function public.budget_summary(date, text) from public, anon;
grant execute on function public.budget_summary(date, text) to authenticated;

comment on function public.budget_summary(date, text) is
  'Whole-period budget totals for the caller, scoped by RLS. actual_* is '
  'always derived live from posted ledger entries — see the section '
  'header for why there is no status filter. Works even when the caller '
  'has no budget_periods row yet for this month (planned_* reads as 0).';

-- 4e. Per-category planned vs. actual, one row per existing allocation.
-- Categories with spend but no allocation are deliberately absent here —
-- see budget_unbudgeted_expenses, which surfaces those separately rather
-- than folding them into a synthetic "Other" row.
create or replace function public.budget_category_progress(p_period_month date, p_currency text default 'INR')
returns table (
  category_id uuid,
  category_name text,
  category_icon text,
  category_color text,
  planned_amount numeric(20, 4),
  actual_amount numeric(20, 4),
  remaining_amount numeric(20, 4),
  usage_percent numeric(7, 2),
  progress_status text
)
language sql
security invoker
set search_path = ''
stable
as $$
  with bounds as (
    select * from public.ist_month_bounds(date_trunc('month', p_period_month)::date)
  ),
  period as (
    select bp.id
    from public.budget_periods bp
    where bp.period_month = date_trunc('month', p_period_month)::date
      and bp.currency = p_currency
  ),
  actuals as (
    -- See budget_summary's "unbudgeted" CTE for why a reversal's effective
    -- category is resolved via reversal_of rather than its own (always
    -- null) category_id.
    select coalesce(t.category_id, orig.category_id) as category_id, sum(e.amount) as total
    from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
    left join public.ledger_transactions orig on orig.id = t.reversal_of
    join public.accounts a on a.id = e.account_id
    cross join bounds
    where a.account_class = 'expense' and e.currency = p_currency
      and t.occurred_at >= bounds.period_start and t.occurred_at < bounds.period_end
    group by coalesce(t.category_id, orig.category_id)
  )
  select
    c.id,
    c.name,
    c.icon,
    c.color,
    ba.planned_amount,
    coalesce(actuals.total, 0),
    ba.planned_amount - coalesce(actuals.total, 0),
    -- A zero-value allocation has no meaningful "percent of plan" — left
    -- null (never a divide-by-zero) rather than 0 or an arbitrary sentinel.
    case when ba.planned_amount = 0 then null
      else round(coalesce(actuals.total, 0) / ba.planned_amount * 100, 2)
    end,
    case
      when ba.planned_amount = 0 and coalesce(actuals.total, 0) > 0 then 'exceeded'
      when ba.planned_amount = 0 then 'safe'
      when coalesce(actuals.total, 0) / ba.planned_amount > 1 then 'exceeded'
      when coalesce(actuals.total, 0) / ba.planned_amount = 1 then 'reached'
      when coalesce(actuals.total, 0) / ba.planned_amount >= 0.8 then 'warning'
      else 'safe'
    end
  from public.budget_allocations ba
  join period p on p.id = ba.budget_period_id
  join public.categories c on c.id = ba.category_id
  left join actuals on actuals.category_id = ba.category_id
  order by c.sort_order, c.name;
$$;

revoke all on function public.budget_category_progress(date, text) from public, anon;
grant execute on function public.budget_category_progress(date, text) to authenticated;

comment on function public.budget_category_progress(date, text) is
  'One row per allocation the caller has made for this period, with '
  'planned/actual/remaining/usage_percent/progress_status. Status '
  'boundaries: safe < 80%, warning 80-<100%, reached = 100%, exceeded '
  '> 100% (or any spend at all against a zero-planned allocation).';

-- 4f. Expense-category spend with no allocation row for this period —
-- surfaced separately so it is never silently folded into a category's
-- total or hidden behind a generic "Other" bucket.
create or replace function public.budget_unbudgeted_expenses(p_period_month date, p_currency text default 'INR')
returns table (
  category_id uuid,
  category_name text,
  category_icon text,
  category_color text,
  actual_amount numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  with bounds as (
    select * from public.ist_month_bounds(date_trunc('month', p_period_month)::date)
  ),
  period as (
    select bp.id
    from public.budget_periods bp
    where bp.period_month = date_trunc('month', p_period_month)::date
      and bp.currency = p_currency
  )
  select
    coalesce(t.category_id, orig.category_id),
    coalesce(c.name, 'Uncategorized'),
    c.icon,
    c.color,
    sum(e.amount)
  from public.ledger_entries e
  join public.ledger_transactions t on t.id = e.transaction_id
  left join public.ledger_transactions orig on orig.id = t.reversal_of
  join public.accounts a on a.id = e.account_id
  left join public.categories c on c.id = coalesce(t.category_id, orig.category_id)
  cross join bounds
  where a.account_class = 'expense' and e.currency = p_currency
    and t.occurred_at >= bounds.period_start and t.occurred_at < bounds.period_end
    and not exists (
      select 1 from public.budget_allocations ba
      join period p on p.id = ba.budget_period_id
      where ba.category_id is not distinct from coalesce(t.category_id, orig.category_id)
    )
  group by coalesce(t.category_id, orig.category_id), c.name, c.icon, c.color
  having sum(e.amount) <> 0
  order by sum(e.amount) desc;
$$;

revoke all on function public.budget_unbudgeted_expenses(date, text) from public, anon;
grant execute on function public.budget_unbudgeted_expenses(date, text) to authenticated;

comment on function public.budget_unbudgeted_expenses(date, text) is
  'Expense-category spend for this period that has no matching '
  'budget_allocations row (including uncategorized spend, category_id '
  'null) — never merged into another category''s total.';

-- =======================================================================
-- 5. Shared posting core: post_manual_transaction_for_user
-- =======================================================================
-- Extracts create_manual_transaction's (Phase 5) actual insert logic into
-- an internal function parameterized by an explicit p_user_id, so the
-- recurring auto-post processor (section 9) — which posts on behalf of
-- many users outside of any single request's auth context, so auth.uid()
-- is not available to it — can reuse the exact same posting boundary
-- instead of re-implementing it. create_manual_transaction itself becomes
-- a thin wrapper: identical public signature and behaviour as before,
-- just delegating.
--
-- Not granted to any client role. The only callers are other SECURITY
-- DEFINER functions in this schema (which execute as this function's
-- owner, not the invoking client role), so a client can never reach this
-- function directly and pass an arbitrary p_user_id to impersonate another
-- user — the two things that DO call it (create_manual_transaction,
-- resolving auth.uid() itself first; attempt_post_occurrence, reading
-- p_user_id off the occurrence's own already-RLS-scoped row) are both
-- trusted to have already established whose data is being written.
create or replace function public.post_manual_transaction_for_user(
  p_user_id uuid,
  p_transaction_type text,
  p_occurred_at timestamptz,
  p_description text,
  p_entries jsonb,
  p_notes text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null,
  p_idempotency_key text default null
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.ledger_transactions;
  v_entry jsonb;
begin
  if p_user_id is null then
    raise exception 'post_manual_transaction_for_user requires a user id'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_transaction_type not in ('income', 'expense', 'transfer', 'credit_card_purchase', 'credit_card_payment', 'adjustment') then
    raise exception 'unsupported manual transaction_type: %', p_transaction_type
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 2 then
    raise exception 'p_entries must be a JSON array with at least two entries'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.ledger_transactions (
    user_id, transaction_type, occurred_at, description, notes, source_type,
    source_reference, category_id, payee_id
  )
  values (
    p_user_id, p_transaction_type, p_occurred_at, p_description, p_notes, 'manual',
    p_idempotency_key, p_category_id, p_payee_id
  )
  on conflict (user_id, source_reference) where source_reference is not null
  do nothing
  returning * into v_transaction;

  if v_transaction.id is null then
    if p_idempotency_key is null then
      raise exception 'post_manual_transaction_for_user: insert unexpectedly produced no row'
        using errcode = 'data_exception';
    end if;

    select * into v_transaction
      from public.ledger_transactions
      where user_id = p_user_id and source_reference = p_idempotency_key;

    return v_transaction;
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency, memo)
    values (
      p_user_id,
      v_transaction.id,
      (v_entry ->> 'account_id')::uuid,
      (v_entry ->> 'amount')::numeric(20, 4),
      coalesce(v_entry ->> 'currency', 'INR'),
      nullif(v_entry ->> 'memo', '')
    );
  end loop;

  return v_transaction;
end;
$$;

revoke all on function public.post_manual_transaction_for_user(
  uuid, text, timestamptz, text, jsonb, text, uuid, uuid, text
) from public, anon, authenticated;

comment on function public.post_manual_transaction_for_user is
  'Internal posting core shared by create_manual_transaction (thin '
  'auth.uid()-resolving wrapper below, granted to authenticated) and '
  'attempt_post_occurrence (section 9, the recurring auto-post path). Not '
  'granted to any client role.';

create or replace function public.create_manual_transaction(
  p_transaction_type text,
  p_occurred_at timestamptz,
  p_description text,
  p_entries jsonb,
  p_notes text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null,
  p_idempotency_key text default null
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'create_manual_transaction requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  return public.post_manual_transaction_for_user(
    v_user_id, p_transaction_type, p_occurred_at, p_description, p_entries,
    p_notes, p_category_id, p_payee_id, p_idempotency_key
  );
end;
$$;

revoke all on function public.create_manual_transaction(text, timestamptz, text, jsonb, text, uuid, uuid, text)
  from public, anon;
grant execute on function public.create_manual_transaction(text, timestamptz, text, jsonb, text, uuid, uuid, text)
  to authenticated;

comment on function public.create_manual_transaction(text, timestamptz, text, jsonb, text, uuid, uuid, text) is
  'Same public signature and behaviour as Phase 5 — now a thin wrapper '
  'over post_manual_transaction_for_user (section 5), so the recurring '
  'auto-post processor never re-implements this logic.';

-- =======================================================================
-- 6. Deterministic recurrence date math
-- =======================================================================
-- Pure function of its inputs (marked immutable). The exact same
-- semantics are implemented independently in TypeScript
-- (src/lib/recurring/schedule.ts, unit tested) for anything the UI/Server
-- Action layer needs to compute client-side (e.g. a "next few dates"
-- preview) — the two can't literally share code across the language
-- boundary, so pgTAP tests here assert this function against the same
-- edge cases (31st, Feb 29, quarterly/half-yearly anchoring) the
-- TypeScript unit tests cover, to keep the two definitions provably in
-- sync rather than merely both "probably correct."
create or replace function public.recurring_occurrence_date(
  p_anchor date,
  p_frequency text,
  p_interval_count integer,
  p_k integer
)
returns date
language plpgsql
immutable
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

  -- Add months with day-of-month clamping (31st -> last valid day of a
  -- shorter month; a Feb 29 anchor -> Feb 28 in a non-leap year) rather
  -- than `date + interval`, which Postgres would otherwise silently roll
  -- over into the following month (e.g. Jan 31 + 1 month -> Mar 3).
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

comment on function public.recurring_occurrence_date(date, text, integer, integer) is
  'The k-th (0-indexed) occurrence date for a recurrence anchored at '
  'p_anchor. Weekly steps by whole weeks; monthly/quarterly/half_yearly/ '
  'yearly step by months with day-of-month clamping. See the section '
  'header for why this mirrors src/lib/recurring/schedule.ts rather than '
  'sharing code with it.';

-- =======================================================================
-- 7. public.recurring_items
-- =======================================================================
-- "Original schedule anchor" and "start date" are deliberately the same
-- column: start_date never drifts on its own (only an explicit user edit
-- changes it, via update_recurring_item, section 8b), so it already is
-- the immutable anchor every future occurrence date is computed from —
-- a separate anchor_date column would only ever hold the same value.
--
-- No per-item timezone column either — see the section 1 header comment;
-- this app is Asia/Kolkata throughout, not per-row configurable yet.

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null,
  amount numeric(20, 4) not null,
  currency text not null default 'INR',
  source_account_id uuid null references public.accounts (id),
  destination_account_id uuid null references public.accounts (id),
  category_id uuid null references public.categories (id),
  payee_id uuid null references public.payees (id),
  notes text null,
  start_date date not null,
  end_date date null,
  frequency text not null,
  interval_count smallint not null default 1,
  next_due_date date null,
  processing_mode text not null default 'reminder_only',
  status text not null default 'active',
  trial_end_date date null,
  cancellation_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recurring_items_kind_valid check (
    kind in ('subscription', 'bill', 'income', 'transfer')
  ),
  constraint recurring_items_amount_positive check (amount > 0),
  constraint recurring_items_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint recurring_items_name_length check (
    char_length(btrim(name)) between 1 and 120
  ),
  constraint recurring_items_notes_length check (
    notes is null or char_length(notes) <= 2000
  ),
  constraint recurring_items_end_after_start check (
    end_date is null or end_date >= start_date
  ),
  constraint recurring_items_frequency_valid check (
    frequency in ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly')
  ),
  constraint recurring_items_interval_count_range check (
    interval_count between 1 and 52
  ),
  constraint recurring_items_processing_mode_valid check (
    processing_mode in ('reminder_only', 'auto_post')
  ),
  constraint recurring_items_status_valid check (
    status in ('active', 'paused', 'cancelled', 'archived')
  ),
  constraint recurring_items_cancellation_requires_cancelled check (
    cancellation_date is null or status in ('cancelled', 'archived')
  )
);

comment on table public.recurring_items is
  'A subscription, bill, recurring income, or recurring transfer template. '
  'Never itself a financial record — public.recurring_occurrences '
  '(section 8) are the generated cycles, and only a posted occurrence''s '
  'linked_transaction_id is real ledger data.';

drop trigger if exists set_recurring_items_updated_at on public.recurring_items;
create trigger set_recurring_items_updated_at
  before update on public.recurring_items
  for each row
  execute function public.set_updated_at();

create index if not exists recurring_items_user_id_idx on public.recurring_items (user_id);
create index if not exists recurring_items_user_status_idx on public.recurring_items (user_id, status);
create index if not exists recurring_items_user_kind_idx on public.recurring_items (user_id, kind);

-- 7a. Cross-row validation: which of source/destination/category is
-- required/forbidden depends on kind; every referenced account/category/
-- payee must belong to the caller; account currency must match. Mirrors
-- validate_ledger_transaction_refs' (Phase 5) style exactly.
create or replace function public.validate_recurring_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_user_id uuid;
  v_source_currency text;
  v_dest_user_id uuid;
  v_dest_currency text;
  v_category_user_id uuid;
  v_category_type text;
  v_payee_user_id uuid;
begin
  if new.kind = 'transfer' then
    if new.source_account_id is null or new.destination_account_id is null then
      raise exception 'a transfer recurring item requires both a source and destination account'
        using errcode = 'check_violation';
    end if;
    if new.source_account_id = new.destination_account_id then
      raise exception 'a transfer recurring item must use two different accounts'
        using errcode = 'check_violation';
    end if;
    if new.category_id is not null then
      raise exception 'a transfer recurring item cannot have a category'
        using errcode = 'check_violation';
    end if;
  elsif new.kind = 'income' then
    if new.destination_account_id is null then
      raise exception 'an income recurring item requires a destination account'
        using errcode = 'check_violation';
    end if;
    if new.source_account_id is not null then
      raise exception 'an income recurring item cannot have a source account'
        using errcode = 'check_violation';
    end if;
    if new.category_id is null then
      raise exception 'an income recurring item requires an income category'
        using errcode = 'check_violation';
    end if;
  else
    if new.source_account_id is null then
      raise exception '% recurring item requires a source account', new.kind
        using errcode = 'check_violation';
    end if;
    if new.destination_account_id is not null then
      raise exception '% recurring item cannot have a destination account', new.kind
        using errcode = 'check_violation';
    end if;
    if new.category_id is null then
      raise exception '% recurring item requires an expense category', new.kind
        using errcode = 'check_violation';
    end if;
  end if;

  if new.source_account_id is not null then
    select user_id, currency into v_source_user_id, v_source_currency
      from public.accounts where id = new.source_account_id;
    if v_source_user_id is null then
      raise exception 'recurring item references a non-existent source account'
        using errcode = 'foreign_key_violation';
    end if;
    if v_source_user_id <> new.user_id then
      raise exception 'recurring item source account does not belong to the caller'
        using errcode = 'insufficient_privilege';
    end if;
    if v_source_currency <> new.currency then
      raise exception 'recurring item currency does not match its source account'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.destination_account_id is not null then
    select user_id, currency into v_dest_user_id, v_dest_currency
      from public.accounts where id = new.destination_account_id;
    if v_dest_user_id is null then
      raise exception 'recurring item references a non-existent destination account'
        using errcode = 'foreign_key_violation';
    end if;
    if v_dest_user_id <> new.user_id then
      raise exception 'recurring item destination account does not belong to the caller'
        using errcode = 'insufficient_privilege';
    end if;
    if v_dest_currency <> new.currency then
      raise exception 'recurring item currency does not match its destination account'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.category_id is not null then
    select user_id, category_type into v_category_user_id, v_category_type
      from public.categories where id = new.category_id;
    if v_category_user_id is null then
      raise exception 'recurring item references a non-existent category'
        using errcode = 'foreign_key_violation';
    end if;
    if v_category_user_id <> new.user_id then
      raise exception 'recurring item category does not belong to the caller'
        using errcode = 'insufficient_privilege';
    end if;
    if new.kind = 'income' and v_category_type <> 'income' then
      raise exception 'an income recurring item requires an income category'
        using errcode = 'check_violation';
    end if;
    if new.kind in ('bill', 'subscription') and v_category_type <> 'expense' then
      raise exception '% recurring item requires an expense category', new.kind
        using errcode = 'check_violation';
    end if;
  end if;

  if new.payee_id is not null then
    select user_id into v_payee_user_id from public.payees where id = new.payee_id;
    if v_payee_user_id is null then
      raise exception 'recurring item references a non-existent payee'
        using errcode = 'foreign_key_violation';
    end if;
    if v_payee_user_id <> new.user_id then
      raise exception 'recurring item payee does not belong to the caller'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_recurring_item() from public, anon, authenticated;

drop trigger if exists recurring_items_validate_refs on public.recurring_items;
create trigger recurring_items_validate_refs
  before insert or update on public.recurring_items
  for each row
  execute function public.validate_recurring_item();

-- =======================================================================
-- 8. public.recurring_occurrences
-- =======================================================================

create table if not exists public.recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  recurring_item_id uuid not null references public.recurring_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_date date not null,
  amount numeric(20, 4) not null,
  currency text not null,
  status text not null default 'upcoming',
  linked_transaction_id uuid null references public.ledger_transactions (id) on delete set null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null,
  updated_at timestamptz not null default now(),

  constraint recurring_occurrences_amount_positive check (amount > 0),
  constraint recurring_occurrences_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint recurring_occurrences_status_valid check (
    status in ('upcoming', 'due', 'overdue', 'posted', 'skipped', 'failed', 'cancelled')
  ),
  constraint recurring_occurrences_failure_reason_length check (
    failure_reason is null or char_length(failure_reason) <= 300
  ),
  constraint recurring_occurrences_unique_item_date
    unique (recurring_item_id, scheduled_date)
);

comment on table public.recurring_occurrences is
  'One generated cycle of a recurring item. amount/currency are snapshots '
  'taken at generation time — changing a recurring item''s amount never '
  'rewrites an already-generated occurrence (see update_recurring_item, '
  'section 8b, which only regenerates status = ''upcoming'' rows). The '
  '(recurring_item_id, scheduled_date) unique index is the idempotency '
  'boundary a repeated Cron run, page refresh, or double-click relies on.';

drop trigger if exists set_recurring_occurrences_updated_at on public.recurring_occurrences;
create trigger set_recurring_occurrences_updated_at
  before update on public.recurring_occurrences
  for each row
  execute function public.set_updated_at();

create index if not exists recurring_occurrences_user_status_idx
  on public.recurring_occurrences (user_id, status);
create index if not exists recurring_occurrences_user_scheduled_idx
  on public.recurring_occurrences (user_id, scheduled_date);
create unique index if not exists recurring_occurrences_linked_transaction_uidx
  on public.recurring_occurrences (linked_transaction_id)
  where linked_transaction_id is not null;

-- =======================================================================
-- 9. Occurrence generation and processing
-- =======================================================================

-- 9a. Generates missing occurrences for one recurring item up through
-- p_horizon_end (and end_date, if earlier), backfilling at most 30 days
-- into the past so a very old start_date can never make this loop
-- unboundedly expensive — capped at 2000 iterations regardless as a
-- second, unconditional safety bound. ON CONFLICT DO NOTHING against the
-- (recurring_item_id, scheduled_date) unique index is what makes repeated
-- calls (every Cron run, every catch-up) idempotent.
create or replace function public.generate_occurrences_for_item(
  p_item public.recurring_items,
  p_horizon_end date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k integer := 0;
  v_date date;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_backfill_floor date := greatest(p_item.start_date, v_today - 30);
  v_status text;
begin
  loop
    exit when v_k > 2000;

    v_date := public.recurring_occurrence_date(
      p_item.start_date, p_item.frequency, p_item.interval_count, v_k
    );

    exit when v_date > p_horizon_end;
    exit when p_item.end_date is not null and v_date > p_item.end_date;

    if v_date >= v_backfill_floor then
      v_status := case
        when v_date < v_today then 'overdue'
        when v_date = v_today then 'due'
        else 'upcoming'
      end;

      insert into public.recurring_occurrences (
        recurring_item_id, user_id, scheduled_date, amount, currency, status
      )
      values (
        p_item.id, p_item.user_id, v_date, p_item.amount, p_item.currency, v_status
      )
      on conflict (recurring_item_id, scheduled_date) do nothing;
    end if;

    v_k := v_k + 1;
  end loop;

  update public.recurring_items
    set next_due_date = (
      select min(scheduled_date)
      from public.recurring_occurrences
      where recurring_item_id = p_item.id and status in ('upcoming', 'due', 'overdue')
    )
    where id = p_item.id;
end;
$$;

revoke all on function public.generate_occurrences_for_item(public.recurring_items, date)
  from public, anon, authenticated;

-- 9b. Generates occurrences for every active item (all users when
-- p_user_id is null — the Cron path; one user when scoped — the
-- self-service catch-up path). Not granted to any client role.
create or replace function public.generate_recurring_occurrences(
  p_user_id uuid default null,
  p_horizon_days integer default 60
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.recurring_items;
  v_horizon_end date := ((now() at time zone 'Asia/Kolkata')::date) + p_horizon_days;
  v_count integer := 0;
begin
  for v_item in
    select * from public.recurring_items
    where status = 'active'
      and (p_user_id is null or user_id = p_user_id)
  loop
    perform public.generate_occurrences_for_item(v_item, v_horizon_end);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.generate_recurring_occurrences(uuid, integer) from public, anon, authenticated;

-- 9c. Attempts to post one occurrence's auto_post transaction through the
-- shared posting core (section 5). Catches its own exceptions: on
-- failure, the occurrence is marked 'failed' with a safe (truncated,
-- never raw-message) reason and no partial ledger transaction is left
-- behind — the plpgsql exception block is an implicit savepoint, so
-- whatever post_manual_transaction_for_user had started rolls back
-- cleanly. Returns true if posted, false if it failed (never raises).
create or replace function public.attempt_post_occurrence(p_occurrence_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occ public.recurring_occurrences;
  v_item public.recurring_items;
  v_txn_type text;
  v_entries jsonb;
  v_transaction public.ledger_transactions;
  v_idempotency_key text;
  v_source_account_type text;
  v_system_account_id uuid;
begin
  select * into v_occ from public.recurring_occurrences where id = p_occurrence_id;
  select * into v_item from public.recurring_items where id = v_occ.recurring_item_id;

  begin
    v_idempotency_key := 'recurring_occurrence:' || v_occ.id::text;

    if v_item.kind = 'transfer' then
      v_txn_type := 'transfer';
      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_item.destination_account_id,
          'amount', v_occ.amount::text, 'currency', v_occ.currency
        ),
        jsonb_build_object(
          'account_id', v_item.source_account_id,
          'amount', (-v_occ.amount)::text, 'currency', v_occ.currency
        )
      );
    elsif v_item.kind = 'income' then
      v_txn_type := 'income';
      select id into v_system_account_id from public.accounts
        where user_id = v_occ.user_id and system_code = 'uncategorized_income' and is_system = true;
      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_item.destination_account_id,
          'amount', v_occ.amount::text, 'currency', v_occ.currency
        ),
        jsonb_build_object(
          'account_id', v_system_account_id,
          'amount', (-v_occ.amount)::text, 'currency', v_occ.currency
        )
      );
    else
      -- bill or subscription: a credit-card source account posts as a
      -- credit_card_purchase (increases what is owed), never as a plain
      -- bank expense — the ledger accounting rule already established in
      -- Phase 5 for manually-entered credit-card purchases.
      select account_type into v_source_account_type
        from public.accounts where id = v_item.source_account_id;
      select id into v_system_account_id from public.accounts
        where user_id = v_occ.user_id and system_code = 'uncategorized_expense' and is_system = true;

      v_txn_type := case
        when v_source_account_type = 'credit_card' then 'credit_card_purchase'
        else 'expense'
      end;

      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_system_account_id,
          'amount', v_occ.amount::text, 'currency', v_occ.currency
        ),
        jsonb_build_object(
          'account_id', v_item.source_account_id,
          'amount', (-v_occ.amount)::text, 'currency', v_occ.currency
        )
      );
    end if;

    v_transaction := public.post_manual_transaction_for_user(
      v_occ.user_id, v_txn_type,
      (v_occ.scheduled_date::text || ' 00:00:00+05:30')::timestamptz,
      v_item.name, v_entries, null, v_item.category_id, v_item.payee_id, v_idempotency_key
    );

    update public.recurring_occurrences
      set status = 'posted', linked_transaction_id = v_transaction.id,
          processed_at = now(), updated_at = now(), failure_reason = null
      where id = v_occ.id;

    return true;
  exception when others then
    update public.recurring_occurrences
      set status = 'failed', failure_reason = left(sqlerrm, 300), updated_at = now()
      where id = v_occ.id;
    return false;
  end;
end;
$$;

revoke all on function public.attempt_post_occurrence(uuid) from public, anon, authenticated;

-- 9d. Advances every due-or-overdue occurrence for active items (all
-- users when p_user_id is null, one user when scoped). reminder_only
-- occurrences only ever have their status refreshed here — never a
-- transaction. auto_post occurrences attempt posting via
-- attempt_post_occurrence. A 'failed' occurrence is never retried
-- automatically by this loop (its status is excluded from the WHERE
-- clause) — see retry_failed_occurrence (section 10) for the explicit,
-- user-triggered retry path.
create or replace function public.process_due_recurring_occurrences(p_user_id uuid default null)
returns table (processed_count integer, posted_count integer, failed_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occ record;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_processed integer := 0;
  v_posted integer := 0;
  v_failed integer := 0;
begin
  for v_occ in
    select o.id, o.scheduled_date, ri.processing_mode
    from public.recurring_occurrences o
    join public.recurring_items ri on ri.id = o.recurring_item_id
    where o.status in ('upcoming', 'due', 'overdue')
      and o.scheduled_date <= v_today
      and ri.status = 'active'
      and (p_user_id is null or o.user_id = p_user_id)
    order by o.scheduled_date
  loop
    v_processed := v_processed + 1;

    if v_occ.processing_mode = 'reminder_only' then
      update public.recurring_occurrences
        set status = case when v_occ.scheduled_date < v_today then 'overdue' else 'due' end,
            updated_at = now()
        where id = v_occ.id;
      continue;
    end if;

    if public.attempt_post_occurrence(v_occ.id) then
      v_posted := v_posted + 1;
    else
      v_failed := v_failed + 1;
    end if;
  end loop;

  return query select v_processed, v_posted, v_failed;
end;
$$;

revoke all on function public.process_due_recurring_occurrences(uuid) from public, anon, authenticated;

-- 9e. The Cron entry point (section 12). Deliberately not granted to any
-- client role — see the comment there for why an authenticated client
-- must never be able to invoke this directly.
create or replace function public.process_recurring_finance()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.generate_recurring_occurrences(null, 60);
  perform public.process_due_recurring_occurrences(null);
end;
$$;

revoke all on function public.process_recurring_finance() from public, anon, authenticated;

comment on function public.process_recurring_finance() is
  'Cross-user recurring-finance processor, invoked only by the '
  'penra-recurring-finance-processor Cron job (section 12). Not granted '
  'to public/anon/authenticated — an authenticated client can never call '
  'this directly; see run_recurring_catchup_self (section 10) for the '
  'self-scoped equivalent a client is allowed to trigger.';

-- =======================================================================
-- 10. User-facing occurrence actions
-- =======================================================================

-- 10a. Self-scoped catch-up: identical processing to
-- process_recurring_finance, but scoped to auth.uid() only — for when the
-- Cron job was temporarily unavailable and the user wants their own
-- occurrences brought up to date without waiting for the next scheduled
-- run. Granted to authenticated; can never process another user, because
-- p_user_id here is always auth.uid(), never client-supplied.
create or replace function public.run_recurring_catchup_self()
returns table (processed_count integer, posted_count integer, failed_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'run_recurring_catchup_self requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  perform public.generate_recurring_occurrences(v_user_id, 60);
  return query select * from public.process_due_recurring_occurrences(v_user_id);
end;
$$;

revoke all on function public.run_recurring_catchup_self() from public, anon;
grant execute on function public.run_recurring_catchup_self() to authenticated;

-- 10b. Records a manually-entered payment for a due reminder_only
-- occurrence and links it atomically. p_entries follows the exact same
-- shape create_manual_transaction accepts (built client-side by the same
-- entry-builder helpers the regular transaction forms use — see
-- src/lib/ledger/entry-builder.ts) — no separate weaker posting path.
-- Reuses the occurrence's own idempotency key, so a double-submit (or a
-- retry after a dropped response) can never create a second transaction.
create or replace function public.post_occurrence_payment(
  p_occurrence_id uuid,
  p_transaction_type text,
  p_occurred_at timestamptz,
  p_description text,
  p_entries jsonb,
  p_notes text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_occ public.recurring_occurrences;
  v_item public.recurring_items;
  v_transaction public.ledger_transactions;
  v_idempotency_key text;
begin
  if v_user_id is null then
    raise exception 'post_occurrence_payment requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_occ from public.recurring_occurrences where id = p_occurrence_id;
  if v_occ.id is null or v_occ.user_id <> v_user_id then
    raise exception 'occurrence not found' using errcode = 'no_data_found';
  end if;

  select * into v_item from public.recurring_items where id = v_occ.recurring_item_id;
  if v_item.processing_mode <> 'reminder_only' then
    raise exception 'only a reminder-only occurrence can be paid manually'
      using errcode = 'invalid_transaction_state';
  end if;
  if v_occ.status not in ('upcoming', 'due', 'overdue') then
    raise exception 'occurrence % is not awaiting payment', p_occurrence_id
      using errcode = 'invalid_transaction_state';
  end if;

  v_idempotency_key := 'recurring_occurrence:' || v_occ.id::text;

  v_transaction := public.create_manual_transaction(
    p_transaction_type, p_occurred_at, p_description, p_entries,
    p_notes, p_category_id, p_payee_id, v_idempotency_key
  );

  update public.recurring_occurrences
    set status = 'posted', linked_transaction_id = v_transaction.id,
        processed_at = now(), updated_at = now()
    where id = v_occ.id;

  return v_transaction;
end;
$$;

revoke all on function public.post_occurrence_payment(uuid, text, timestamptz, text, jsonb, text, uuid, uuid)
  from public, anon;
grant execute on function public.post_occurrence_payment(uuid, text, timestamptz, text, jsonb, text, uuid, uuid)
  to authenticated;

-- 10c. Links an already-posted, unlinked transaction of the caller's own
-- to a due occurrence, instead of creating a new one. Amount is
-- deliberately not required to match exactly ("reasonably matching", per
-- spec) — kind, currency, ownership, posted (non-reversed) status, and
-- "not already linked elsewhere" are the hard requirements; amount
-- matching is left to the user's own judgement in the picker UI.
create or replace function public.link_existing_transaction_to_occurrence(
  p_occurrence_id uuid,
  p_transaction_id uuid
)
returns public.recurring_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_occ public.recurring_occurrences;
  v_item public.recurring_items;
  v_txn public.ledger_transactions;
  v_already_linked boolean;
  v_currency_mismatch boolean;
begin
  if v_user_id is null then
    raise exception 'link_existing_transaction_to_occurrence requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_occ from public.recurring_occurrences where id = p_occurrence_id;
  if v_occ.id is null or v_occ.user_id <> v_user_id then
    raise exception 'occurrence not found' using errcode = 'no_data_found';
  end if;
  if v_occ.status not in ('upcoming', 'due', 'overdue') then
    raise exception 'occurrence % is not awaiting payment', p_occurrence_id
      using errcode = 'invalid_transaction_state';
  end if;

  select * into v_item from public.recurring_items where id = v_occ.recurring_item_id;

  select * into v_txn from public.ledger_transactions where id = p_transaction_id;
  if v_txn.id is null or v_txn.user_id <> v_user_id then
    raise exception 'transaction not found' using errcode = 'no_data_found';
  end if;
  if v_txn.status <> 'posted' then
    raise exception 'only a posted, non-reversed transaction can be linked'
      using errcode = 'invalid_transaction_state';
  end if;

  select exists(
    select 1 from public.recurring_occurrences where linked_transaction_id = p_transaction_id
  ) into v_already_linked;
  if v_already_linked then
    raise exception 'transaction % is already linked to another occurrence', p_transaction_id
      using errcode = 'unique_violation';
  end if;

  select exists(
    select 1 from public.ledger_entries
    where transaction_id = p_transaction_id and currency <> v_occ.currency
  ) into v_currency_mismatch;
  if v_currency_mismatch then
    raise exception 'transaction currency does not match this occurrence'
      using errcode = 'check_violation';
  end if;

  if v_item.kind = 'transfer' and v_txn.transaction_type <> 'transfer' then
    raise exception 'transaction type does not match this recurring item'
      using errcode = 'check_violation';
  elsif v_item.kind = 'income' and v_txn.transaction_type <> 'income' then
    raise exception 'transaction type does not match this recurring item'
      using errcode = 'check_violation';
  elsif v_item.kind in ('bill', 'subscription')
    and v_txn.transaction_type not in ('expense', 'credit_card_purchase') then
    raise exception 'transaction type does not match this recurring item'
      using errcode = 'check_violation';
  end if;

  update public.recurring_occurrences
    set status = 'posted', linked_transaction_id = p_transaction_id,
        processed_at = now(), updated_at = now()
    where id = p_occurrence_id
    returning * into v_occ;

  return v_occ;
end;
$$;

revoke all on function public.link_existing_transaction_to_occurrence(uuid, uuid) from public, anon;
grant execute on function public.link_existing_transaction_to_occurrence(uuid, uuid) to authenticated;

-- 10d. Skips a due reminder_only occurrence — no transaction, and the
-- recurring item itself (and its future cycles) is entirely unaffected.
create or replace function public.skip_occurrence(p_occurrence_id uuid)
returns public.recurring_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_occ public.recurring_occurrences;
begin
  if v_user_id is null then
    raise exception 'skip_occurrence requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_occ from public.recurring_occurrences where id = p_occurrence_id;
  if v_occ.id is null or v_occ.user_id <> v_user_id then
    raise exception 'occurrence not found' using errcode = 'no_data_found';
  end if;
  if v_occ.status not in ('upcoming', 'due', 'overdue') then
    raise exception 'occurrence % cannot be skipped', p_occurrence_id
      using errcode = 'invalid_transaction_state';
  end if;

  update public.recurring_occurrences
    set status = 'skipped', processed_at = now(), updated_at = now()
    where id = p_occurrence_id
    returning * into v_occ;

  return v_occ;
end;
$$;

revoke all on function public.skip_occurrence(uuid) from public, anon;
grant execute on function public.skip_occurrence(uuid) to authenticated;

-- 10e. Retries a failed auto_post occurrence via the same
-- attempt_post_occurrence core used by scheduled processing (section 9c)
-- — never a second implementation of the posting logic.
create or replace function public.retry_failed_occurrence(p_occurrence_id uuid)
returns public.recurring_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_occ public.recurring_occurrences;
begin
  if v_user_id is null then
    raise exception 'retry_failed_occurrence requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_occ from public.recurring_occurrences where id = p_occurrence_id;
  if v_occ.id is null or v_occ.user_id <> v_user_id then
    raise exception 'occurrence not found' using errcode = 'no_data_found';
  end if;
  if v_occ.status <> 'failed' then
    raise exception 'only a failed occurrence can be retried'
      using errcode = 'invalid_transaction_state';
  end if;

  perform public.attempt_post_occurrence(p_occurrence_id);

  select * into v_occ from public.recurring_occurrences where id = p_occurrence_id;
  return v_occ;
end;
$$;

revoke all on function public.retry_failed_occurrence(uuid) from public, anon;
grant execute on function public.retry_failed_occurrence(uuid) to authenticated;

-- =======================================================================
-- 11. Recurring item lifecycle
-- =======================================================================

-- 11a. Creates a recurring item and immediately generates its first 60
-- days of occurrences, so the user sees "next due" data right away rather
-- than waiting for the next Cron run.
create or replace function public.create_recurring_item(
  p_name text,
  p_kind text,
  p_amount numeric,
  p_currency text,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_category_id uuid,
  p_payee_id uuid,
  p_notes text,
  p_start_date date,
  p_end_date date,
  p_frequency text,
  p_interval_count integer,
  p_processing_mode text,
  p_trial_end_date date default null,
  p_cancellation_date date default null
)
returns public.recurring_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.recurring_items;
  v_horizon_end date;
begin
  if v_user_id is null then
    raise exception 'create_recurring_item requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.recurring_items (
    user_id, name, kind, amount, currency, source_account_id, destination_account_id,
    category_id, payee_id, notes, start_date, end_date, frequency, interval_count,
    processing_mode, trial_end_date, cancellation_date
  )
  values (
    v_user_id, p_name, p_kind, p_amount, p_currency, p_source_account_id, p_destination_account_id,
    p_category_id, p_payee_id, p_notes, p_start_date, p_end_date, p_frequency, p_interval_count,
    p_processing_mode, p_trial_end_date, p_cancellation_date
  )
  returning * into v_item;

  v_horizon_end := ((now() at time zone 'Asia/Kolkata')::date) + 60;
  perform public.generate_occurrences_for_item(v_item, v_horizon_end);

  select * into v_item from public.recurring_items where id = v_item.id;
  return v_item;
end;
$$;

revoke all on function public.create_recurring_item(
  text, text, numeric, text, uuid, uuid, uuid, uuid, text, date, date, text, integer, text, date, date
) from public, anon;
grant execute on function public.create_recurring_item(
  text, text, numeric, text, uuid, uuid, uuid, uuid, text, date, date, text, integer, text, date, date
) to authenticated;

-- 11b. Edits a recurring item's revisable fields. kind, accounts, currency
-- and start_date are intentionally not editable here — changing which
-- accounts or what kind of item this is would really be a different
-- recurring item, the same "which accounts were involved isn't something
-- an edit changes" philosophy Phase 5's editTransactionSchema already
-- established for individual transactions. Only status = 'upcoming'
-- (not-yet-due, not yet shown to the user as actionable) occurrences are
-- deleted and regenerated from the new schedule/amount — 'due'/'overdue'
-- occurrences the user may already be acting on, and every
-- posted/skipped/failed/cancelled occurrence (real history), are left
-- untouched.
create or replace function public.update_recurring_item(
  p_id uuid,
  p_name text,
  p_amount numeric,
  p_category_id uuid,
  p_payee_id uuid,
  p_notes text,
  p_end_date date,
  p_frequency text,
  p_interval_count integer,
  p_processing_mode text
)
returns public.recurring_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.recurring_items;
  v_horizon_end date;
begin
  if v_user_id is null then
    raise exception 'update_recurring_item requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  update public.recurring_items
    set name = p_name, amount = p_amount, category_id = p_category_id, payee_id = p_payee_id,
        notes = p_notes, end_date = p_end_date, frequency = p_frequency,
        interval_count = p_interval_count, processing_mode = p_processing_mode
    where id = p_id and user_id = v_user_id
    returning * into v_item;

  if v_item.id is null then
    raise exception 'recurring item not found' using errcode = 'no_data_found';
  end if;

  delete from public.recurring_occurrences
    where recurring_item_id = v_item.id and status = 'upcoming';

  v_horizon_end := ((now() at time zone 'Asia/Kolkata')::date) + 60;
  perform public.generate_occurrences_for_item(v_item, v_horizon_end);

  select * into v_item from public.recurring_items where id = v_item.id;
  return v_item;
end;
$$;

revoke all on function public.update_recurring_item(
  uuid, text, numeric, uuid, uuid, text, date, text, integer, text
) from public, anon;
grant execute on function public.update_recurring_item(
  uuid, text, numeric, uuid, uuid, text, date, text, integer, text
) to authenticated;

-- 11c. Pause/resume/cancel/archive. Cancellation is terminal (a cancelled
-- item can never be reactivated — create a new one instead) and cascades
-- to cancel any not-yet-posted occurrence, so a pending "due" reminder for
-- an item the user just cancelled never lingers. Archiving is only
-- available from 'cancelled'. Pausing/resuming never touches occurrence
-- rows directly — generate_recurring_occurrences and
-- process_due_recurring_occurrences both filter on
-- recurring_items.status = 'active', so a paused item simply stops
-- generating new occurrences and stops being auto-posted; resuming it is
-- naturally safe (no special "undo pause" bookkeeping needed) because
-- generation is already idempotent.
create or replace function public.set_recurring_item_status(p_id uuid, p_status text)
returns public.recurring_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.recurring_items;
begin
  if v_user_id is null then
    raise exception 'set_recurring_item_status requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  if p_status not in ('active', 'paused', 'cancelled', 'archived') then
    raise exception 'unsupported recurring item status: %', p_status
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_item from public.recurring_items where id = p_id and user_id = v_user_id;
  if v_item.id is null then
    raise exception 'recurring item not found' using errcode = 'no_data_found';
  end if;

  if v_item.status = 'cancelled' and p_status = 'active' then
    raise exception 'a cancelled recurring item cannot be reactivated; create a new one instead'
      using errcode = 'invalid_transaction_state';
  end if;
  if v_item.status = 'archived' then
    raise exception 'an archived recurring item cannot change status'
      using errcode = 'invalid_transaction_state';
  end if;
  if p_status = 'archived' and v_item.status <> 'cancelled' then
    raise exception 'only a cancelled recurring item can be archived'
      using errcode = 'invalid_transaction_state';
  end if;

  update public.recurring_items set status = p_status where id = p_id
    returning * into v_item;

  if p_status = 'cancelled' then
    update public.recurring_occurrences
      set status = 'cancelled', updated_at = now()
      where recurring_item_id = p_id and status in ('upcoming', 'due', 'overdue');
  end if;

  return v_item;
end;
$$;

revoke all on function public.set_recurring_item_status(uuid, text) from public, anon;
grant execute on function public.set_recurring_item_status(uuid, text) to authenticated;

-- =======================================================================
-- 12. Subscription cost analytics
-- =======================================================================
-- All-numeric arithmetic (untyped numeric literals, never float/double
-- precision), so estimates stay exact decimals. Documented normalization:
-- weekly x52/year, monthly x12/year, quarterly x4/year, half_yearly
-- x2/year, yearly x1/year — divided by interval_count for a "every N
-- periods" custom interval, then converted between the monthly and annual
-- figure. A subscription past its own cancellation_date is excluded from
-- both totals and from active_subscription_count.
create or replace function public.subscription_cost_summary()
returns table (
  monthly_estimate numeric(20, 4),
  annual_estimate numeric(20, 4),
  active_subscription_count integer
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    coalesce(sum(
      case frequency
        when 'weekly' then amount * 52 / 12 / interval_count
        when 'monthly' then amount / interval_count
        when 'quarterly' then amount / 3 / interval_count
        when 'half_yearly' then amount / 6 / interval_count
        when 'yearly' then amount / 12 / interval_count
      end
    ), 0)::numeric(20, 4),
    coalesce(sum(
      case frequency
        when 'weekly' then amount * 52 / interval_count
        when 'monthly' then amount * 12 / interval_count
        when 'quarterly' then amount * 4 / interval_count
        when 'half_yearly' then amount * 2 / interval_count
        when 'yearly' then amount / interval_count
      end
    ), 0)::numeric(20, 4),
    count(*)::integer
  from public.recurring_items
  where user_id = (select auth.uid())
    and kind = 'subscription'
    and status = 'active'
    and (
      cancellation_date is null
      or cancellation_date > (now() at time zone 'Asia/Kolkata')::date
    );
$$;

revoke all on function public.subscription_cost_summary() from public, anon;
grant execute on function public.subscription_cost_summary() to authenticated;

comment on function public.subscription_cost_summary() is
  'Normalized monthly/annual cost estimate across the caller''s active, '
  'not-yet-cancelled subscriptions — labelled as an estimate in the UI, '
  'never presented as an exact bill total.';

-- =======================================================================
-- 13. Row Level Security
-- =======================================================================
-- Every new table follows the same "table grants are read-only; every
-- mutation goes through a SECURITY DEFINER function" pattern as
-- ledger_transactions/ledger_entries (Phase 3) — none of these four
-- tables gets a direct INSERT/UPDATE policy or grant.

alter table public.budget_periods enable row level security;
alter table public.budget_periods force row level security;

alter table public.budget_allocations enable row level security;
alter table public.budget_allocations force row level security;

alter table public.recurring_items enable row level security;
alter table public.recurring_items force row level security;

alter table public.recurring_occurrences enable row level security;
alter table public.recurring_occurrences force row level security;

revoke all on public.budget_periods from public, anon;
revoke all on public.budget_allocations from public, anon;
revoke all on public.recurring_items from public, anon;
revoke all on public.recurring_occurrences from public, anon;

drop policy if exists budget_periods_select_own on public.budget_periods;
create policy budget_periods_select_own on public.budget_periods
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists budget_allocations_select_own on public.budget_allocations;
create policy budget_allocations_select_own on public.budget_allocations
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists recurring_items_select_own on public.recurring_items;
create policy recurring_items_select_own on public.recurring_items
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists recurring_occurrences_select_own on public.recurring_occurrences;
create policy recurring_occurrences_select_own on public.recurring_occurrences
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.budget_periods to authenticated;
grant select on public.budget_allocations to authenticated;
grant select on public.recurring_items to authenticated;
grant select on public.recurring_occurrences to authenticated;

-- =======================================================================
-- 14. Supabase Cron automation
-- =======================================================================
-- pg_cron is listed as available for this project (see list_extensions).
-- create extension if not exists is itself idempotent/forward-only; and
-- cron.schedule(job_name, ...), when called again with a job name that
-- already exists, updates that job in place rather than creating a
-- duplicate — both statements are safe to re-run.
--
-- The scheduled command is plain SQL calling process_recurring_finance()
-- — no HTTP request, no API key, no Vault secret, nothing beyond what the
-- database itself already has. Hourly is deliberately more frequent than
-- daily so a due-today occurrence is never more than ~1 hour late
-- regardless of what hour of the day "today" starts in Asia/Kolkata.

create extension if not exists pg_cron;

select cron.schedule(
  'penra-recurring-finance-processor',
  '0 * * * *',
  $$select public.process_recurring_finance();$$
);
