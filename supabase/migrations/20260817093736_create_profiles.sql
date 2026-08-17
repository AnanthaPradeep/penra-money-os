-- Phase 2: personal profile table, automatic creation, RLS, and grants.
--
-- Scope: one row per auth.users id, holding only personal preferences
-- (display name, base currency, locale, timezone, financial-year start).
-- Supabase Auth (auth.users) remains the sole identity source — this table
-- never duplicates the user's email or any authentication credential.
--
-- No financial data, no financial tables, no seed data are introduced by
-- this migration.

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  base_currency text not null default 'INR',
  locale text not null default 'en-IN',
  timezone text not null default 'Asia/Kolkata',
  financial_year_start_month smallint not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null
    or char_length(btrim(display_name)) between 1 and 80
  ),
  constraint profiles_base_currency_format check (
    base_currency ~ '^[A-Z]{3}$'
  ),
  constraint profiles_financial_year_start_month_range check (
    financial_year_start_month between 1 and 12
  ),
  constraint profiles_locale_not_blank check (btrim(locale) <> ''),
  constraint profiles_timezone_not_blank check (btrim(timezone) <> '')
);

comment on table public.profiles is
  'One row per auth.users id. Personal profile/preferences only — never '
  'the email or any credential; Supabase Auth remains the identity source.';

-- ---------------------------------------------------------------------
-- 2. updated_at maintenance trigger
-- ---------------------------------------------------------------------
-- `updated_at` is never trusted from client input (see the grants in
-- section 5, which do not include this column) — this trigger is the only
-- thing that ever sets it on update.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Automatic profile creation on signup
-- ---------------------------------------------------------------------
-- Reads only `display_name` out of `raw_user_meta_data` (the safe, public
-- metadata set via `signUp({ options: { data: { display_name } } })` — see
-- src/lib/auth/actions.ts). Every other column keeps its table default;
-- user-supplied metadata can never override the financial defaults or set
-- the row's ownership — `new.id` (the actual auth.users id, not anything
-- from metadata) is always what's inserted as `id`.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_display_name text;
begin
  safe_display_name := btrim(new.raw_user_meta_data ->> 'display_name');

  if safe_display_name = '' then
    safe_display_name := null;
  elsif safe_display_name is not null and char_length(safe_display_name) > 80 then
    safe_display_name := left(safe_display_name, 80);
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, safe_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
-- Applies RLS even to the table owner role — a deliberate hardening step,
-- not merely the default (which already restricts anon/authenticated).
alter table public.profiles force row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert or delete policy is created for `authenticated` or `anon`:
-- with RLS enabled, the absence of a policy for a command denies it by
-- default. Profile rows are created only by the security-definer trigger
-- above (section 3), which runs as the table owner and is not subject to
-- these policies. There is no "true" / permissive policy anywhere here.

-- ---------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------
-- Belt-and-suspenders alongside RLS: `anon` gets nothing at all, and
-- `authenticated` gets SELECT plus UPDATE scoped to only the five
-- user-editable columns — never `id`, `created_at`, or `updated_at`, and
-- never INSERT/DELETE.

revoke all on public.profiles from public, anon;

grant select on public.profiles to authenticated;
grant update (
  display_name,
  base_currency,
  locale,
  timezone,
  financial_year_start_month
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 6. Backfill for pre-existing auth.users rows
-- ---------------------------------------------------------------------
-- Safe to re-run: only inserts for users that don't already have a
-- profile row, so it never creates duplicates or overwrites an existing
-- profile. Applies the same display-name sanitisation as the trigger.

insert into public.profiles (id, display_name)
select
  u.id,
  nullif(
    left(btrim(u.raw_user_meta_data ->> 'display_name'), 80),
    ''
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
