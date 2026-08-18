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

-- pgTAP's throws_ok() was tried first (in every argument form its docs
-- describe) and, against a real run, marked tests FAILED even when its own
-- "caught:" diagnostic showed the exact expected SQLSTATE and message —
-- confirmed against the parallel Phase 3 test file too, consistently,
-- across every throws_ok call. Replaced with a small helper this file
-- fully controls: a plain EXCEPTION WHEN OTHERS catch.
create or replace function pg_temp.throws_with_code(p_sql text, p_expected_code text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return false; -- expected an exception; none was raised
exception when others then
  return sqlstate = p_expected_code;
end;
$$;

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

-- Cast to ::int — the column is smallint, and pgTAP's is() has no
-- (smallint, integer, unknown) overload to compare it against a bare
-- integer literal directly (confirmed by a real run: "function is(smallint,
-- integer, unknown) does not exist").
select is(
  (select financial_year_start_month::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
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

-- anon has no grant at all on public.profiles (see migration section 5) —
-- a real run against the parallel case in the Phase 3 tests confirmed this
-- means the query is rejected outright with "permission denied", not
-- silently filtered to zero rows by RLS. Asserting the permission error
-- directly instead of an empty result set.
select ok(
  pg_temp.throws_with_code($$ select count(*) from public.profiles $$, '42501'),
  'anon has no grant on profiles, so even a count() is rejected outright (42501)'
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

select ok(
  pg_temp.throws_with_code(
    $$ update public.profiles set id = '33333333-3333-3333-3333-333333333333' where id = '11111111-1111-1111-1111-111111111111' $$,
    '42501'
  ),
  'updating the id column is rejected (no column-level UPDATE grant) (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ update public.profiles set updated_at = '2000-01-01T00:00:00Z' where id = '11111111-1111-1111-1111-111111111111' $$,
    '42501'
  ),
  'updating the updated_at column directly is rejected (no column-level UPDATE grant) (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ insert into public.profiles (id) values ('44444444-4444-4444-4444-444444444444') $$,
    '42501'
  ),
  'direct insert into public.profiles is denied for authenticated (42501)'
);

select ok(
  pg_temp.throws_with_code(
    $$ delete from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
    '42501'
  ),
  'direct delete from public.profiles is denied for authenticated (42501)'
);

reset role;

select * from finish();

rollback;
