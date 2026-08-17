# 03 — Supabase Foundation

## 1. Why Supabase

Fixed by Phase 0 (`docs/phase-0/09-architecture-decisions.md` ADR-01–06): Supabase-managed PostgreSQL
gives PENRA Money OS a relational database with strong transactional integrity, a decimal-safe
`NUMERIC` type for future money handling, and Row Level Security that maps directly onto the
"single-user-today, multi-user-ready-architecture" requirement — RLS turns the eventual multi-user
transition into "more rows," not a schema rewrite. Supabase also bundles Auth, Storage, and Edge
Functions, avoiding a multi-vendor integration burden for what is currently a single-developer project.
Phase 1 does not exercise any of this beyond the client/CLI foundation — no table, policy, or query
exists yet.

## 2. Browser Client

`src/lib/supabase/client.ts`:

```ts
export function createSupabaseBrowserClient() {
  const env = getClientEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
```

Uses `createBrowserClient` from `@supabase/ssr`, the current officially-recommended way to create a
Supabase client in Client Components. Per Supabase's own current documentation (verified live during
this phase — see §10), `createBrowserClient` **already implements a singleton internally**, so calling
this factory repeatedly does not create redundant client instances; no additional memoization was added
on top, since doing so would just duplicate what the library already guarantees.

This factory contains no application-specific queries — that begins in a later phase, once there is
something to query.

## 3. Server Client

`src/lib/supabase/server.ts`:

```ts
export async function createSupabaseServerClient() {
  const env = getClientEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          /* see source: try/catch, Server Component case */
        },
      },
    },
  );
}
```

Uses `createServerClient` from `@supabase/ssr` with the current `getAll`/`setAll` cookie-adapter shape
(the older `get`/`set`/`remove` trio is superseded). `cookies()` from `next/headers` is **async** in
this Next.js version — confirmed directly from the bundled Next.js 16.3.1 documentation, not assumed —
so the factory itself is `async` and must be awaited by its caller.

Per Supabase's own guidance, the server client **cannot** be reused across requests (it's bound to that
request's cookies), so — unlike the browser client — a fresh instance is created on every call. This is
correct, not an oversight.

The module starts with `import "server-only";`, so any accidental import of this file from a Client
Component fails the build loudly instead of silently leaking server-only code into the browser bundle.
`src/lib/supabase/server.test.ts` verifies this guard is real by mocking `server-only` and confirming
the module only behaves as a no-op when that mock is present — i.e., it proves the module would
otherwise throw.

No login, signup, logout, or route-protection function exists in either client file — that is explicitly
Phase 2 scope.

## 4. Public Publishable Key

Both clients read exactly two environment values, both meant to be public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

These are the current Supabase-recommended names (verified live against Supabase's own documentation
during this phase — see §10) and match this phase's fixed decision exactly. Next.js inlines any
`NEXT_PUBLIC_*` variable into the client bundle at build time, so both are safe to expose to the browser
by design — the publishable key is meant to be public and is the value Row Level Security (once real
tables exist) is designed to make safe.

## 5. Secret-Key Restrictions

No Supabase secret/service-role key is read, referenced, or stored anywhere in this codebase. Per the
Phase 1 brief: _"Do not add a Supabase secret/service-role key unless a real Phase 1 server-only need
exists. There should normally be no such need in this phase."_ — there is no such need. The server
client uses the same public URL and publishable key as the browser client; a secret key is a distinct,
more-privileged credential reserved for a genuine future admin/bypass-RLS operation, and none exists
yet. `src/lib/env/server.ts` was deliberately **not created** for the same reason — both Supabase
clients share the one public-only env module, `src/lib/env/client.ts`.

## 6. Local CLI Setup

`supabase` (2.114.0) is installed as a **devDependency**, run via `pnpm exec supabase ...` — the
currently-supported way to use the CLI from within a project, rather than a global npm install.

`pnpm exec supabase init --yes` was run once, generating:

- `supabase/config.toml` — the local project configuration (API/DB/Auth/Storage port defaults, project
  id derived from the directory name). Reviewed line-by-line for embedded secrets: every credential-like
  field is either commented out or uses the CLI's `env(VAR_NAME)` substitution convention — nothing
  sensitive is present in the committed file.
- `supabase/.gitignore` — ignores the CLI's own local runtime state (`.branches`, `.temp`,
  `.env.keys`, `.env.local`, `.env.*.local`).

**Docker was not available in this environment**, and `supabase start` (which runs the full local
Postgres/Auth/Storage stack in Docker) was **not run** — it is not required for anything in Phase 1
(linting, testing, and building the Next.js app all work without it), and the brief explicitly says not
to require Docker for normal frontend work or to start the stack automatically when Docker is
unavailable.

## 7. Remote Project Linking

**Not performed.** No Supabase project reference, URL, or key was provided in this session. Per
explicit instruction, no project reference was invented and no `supabase link` command was run.

When a real project is available, linking is:

```bash
pnpm exec supabase login       # interactive browser-based auth; never paste a token into a file
pnpm exec supabase link --project-ref <your-project-ref>
```

Never commit a Personal Access Token or place one in a source file — `supabase login` handles auth
without ever writing a token into the repository.

## 8. Current Connection-Verification Status

**Not verified. Not configured.** No live request was made to any Supabase project, and none is claimed
to have succeeded. What _was_ verified in this phase:

- `pnpm build` succeeds with **zero** `NEXT_PUBLIC_SUPABASE_*` environment variables set — proving the
  production build genuinely does not contact Supabase or require a live network response.
- `src/lib/supabase/client.test.ts` and `src/lib/supabase/server.test.ts` verify (with `@supabase/ssr`
  mocked — no real network call) that both factories pass through **only** the two public values, and
  that both throw a clear configuration error instead of attempting any network call when those values
  are missing.
- `supabase/config.toml` was reviewed for embedded secrets (§6) — no live read against it was needed
  since it's a static local file, not a live connection.

No table was created or altered anywhere, local or remote — there is no schema to have created one
against.

## 9. Type-Generation Strategy

No database types were generated or hand-written in Phase 1. Fabricating finance table types was
explicitly disallowed, and no Supabase project (local, running, or linked) currently has a schema to
generate real types from. Two scripts are prepared in `package.json` for when one exists:

```bash
pnpm db:types:local    # supabase gen types typescript --local  > src/types/database.types.ts
pnpm db:types:linked   # supabase gen types typescript --linked > src/types/database.types.ts
```

Neither has been run. `src/types/` does not exist yet in this repository — it will be created the first
time one of these scripts actually produces a file, expected in **Phase 3** (Accounts and Ledger) once
real migrations exist, per `docs/phase-0/10-product-roadmap.md`.

## 10. Current Official Documentation

Consulted directly during this phase (live, not from prior training knowledge, given how recently
Supabase's SSR guidance and Next.js 16 itself have changed):

- Supabase — Next.js SSR client setup:
  <https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs>
- Supabase documentation home: <https://supabase.com/docs>
- Next.js 16 `proxy.js` file convention (bundled with the installed `next` package, under
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`), covering the
  `middleware.ts` → `proxy.ts` rename referenced throughout this document set.
- Next.js 16 `cookies()` function reference (same bundled docs, under
  `.../04-functions/cookies.md`), confirming the async `cookies()` API used in §3.

## 11. What Remains for Phase 2

- Supabase Auth integration: sign-in/sign-out, session handling.
- `proxy.ts` (Next.js's current Proxy convention, replacing the deprecated `middleware.ts`) for session
  refresh via `supabase.auth.getClaims()`, propagating the refreshed token to Server Components and the
  browser via cookies — this is the officially-documented pattern for keeping sessions fresh, and is
  explicitly out of scope for Phase 1.
- The `User` entity / personal profile, with Row Level Security enabled from its very first table (per
  `docs/phase-0/09-architecture-decisions.md` ADR-03).
- Real linking to a Supabase project, once credentials are available.

## 12. What Remains for Phase 3

- The core ledger schema (Account, Transaction, Transaction Entry, and related entities from
  `docs/phase-0/06-conceptual-data-model.md`), as actual Supabase migrations.
- Row Level Security policies for every user-owned table.
- The first real run of `pnpm db:types:local` / `pnpm db:types:linked`, replacing the currently-absent
  `src/types/database.types.ts` with generated types from the real schema.
