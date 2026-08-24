-- Phase 8: automated market data (AMFI mutual-fund NAV, a configurable
-- stock-price provider boundary), price history, provider-aware portfolio
-- revaluation, daily portfolio snapshots, and performance calculations.
--
-- Scope: a normalized market-data model (market_instruments/market_prices/
-- market_data_sync_runs/market_data_provider_state/portfolio_value_
-- snapshots) that sits ALONGSIDE the Phase 7 investment model, never
-- replacing it. A market price affects estimated valuation only — it is
-- never allowed to create, edit, or reverse a ledger transaction or an
-- investment_activities row. Manual valuation (Phase 7) remains a fully
-- supported, always-available fallback; nothing here can overwrite
-- valuation history. See the precedence rule documented on
-- investment_holding_summary in section 7 below.
--
-- Provider status at the time of this migration: AMFI (mutual-fund NAV) is
-- integrated for real against AMFI's official published NAV file — no
-- credential required, since AMFI's data is public. No stock-market
-- provider credential exists in this environment; the full stock-provider
-- boundary (schema, Edge Function, UI states) is implemented against
-- "twelve_data" as the named, documented provider, but it is deployed in
-- an intentionally inert "not configured" state — see
-- market_data_provider_state and the stock-price-refresh Edge Function.

-- =======================================================================
-- 1. Extensions
-- =======================================================================
-- pg_net: async HTTP, used only by pg_cron jobs (section 12) to invoke the
-- deployed Edge Functions on a schedule — never called with a user-
-- supplied URL, never used to send secrets in a query string.
create extension if not exists pg_net;

-- =======================================================================
-- 2. public.market_instruments
-- =======================================================================
-- A provider-catalogued tradable/NAV-published instrument. NOT user-owned
-- — this is reference data every user's linked assets point into, exactly
-- like a shared catalogue (unlike public.investment_assets, which stays
-- per-user). No secret configuration is stored here, so it is safely
-- globally readable (section 11); writes are restricted to the service
-- role and a small number of SECURITY DEFINER functions.

create table if not exists public.market_instruments (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_instrument_id text not null,
  symbol text null,
  exchange text null,
  mic text null,
  isin text null,
  name text not null,
  instrument_kind text not null,
  quote_currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  last_successful_refresh_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint market_instruments_provider_valid check (provider in ('amfi', 'twelve_data')),
  constraint market_instruments_kind_valid check (instrument_kind in ('stock', 'mutual_fund')),
  constraint market_instruments_currency_format check (quote_currency ~ '^[A-Z]{3}$'),
  constraint market_instruments_name_length check (char_length(btrim(name)) between 1 and 200),
  constraint market_instruments_provider_id_length check (char_length(provider_instrument_id) between 1 and 60),
  constraint market_instruments_symbol_length check (symbol is null or char_length(symbol) <= 40),
  constraint market_instruments_exchange_length check (exchange is null or char_length(exchange) <= 40),
  constraint market_instruments_mic_length check (mic is null or char_length(mic) = 4),
  constraint market_instruments_isin_length check (isin is null or char_length(isin) <= 20)
);

comment on table public.market_instruments is
  'Shared, provider-catalogued instrument reference data (AMFI mutual-fund '
  'schemes, and any configured stock-provider symbols) — not user-owned. '
  'public.investment_assets links into this table via a nullable FK '
  '(section 8); the instrument itself carries no per-user state.';

-- Safe provider-specific uniqueness boundary (rule: "prevent duplicate
-- scheme codes"). A provider's own instrument id is the strongest natural
-- key; ISIN is a secondary safety net against the same real-world
-- instrument being catalogued twice under two different provider ids.
create unique index if not exists market_instruments_provider_id_unique
  on public.market_instruments (provider, provider_instrument_id);
create unique index if not exists market_instruments_provider_isin_unique
  on public.market_instruments (provider, upper(isin))
  where isin is not null;

create index if not exists market_instruments_kind_active_idx
  on public.market_instruments (instrument_kind, is_active);

drop trigger if exists set_market_instruments_updated_at on public.market_instruments;
create trigger set_market_instruments_updated_at
  before update on public.market_instruments
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 3. public.market_prices
-- =======================================================================
-- Insert-only history. A later "correction" for the same (instrument,
-- provider, price_kind, effective_date) never overwrites the earlier row
-- in place — it supersedes it via an explicit link, exactly mirroring how
-- Phase 3 handles a ledger correction and Phase 7 handles a reversed
-- investment activity. Only the row with is_current = true is ever used
-- for valuation; every prior row remains queryable for audit.

create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.market_instruments (id) on delete restrict,
  price_kind text not null,
  effective_date date not null,
  price numeric(20, 6) not null,
  currency text not null default 'INR',
  provider text not null,
  received_at timestamptz not null default now(),
  provider_timestamp timestamptz null,
  is_current boolean not null default true,
  superseded_by uuid null references public.market_prices (id),
  created_at timestamptz not null default now(),

  constraint market_prices_kind_valid check (price_kind in ('close', 'nav', 'latest')),
  constraint market_prices_provider_valid check (provider in ('amfi', 'twelve_data')),
  constraint market_prices_price_positive check (price > 0),
  constraint market_prices_currency_format check (currency ~ '^[A-Z]{3}$')
);

comment on table public.market_prices is
  'Insert-only price/NAV history. Exactly one row per (instrument_id, '
  'provider, price_kind, effective_date) may have is_current = true at any '
  'time (see the partial unique index below) — a correction inserts a new '
  'row and flips the old one to is_current = false with superseded_by set, '
  'never an UPDATE of the price itself. A market price affects estimated '
  'valuation only; nothing in this schema references or can create a '
  'ledger_transactions/investment_activities row.';

-- The idempotency boundary the spec calls for, scoped to the current row
-- only — old (superseded) rows are exempt so history can grow freely.
create unique index if not exists market_prices_current_unique
  on public.market_prices (instrument_id, provider, price_kind, effective_date)
  where is_current = true;
create index if not exists market_prices_instrument_date_idx
  on public.market_prices (instrument_id, effective_date desc);
create unique index if not exists market_prices_superseded_by_unique
  on public.market_prices (superseded_by)
  where superseded_by is not null;

-- =======================================================================
-- 4. public.market_data_sync_runs
-- =======================================================================
-- Operational metadata only — never a raw API key, authorization header,
-- or full upstream response body.

create table if not exists public.market_data_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  scope text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status text not null default 'running',
  instruments_requested integer not null default 0,
  instruments_updated integer not null default 0,
  instruments_skipped integer not null default 0,
  error_code text null,
  rate_limit_remaining integer null,
  retry_count integer not null default 0,
  triggered_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint market_data_sync_runs_provider_valid check (provider in ('amfi', 'twelve_data')),
  constraint market_data_sync_runs_status_valid check (status in ('running', 'success', 'partial', 'failed', 'skipped')),
  constraint market_data_sync_runs_scope_length check (char_length(scope) between 1 and 60),
  constraint market_data_sync_runs_error_code_length check (error_code is null or char_length(error_code) <= 60),
  constraint market_data_sync_runs_counts_nonnegative check (
    instruments_requested >= 0 and instruments_updated >= 0
    and instruments_skipped >= 0 and retry_count >= 0
  )
);

comment on table public.market_data_sync_runs is
  'Observability for every refresh attempt (Cron-triggered or self-scoped '
  'user-triggered). error_code is always a safe internal code (see '
  'section 9) — never the raw upstream error body.';

create index if not exists market_data_sync_runs_provider_started_idx
  on public.market_data_sync_runs (provider, started_at desc);
create index if not exists market_data_sync_runs_user_idx
  on public.market_data_sync_runs (triggered_by_user_id)
  where triggered_by_user_id is not null;

-- =======================================================================
-- 5. public.market_data_provider_state
-- =======================================================================
-- One row per provider — current configuration/health, safely readable by
-- any authenticated user (no secret lives here), written only by trusted
-- server-side code.

create table if not exists public.market_data_provider_state (
  provider text primary key,
  is_configured boolean not null default false,
  last_success_at timestamptz null,
  last_attempt_at timestamptz null,
  last_error_code text null,
  consecutive_failures integer not null default 0,
  notes text null,
  updated_at timestamptz not null default now(),

  constraint market_data_provider_state_provider_valid check (provider in ('amfi', 'twelve_data')),
  constraint market_data_provider_state_error_code_length check (last_error_code is null or char_length(last_error_code) <= 60),
  constraint market_data_provider_state_notes_length check (notes is null or char_length(notes) <= 500),
  constraint market_data_provider_state_failures_nonnegative check (consecutive_failures >= 0)
);

comment on table public.market_data_provider_state is
  'One row per market-data provider, never containing a secret value — '
  'only status/health metadata the settings UI (src/app/app/settings/'
  'market-data) reads directly.';

drop trigger if exists set_market_data_provider_state_updated_at on public.market_data_provider_state;
create trigger set_market_data_provider_state_updated_at
  before update on public.market_data_provider_state
  for each row
  execute function public.set_updated_at();

insert into public.market_data_provider_state (provider, is_configured, notes)
values
  ('amfi', true, 'Public AMFI NAV data — no credential required.'),
  ('twelve_data', false, 'No API key configured in this environment. Set TWELVE_DATA_API_KEY as an Edge Function secret to enable live stock price/history refresh.')
on conflict (provider) do nothing;

-- =======================================================================
-- 6. public.portfolio_value_snapshots
-- =======================================================================
-- User-owned, derived, reproducible from stored activities + prices +
-- manual valuations. Never an editable second source of truth — the only
-- writer is public.build_portfolio_snapshot (section 10), and even that
-- function only ever recomputes and upserts, never accepts an arbitrary
-- caller-supplied value for any column.

create table if not exists public.portfolio_value_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  currency text not null,
  snapshot_date date not null,
  invested_cost numeric(20, 4) not null,
  valued_total numeric(20, 4) not null,
  cash_total numeric(20, 4) null,
  liabilities_total numeric(20, 4) null,
  realized_gain numeric(20, 4) not null default 0,
  unrealized_gain numeric(20, 4) not null default 0,
  external_cash_flow numeric(20, 4) not null default 0,
  valuation_coverage_percent numeric(7, 4) not null default 0,
  created_at timestamptz not null default now(),

  constraint portfolio_value_snapshots_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint portfolio_value_snapshots_coverage_range check (
    valuation_coverage_percent between 0 and 100
  )
);

comment on table public.portfolio_value_snapshots is
  'One reproducible daily valuation snapshot per (user, currency, date) — '
  'derived entirely from investment_activities, market_prices, and '
  'investment_valuations at snapshot time. Rebuilding a snapshot for the '
  'same date is idempotent (upsert), never additive.';

create unique index if not exists portfolio_value_snapshots_user_currency_date_unique
  on public.portfolio_value_snapshots (user_id, currency, snapshot_date);
create index if not exists portfolio_value_snapshots_user_date_idx
  on public.portfolio_value_snapshots (user_id, snapshot_date desc);

-- =======================================================================
-- 7. Link public.investment_assets to a market instrument
-- =======================================================================
-- One new nullable column plus a confirmation timestamp. An asset with no
-- link is completely unaffected — manual valuation keeps working exactly
-- as Phase 7 built it. Linking/relinking always goes through
-- link_investment_asset_to_market_instrument (section 8), which enforces
-- the "explicit confirmation before changing an existing mapping" rule —
-- this column is never written directly by client code.

alter table public.investment_assets
  add column if not exists market_instrument_id uuid null references public.market_instruments (id) on delete set null,
  add column if not exists market_link_confirmed_at timestamptz null;

create or replace function public.validate_investment_asset_market_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_instrument_kind text;
begin
  if new.market_instrument_id is not null then
    select instrument_kind into v_instrument_kind
      from public.market_instruments
      where id = new.market_instrument_id;

    if v_instrument_kind is null then
      raise exception 'investment asset references a non-existent market instrument'
        using errcode = 'foreign_key_violation';
    end if;
    if (new.asset_kind = 'stock' and v_instrument_kind <> 'stock')
      or (new.asset_kind = 'mutual_fund' and v_instrument_kind <> 'mutual_fund')
      or (new.asset_kind not in ('stock', 'mutual_fund')) then
      raise exception 'asset kind % cannot be linked to a % market instrument', new.asset_kind, v_instrument_kind
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_investment_asset_market_link() from public, anon, authenticated;

drop trigger if exists investment_assets_validate_market_link on public.investment_assets;
create trigger investment_assets_validate_market_link
  before insert or update on public.investment_assets
  for each row
  execute function public.validate_investment_asset_market_link();

create index if not exists investment_assets_market_instrument_id_idx
  on public.investment_assets (market_instrument_id)
  where market_instrument_id is not null;

-- =======================================================================
-- 8. Scheme search and asset linking
-- =======================================================================

-- 8a. Search the AMFI (or, in the future, any provider's) instrument
-- catalogue by name, provider instrument id, or ISIN. Read-only, no
-- per-user state, so this is plain SQL security invoker over the globally
-- readable market_instruments table.
create or replace function public.search_market_instruments(
  p_query text,
  p_instrument_kind text default null,
  p_limit integer default 20
)
returns setof public.market_instruments
language sql
security invoker
set search_path = ''
stable
as $$
  select *
  from public.market_instruments
  where is_active = true
    and (p_instrument_kind is null or instrument_kind = p_instrument_kind)
    and (
      name ilike '%' || p_query || '%'
      or provider_instrument_id ilike p_query || '%'
      or (isin is not null and isin ilike p_query || '%')
      or (symbol is not null and symbol ilike p_query || '%')
    )
  order by name
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.search_market_instruments(text, text, integer) from public, anon;
grant execute on function public.search_market_instruments(text, text, integer) to authenticated;

-- 8b. Link (or, with explicit confirmation, relink) a caller-owned
-- investment asset to a market instrument. p_confirm_remap must be true
-- when the asset already has a different mapping — a plain "link" call
-- against an already-linked asset with p_confirm_remap = false is
-- rejected, forcing the UI to show an explicit confirmation step first.
create or replace function public.link_investment_asset_to_market_instrument(
  p_asset_id uuid,
  p_market_instrument_id uuid,
  p_confirm_remap boolean default false
)
returns public.investment_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.investment_assets;
  v_instrument public.market_instruments;
begin
  if v_user_id is null then
    raise exception 'link_investment_asset_to_market_instrument requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_asset from public.investment_assets where id = p_asset_id and user_id = v_user_id;
  if v_asset.id is null then
    raise exception 'investment asset not found' using errcode = 'no_data_found';
  end if;

  select * into v_instrument from public.market_instruments where id = p_market_instrument_id and is_active = true;
  if v_instrument.id is null then
    raise exception 'market instrument not found' using errcode = 'no_data_found';
  end if;

  if v_asset.market_instrument_id is not null
    and v_asset.market_instrument_id <> p_market_instrument_id
    and not p_confirm_remap then
    raise exception 'this asset is already linked to a different instrument — confirmation required to change it'
      using errcode = 'invalid_transaction_state';
  end if;

  update public.investment_assets
    set market_instrument_id = p_market_instrument_id, market_link_confirmed_at = now()
    where id = p_asset_id
    returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.link_investment_asset_to_market_instrument(uuid, uuid, boolean) from public, anon;
grant execute on function public.link_investment_asset_to_market_instrument(uuid, uuid, boolean) to authenticated;

create or replace function public.unlink_investment_asset_market_instrument(p_asset_id uuid)
returns public.investment_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.investment_assets;
begin
  if v_user_id is null then
    raise exception 'unlink_investment_asset_market_instrument requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  update public.investment_assets
    set market_instrument_id = null, market_link_confirmed_at = null
    where id = p_asset_id and user_id = v_user_id
    returning * into v_asset;

  if v_asset.id is null then
    raise exception 'investment asset not found' using errcode = 'no_data_found';
  end if;

  return v_asset;
end;
$$;

revoke all on function public.unlink_investment_asset_market_instrument(uuid) from public, anon;
grant execute on function public.unlink_investment_asset_market_instrument(uuid) to authenticated;

-- =======================================================================
-- 9. Valuation precedence: provider price > manual valuation > cost basis
-- =======================================================================
-- This is the one place source precedence is decided — every summary
-- function below calls investment_holding_summary rather than
-- re-deriving precedence, exactly like Phase 7 centralized position math
-- in investment_holding_position.
--
-- Precedence, per the spec:
--   1. A provider price effective within the freshness window (30 days —
--      generous enough to survive an exchange holiday cluster or a missed
--      Cron run without silently reverting to cost basis, while still
--      refusing a genuinely abandoned/very-old provider price).
--   2. The latest manual valuation (Phase 7 — unchanged, never
--      overwritten, always available as a fallback).
--   3. Cost basis — never presented as a "valuation", only as the
--      necessary non-null number net worth/allocation totals require;
--      has_valuation is false in this case and callers must not treat
--      current_value as a real market value.
--
-- A provider price NEVER touches cost_basis, realized_gain, or any
-- ledger/investment_activities row — only current_value/unrealized_gain,
-- exactly as the Phase 8 spec requires.

create or replace function public.market_price_status(p_effective_date date)
returns text
language sql
security invoker
set search_path = ''
stable
as $$
  select case
    when p_effective_date is null then 'missing'
    when p_effective_date >= ((now() at time zone 'Asia/Kolkata')::date - 1) then 'fresh'
    when p_effective_date >= ((now() at time zone 'Asia/Kolkata')::date - 3) then 'delayed'
    else 'stale'
  end;
$$;

revoke all on function public.market_price_status(date) from public, anon;
grant execute on function public.market_price_status(date) to authenticated;

comment on function public.market_price_status is
  'Uniform, documented freshness classification by age of the effective '
  'date (fresh: 0-1 days, delayed: 2-3 days, stale: 4+ days), applied the '
  'same way to both provider prices and manual valuations. A real trading-'
  'calendar-aware policy (skipping weekends/exchange holidays per '
  'instrument) is a documented, deliberate simplification for this phase '
  '— never fabricated data, only a coarser staleness label.';

drop function if exists public.investment_holding_summary();
create function public.investment_holding_summary()
returns table (
  holding_id uuid,
  investment_asset_id uuid,
  asset_kind text,
  display_name text,
  symbol text,
  currency text,
  status text,
  quantity numeric(20, 6),
  avg_unit_cost numeric(20, 6),
  cost_basis numeric(20, 4),
  has_valuation boolean,
  valuation_source text,
  price_effective_date date,
  last_refreshed_at timestamptz,
  price_status text,
  current_value numeric(20, 4),
  unrealized_gain numeric(20, 4),
  realized_gain numeric(20, 4),
  income_received numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  with position as (
    select h.id as holding_id, p.quantity, p.cost_basis
    from public.investment_holdings h
    cross join lateral public.investment_holding_position(h.id) p
  ),
  provider_price as (
    select distinct on (h.id)
      h.id as holding_id, mp.price, mp.effective_date, mp.received_at, mp.provider
    from public.investment_holdings h
    join public.investment_assets a2 on a2.id = h.investment_asset_id
    join public.market_prices mp
      on mp.instrument_id = a2.market_instrument_id
      and mp.is_current = true
      and mp.effective_date >= ((now() at time zone 'Asia/Kolkata')::date - 30)
    where a2.market_instrument_id is not null
    order by h.id, mp.effective_date desc, mp.received_at desc
  ),
  latest_val as (
    select distinct on (v.holding_id) v.holding_id, v.total_value, v.valued_at
    from public.investment_valuations v
    order by v.holding_id, v.valued_at desc
  ),
  realized as (
    select holding_id, coalesce(sum(realized_gain_amount), 0) as total
    from public.investment_activities
    where activity_kind = 'sell' and status = 'posted'
    group by holding_id
  ),
  income as (
    select holding_id, coalesce(sum(gross_amount), 0) as total
    from public.investment_activities
    where activity_kind in ('dividend', 'interest') and status = 'posted'
    group by holding_id
  )
  select
    h.id, h.investment_asset_id, a.asset_kind, a.display_name, a.symbol, h.currency, h.status,
    pos.quantity,
    case when pos.quantity = 0 then null else round(pos.cost_basis / pos.quantity, 6) end,
    pos.cost_basis,
    (pp.holding_id is not null or lv.holding_id is not null),
    case
      when pp.holding_id is not null then pp.provider
      when lv.holding_id is not null then 'manual'
      else 'none'
    end,
    coalesce(pp.effective_date, lv.valued_at::date),
    coalesce(pp.received_at, lv.valued_at),
    public.market_price_status(coalesce(pp.effective_date, lv.valued_at::date)),
    coalesce(pp.price * pos.quantity, lv.total_value, pos.cost_basis),
    case
      when pp.holding_id is not null then (pp.price * pos.quantity) - pos.cost_basis
      when lv.holding_id is not null then lv.total_value - pos.cost_basis
      else null
    end,
    coalesce(r.total, 0),
    coalesce(inc.total, 0)
  from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  join position pos on pos.holding_id = h.id
  left join provider_price pp on pp.holding_id = h.id
  left join latest_val lv on lv.holding_id = h.id
  left join realized r on r.holding_id = h.id
  left join income inc on inc.holding_id = h.id;
$$;

revoke all on function public.investment_holding_summary() from public, anon;
grant execute on function public.investment_holding_summary() to authenticated;

comment on function public.investment_holding_summary is
  'Per-holding position/valuation/gain summary. current_value/'
  'unrealized_gain prefer a fresh-enough provider price (section 9 header '
  'comment for the precedence rule), fall back to the latest manual '
  'valuation, and finally to cost basis (has_valuation = false in that '
  'case — callers must not present cost_basis as a real valuation). '
  'quantity * price is used for a provider price since market_prices '
  'stores a per-unit price/NAV; total_value from investment_valuations is '
  'already the whole-holding value the user entered.';

-- =======================================================================
-- 10. Daily portfolio snapshot
-- =======================================================================
-- Fully reproducible from investment_holdings/investment_activities/
-- market_prices/investment_valuations at call time — never accepts a
-- caller-supplied value for any stored column, and upserting the same
-- (user, currency, date) twice simply recomputes and replaces that one
-- row (idempotent), never appends a duplicate.

create or replace function public.build_portfolio_snapshot(
  p_user_id uuid,
  p_snapshot_date date default null
)
returns setof public.portfolio_value_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot_date date := coalesce(p_snapshot_date, (now() at time zone 'Asia/Kolkata')::date);
begin
  if p_user_id is null then
    raise exception 'build_portfolio_snapshot requires a user id'
      using errcode = 'invalid_parameter_value';
  end if;

  return query
  with holdings as (
    select hs.*
    from public.investment_holding_summary() hs
    join public.investment_holdings h on h.id = hs.holding_id
    where h.user_id = p_user_id
  ),
  by_currency as (
    select
      currency,
      coalesce(sum(cost_basis), 0) as invested_cost,
      coalesce(sum(current_value), 0) as valued_total,
      coalesce(sum(realized_gain), 0) as realized_gain,
      coalesce(sum(current_value) - sum(cost_basis), 0) as unrealized_gain,
      case
        when coalesce(sum(current_value), 0) = 0 then 0
        else round(
          coalesce(sum(current_value) filter (where has_valuation), 0)
            / sum(current_value) * 100,
          4
        )
      end as valuation_coverage_percent
    from holdings
    where status = 'active'
    group by currency
  ),
  day_flows as (
    select
      h.currency,
      coalesce(sum(
        case
          when a.activity_kind in ('buy', 'contribution') then a.gross_amount
          when a.activity_kind in ('sell', 'withdrawal', 'maturity') then -a.gross_amount
          else 0
        end
      ), 0) as external_cash_flow
    from public.investment_activities a
    join public.investment_holdings h on h.id = a.holding_id
    where a.user_id = p_user_id and a.trade_date = v_snapshot_date and a.status = 'posted'
    group by h.currency
  ),
  merged as (
    select
      coalesce(bc.currency, df.currency) as currency,
      coalesce(bc.invested_cost, 0) as invested_cost,
      coalesce(bc.valued_total, 0) as valued_total,
      coalesce(bc.realized_gain, 0) as realized_gain,
      coalesce(bc.unrealized_gain, 0) as unrealized_gain,
      coalesce(bc.valuation_coverage_percent, 0) as valuation_coverage_percent,
      coalesce(df.external_cash_flow, 0) as external_cash_flow
    from by_currency bc
    full outer join day_flows df on df.currency = bc.currency
  )
  insert into public.portfolio_value_snapshots (
    user_id, currency, snapshot_date, invested_cost, valued_total,
    realized_gain, unrealized_gain, external_cash_flow, valuation_coverage_percent
  )
  select
    p_user_id, m.currency, v_snapshot_date, m.invested_cost, m.valued_total,
    m.realized_gain, m.unrealized_gain, m.external_cash_flow, m.valuation_coverage_percent
  from merged m
  on conflict (user_id, currency, snapshot_date) do update
    set invested_cost = excluded.invested_cost,
        valued_total = excluded.valued_total,
        realized_gain = excluded.realized_gain,
        unrealized_gain = excluded.unrealized_gain,
        external_cash_flow = excluded.external_cash_flow,
        valuation_coverage_percent = excluded.valuation_coverage_percent
  returning *;
end;
$$;

revoke all on function public.build_portfolio_snapshot(uuid, date) from public, anon, authenticated;

comment on function public.build_portfolio_snapshot is
  'Recomputes and upserts one user''s daily portfolio_value_snapshots row '
  '— idempotent (same day re-run replaces, never duplicates). Not granted '
  'to authenticated: reachable only via run_portfolio_snapshot_for_all '
  '(Cron, section 12) or build_portfolio_snapshot_self (user-triggered, '
  'section 12), both of which resolve p_user_id safely rather than '
  'trusting a client-supplied id.';

create or replace function public.run_portfolio_snapshot_for_all()
returns table (users_processed integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user record;
  v_count integer := 0;
begin
  for v_user in select distinct user_id from public.investment_holdings
  loop
    perform public.build_portfolio_snapshot(v_user.user_id, null);
    v_count := v_count + 1;
  end loop;

  return query select v_count;
end;
$$;

revoke all on function public.run_portfolio_snapshot_for_all() from public, anon, authenticated;

comment on function public.run_portfolio_snapshot_for_all is
  'Cron entry point (section 12) — snapshots every user who has at least '
  'one investment holding. Not granted to any client role.';

-- =======================================================================
-- 11. Row Level Security
-- =======================================================================

alter table public.market_instruments enable row level security;
alter table public.market_instruments force row level security;
alter table public.market_prices enable row level security;
alter table public.market_prices force row level security;
alter table public.market_data_sync_runs enable row level security;
alter table public.market_data_sync_runs force row level security;
alter table public.market_data_provider_state enable row level security;
alter table public.market_data_provider_state force row level security;
alter table public.portfolio_value_snapshots enable row level security;
alter table public.portfolio_value_snapshots force row level security;

revoke all on public.market_instruments from public, anon;
revoke all on public.market_prices from public, anon;
revoke all on public.market_data_sync_runs from public, anon, authenticated;
revoke all on public.market_data_provider_state from public, anon;
revoke all on public.portfolio_value_snapshots from public, anon;

-- 11a. market_instruments / market_prices / market_data_provider_state:
-- shared reference data, no user ownership, no secret configuration —
-- globally readable by any authenticated user (rule: "Public/shared
-- market-instrument and price tables may be globally readable"). Writes
-- happen only via the service-role Edge Function client (bypasses RLS
-- entirely, matching how Supabase's service_role always has BYPASSRLS)
-- or the SECURITY DEFINER functions above — never a direct client grant.
drop policy if exists market_instruments_select_all on public.market_instruments;
create policy market_instruments_select_all on public.market_instruments
  for select to authenticated
  using (true);
grant select on public.market_instruments to authenticated;

drop policy if exists market_prices_select_all on public.market_prices;
create policy market_prices_select_all on public.market_prices
  for select to authenticated
  using (true);
grant select on public.market_prices to authenticated;

drop policy if exists market_data_provider_state_select_all on public.market_data_provider_state;
create policy market_data_provider_state_select_all on public.market_data_provider_state
  for select to authenticated
  using (true);
grant select on public.market_data_provider_state to authenticated;

-- 11b. market_data_sync_runs: deliberately NOT exposed to authenticated
-- at all (no policy = deny-all under FORCE RLS) — it is operational log
-- data, not something another user's identity (triggered_by_user_id)
-- should be readable through. The settings UI reads provider health from
-- market_data_provider_state instead, which carries no per-user data.

-- 11c. portfolio_value_snapshots: standard per-user pattern, matching
-- every other Phase 7/8 user-owned table.
drop policy if exists portfolio_value_snapshots_select_own on public.portfolio_value_snapshots;
create policy portfolio_value_snapshots_select_own on public.portfolio_value_snapshots
  for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.portfolio_value_snapshots to authenticated;

-- =======================================================================
-- 12. Refresh orchestration: pg_net -> Edge Functions, Cron, self-scoped
-- =======================================================================
-- The Edge Functions themselves hold no secret in the database — they
-- read TWELVE_DATA_API_KEY (if set) from their own Supabase-managed Edge
-- Function environment and use their auto-injected SUPABASE_SERVICE_ROLE_
-- KEY to write results back (service_role bypasses RLS by design, so no
-- extra ingestion RPC is needed for that write path). The value embedded
-- below is the project's public anon key — safe to store in SQL exactly
-- like NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is already safe to ship in
-- the client bundle; it only proves "this is a request for project
-- egywtxjqtfbjutlbwkfc", which is what each function's own verify_jwt
-- gate checks, and grants no privilege beyond that on its own.
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
    timeout_milliseconds := 25000
  );
$$;

revoke all on function public.invoke_market_data_function(text, jsonb) from public, anon, authenticated;

comment on function public.invoke_market_data_function is
  'Fires an async HTTP request (via pg_net) at one of the deployed Phase 8 '
  'Edge Functions. Not granted to any client role — used only by Cron '
  'jobs and run_market_data_refresh_self below. Fire-and-forget: the '
  'function''s own eventual database writes (market_prices, '
  'market_data_sync_runs, market_data_provider_state) are what the UI '
  'actually reads, not this call''s return value.';

-- 12a. AMFI: full scheme master + latest NAV refresh. AMFI publishes one
-- bulk file for every scheme, so there is no narrower "just these
-- schemes" request to make — a full refresh is the correct, bounded unit
-- of work regardless of whether it was Cron- or user-triggered.
create or replace function public.run_amfi_refresh()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select public.invoke_market_data_function('amfi-nav-refresh', '{}'::jsonb);
$$;

revoke all on function public.run_amfi_refresh() from public, anon, authenticated;

-- 12b. Stock prices: scoped to the given instrument ids (bounded — never
-- "refresh everything"). Skips the HTTP call entirely (and records a
-- clearly-labelled skipped sync run) when the provider is not configured,
-- so no request is ever attempted with nothing to authenticate it.
create or replace function public.run_stock_price_refresh(p_instrument_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_configured boolean;
begin
  select is_configured into v_is_configured
    from public.market_data_provider_state where provider = 'twelve_data';

  if not coalesce(v_is_configured, false) or p_instrument_ids is null or array_length(p_instrument_ids, 1) is null then
    insert into public.market_data_sync_runs (
      provider, scope, status, completed_at, error_code,
      instruments_requested, instruments_updated, instruments_skipped
    )
    values (
      'twelve_data', 'stock_latest', 'skipped', now(),
      case when not coalesce(v_is_configured, false) then 'provider_not_configured' else 'no_instruments' end,
      coalesce(array_length(p_instrument_ids, 1), 0), 0, coalesce(array_length(p_instrument_ids, 1), 0)
    );
    return;
  end if;

  perform public.invoke_market_data_function(
    'stock-price-refresh',
    jsonb_build_object('instrument_ids', to_jsonb(p_instrument_ids))
  );
end;
$$;

revoke all on function public.run_stock_price_refresh(uuid[]) from public, anon, authenticated;

-- 12c. Cron entry point — refreshes every user's linked, active stock
-- instruments (archived/unlinked instruments are never requested).
-- Separate from AMFI refresh (section 12a/e) since the two run on
-- different schedules keyed to each market's own publication/close time.
-- Not granted to any client role.
create or replace function public.process_stock_price_refresh_all()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock_instrument_ids uuid[];
begin
  select array_agg(distinct a.market_instrument_id) into v_stock_instrument_ids
  from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  join public.market_instruments mi on mi.id = a.market_instrument_id
  where h.status = 'active' and mi.instrument_kind = 'stock' and mi.is_active = true;

  perform public.run_stock_price_refresh(v_stock_instrument_ids);
end;
$$;

revoke all on function public.process_stock_price_refresh_all() from public, anon, authenticated;

comment on function public.process_stock_price_refresh_all is
  'Cross-user Cron entry point, invoked only by the penra-market-price-'
  'refresh job (section 12e). Never reachable by an authenticated client '
  '— see run_market_data_refresh_self below for the self-scoped '
  'equivalent a client is allowed to trigger.';

-- 12d. Self-scoped, cooldown-limited, user-triggered refresh. Bounded to
-- the caller''s own linked, active holdings only — never an arbitrary
-- user id, never every user.
create or replace function public.run_market_data_refresh_self()
returns table (queued boolean, retry_after_seconds integer, instruments_requested integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cooldown interval := interval '15 minutes';
  v_last_run timestamptz;
  v_seconds_remaining integer;
  v_mf_count integer;
  v_stock_instrument_ids uuid[];
  v_stock_count integer;
begin
  if v_user_id is null then
    raise exception 'run_market_data_refresh_self requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select max(started_at) into v_last_run
    from public.market_data_sync_runs
    where triggered_by_user_id = v_user_id;

  if v_last_run is not null and v_last_run > now() - v_cooldown then
    v_seconds_remaining := ceil(extract(epoch from (v_last_run + v_cooldown - now())))::integer;
    return query select false, greatest(v_seconds_remaining, 1), 0;
    return;
  end if;

  select count(*) into v_mf_count
  from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  join public.market_instruments mi on mi.id = a.market_instrument_id
  where h.user_id = v_user_id and h.status = 'active' and mi.instrument_kind = 'mutual_fund' and mi.is_active = true;

  select array_agg(mi.id) into v_stock_instrument_ids
  from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  join public.market_instruments mi on mi.id = a.market_instrument_id
  where h.user_id = v_user_id and h.status = 'active' and mi.instrument_kind = 'stock' and mi.is_active = true;
  v_stock_count := coalesce(array_length(v_stock_instrument_ids, 1), 0);

  insert into public.market_data_sync_runs (
    provider, scope, status, triggered_by_user_id, instruments_requested
  )
  values ('amfi', 'user_self_scoped', 'running', v_user_id, v_mf_count + v_stock_count);

  if v_mf_count > 0 then
    perform public.run_amfi_refresh();
  end if;
  if v_stock_count > 0 then
    perform public.run_stock_price_refresh(v_stock_instrument_ids);
  end if;

  return query select true, 0, (v_mf_count + v_stock_count);
end;
$$;

revoke all on function public.run_market_data_refresh_self() from public, anon;
grant execute on function public.run_market_data_refresh_self() to authenticated;

comment on function public.run_market_data_refresh_self is
  'User-triggered refresh, scoped entirely to the caller''s own active, '
  'linked holdings — never accepts or trusts a caller-supplied user id. '
  'Rate-limited to one call per 15 minutes per user (checked against this '
  'user''s own market_data_sync_runs.triggered_by_user_id history, never '
  'another user''s). Returns immediately (queued = true/false); the '
  'actual price update lands asynchronously via the invoked Edge '
  'Function''s own database write.';

-- =======================================================================
-- 12e. Cron registration
-- =======================================================================
-- pg_cron runs on UTC. India Standard Time is a fixed UTC+05:30 offset
-- (no DST), so every schedule below is written as "IST time - 5:30" —
-- the same fixed-offset approach the rest of this app already uses for
-- Asia/Kolkata date math (see src/lib/dates/timezone.ts). The existing
-- Phase 6 job (penra-recurring-finance-processor) is untouched — this
-- section only adds three new, independent jobs.
--
--   penra-amfi-nav-refresh        23:00 IST (17:30 UTC) — after AMFI's
--                                  typical same-day NAV publication.
--   penra-amfi-nav-refresh-retry  07:00 IST (01:30 UTC next day) — safety
--                                  net for a late publication; the
--                                  ingestion is idempotent, so re-running
--                                  it is always safe.
--   penra-market-price-refresh    16:00 IST (10:30 UTC) — after NSE/BSE's
--                                  15:30 IST close. A safe no-op today
--                                  (see market_data_provider_state).
--   penra-portfolio-daily-snapshot 00:00 IST (18:30 UTC) — after both of
--                                  the above have had time to complete.

select cron.schedule(
  'penra-amfi-nav-refresh', '30 17 * * *',
  $$select public.run_amfi_refresh();$$
);
select cron.schedule(
  'penra-amfi-nav-refresh-retry', '30 1 * * *',
  $$select public.run_amfi_refresh();$$
);
select cron.schedule(
  'penra-market-price-refresh', '30 10 * * *',
  $$select public.process_stock_price_refresh_all();$$
);
select cron.schedule(
  'penra-portfolio-daily-snapshot', '30 18 * * *',
  $$select public.run_portfolio_snapshot_for_all();$$
);
