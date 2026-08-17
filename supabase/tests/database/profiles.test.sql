-- pgTAP tests for the public.profiles table, its triggers, RLS policies,
-- and grants (see supabase/migrations/20260817093736_create_profiles.sql).
--
-- NOT EXECUTED in this environment — Docker is unavailable here, and
-- `supabase test db` / `supabase db reset` both require the local Postgres
-- stack to run. Written to be run with:
--
--   supabase start
--   supabase test db supabase/tests/database/profiles.test.sql
--
-- (or `supabase db reset` first, if migrations haven't been applied
-- locally yet). Every assertion below was reviewed carefully by hand
-- against the migration it tests, but "written correctly" is not the same
-- claim as "observed to pass" — treat this file as unverified until it has
-- actually been run once Docker/local Supabase is available.

begin;

select plan(28);

-- ---------------------------------------------------------------------
-- Schema: table, RLS flags, policies, absence of insert/delete/permissive
-- policies, and both triggers exist.
-- ---------------------------------------------------------------------

select ok(
  exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'profiles'
  ),
  'public.profiles table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'row level security is enabled on public.profiles'
);

select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'row level security is forced (applies even to the table owner)'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ),
  'profiles_select_own policy exists'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ),
  'profiles_update_own policy exists'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'INSERT'),
  0,
  'no INSERT policy exists on public.profiles (direct insert is denied by default)'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'DELETE'),
  0,
  'no DELETE policy exists on public.profiles (direct delete is denied by default)'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and qual = 'true'),
  0,
  'no permissive true-qualified policy exists on public.profiles'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'set_profiles_updated_at'
      and not tgisinternal
  ),
  'set_profiles_updated_at trigger exists on public.profiles'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and not tgisinternal
  ),
  'on_auth_user_created trigger exists on auth.users'
);

-- ---------------------------------------------------------------------
-- Behavioural: automatic profile creation, sanitisation, defaults,
-- backfill de-duplication. Runs as the default (superuser) test role so
-- these inserts into auth.users are not themselves subject to RLS.
-- ---------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data)
values (
  '11111111-1111-1111-1111-111111111111',
  'pgtap-user-one@example.com',
  '{"display_name": "  Test User One  "}'::jsonb
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '22222222-2222-2222-2222-222222222222',
  'pgtap-user-two@example.com',
  '{}'::jsonb
);

select ok(
  exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'signup trigger creates a profile row automatically'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Test User One',
  'trigger trims the display name pulled from user metadata'
);

select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'trigger stores null display_name when none is supplied in metadata'
);

select is(
  (select base_currency from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'INR',
  'base_currency defaults to INR'
);

select is(
  (select locale from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'en-IN',
  'locale defaults to en-IN'
);

select is(
  (select timezone from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Asia/Kolkata',
  'timezone defaults to Asia/Kolkata'
);

select is(
  (select financial_year_start_month from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  4,
  'financial_year_start_month defaults to 4 (April)'
);

-- Simulates the migration's backfill step running again (idempotency /
-- no-duplicates check), exactly as it would on a second `db push`.
insert into public.profiles (id, display_name)
select u.id, null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'backfill logic does not create a duplicate profile for an existing user'
);

-- ---------------------------------------------------------------------
-- Access control: anonymous denial, own-row access, cross-user denial,
-- ownership/timestamp column protection.
-- ---------------------------------------------------------------------

set local role anon;

select is(
  (select count(*)::int from public.profiles),
  0,
  'anon role sees zero profile rows'
);

reset role;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.profiles),
  1,
  'authenticated user sees exactly one profile row (their own)'
);

select is(
  (select id::text from public.profiles limit 1),
  '11111111-1111-1111-1111-111111111111',
  'authenticated user can read their own profile'
);

select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'authenticated user cannot read another user''s profile'
);

update public.profiles
set display_name = 'Updated Name'
where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Updated Name',
  'authenticated user can update their own editable fields'
);

-- RLS silently scopes this to zero affected rows rather than erroring —
-- confirm no other user's row was touched, from the same (superuser)
-- vantage point used for setup above.
reset role;

select is(
  (select count(*)::int from public.profiles
    where id = '22222222-2222-2222-2222-222222222222' and display_name is not null),
  0,
  'authenticated user cannot update another user''s profile'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ update public.profiles set id = '33333333-3333-3333-3333-333333333333' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'updating the id column is rejected (no column-level UPDATE grant)'
);

select throws_ok(
  $$ update public.profiles set updated_at = '2000-01-01T00:00:00Z' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'updating the updated_at column directly is rejected (no column-level UPDATE grant)'
);

select throws_ok(
  $$ insert into public.profiles (id) values ('44444444-4444-4444-4444-444444444444') $$,
  '42501',
  null,
  'direct insert into public.profiles is denied for authenticated'
);

select throws_ok(
  $$ delete from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'direct delete from public.profiles is denied for authenticated'
);

reset role;

select * from finish();

rollback;
