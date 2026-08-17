# 04 — Quality and CI

## 1. Test Strategy

Phase 1 has no finance logic to test — the strategy is to prove the **engineering foundation itself**
behaves correctly: the foundation page renders what it should and nothing it shouldn't, environment
validation accepts good input and rejects bad input with a safe error (never leaking values), and both
Supabase client factories pass through only public configuration and never attempt a real network call
in tests. No test is snapshot-only; every test asserts a specific, meaningful behaviour.

## 2. Test Configuration

- **Runner:** Vitest 4.1.10, configured in `vitest.config.mts`.
- **DOM environment:** jsdom 29.1.1 (pinned below the newest major — see `05-dependency-baseline.md`
  for why).
- **React support:** `@vitejs/plugin-react`.
- **Path aliases:** resolved via Vite's native `resolve.tsconfigPaths: true` (reads `tsconfig.json`'s
  `@/*` alias directly; no separate plugin dependency).
- **Matchers:** `@testing-library/jest-dom/vitest`, imported once in `src/test/setup.ts`.
- **Cleanup:** `src/test/setup.ts` also registers `afterEach(() => cleanup())` explicitly. `test.globals`
  is off (all Vitest APIs are explicitly imported in every test file), so Testing Library's own
  auto-cleanup — which only activates when it detects a _global_ `afterEach` — never triggers on its
  own; without this explicit registration, DOM state leaks between tests in the same file. This was
  caught directly (not theoretically): the first test run failed with "multiple elements found" and a
  heading-count assertion off by exactly the number of accumulated, un-cleaned renders, which is what
  led to adding this line.
- **Convention:** tests are colocated with the code they test (`*.test.ts(x)` next to the source file),
  not centralized. `src/test/` holds only shared setup, per the brief's own description of that
  directory ("shared test setup and utilities").

## 3. Current Tests

**`src/lib/env/client.test.ts`** (6 tests) — `getClientEnv`:

- accepts a correctly shaped public environment
- rejects a missing URL
- rejects a missing publishable key
- rejects a URL that is not a valid URL
- rejects an empty publishable key
- never includes the actual values in its error message (proves no secret/value leakage even on
  failure)

**`src/lib/supabase/client.test.ts`** (2 tests) — `createSupabaseBrowserClient`, with `@supabase/ssr`
mocked (no real network call):

- calls `createBrowserClient` with only the public URL and publishable key
- throws a clear error instead of contacting Supabase when configuration is missing

**`src/lib/supabase/server.test.ts`** (3 tests) — `createSupabaseServerClient`, run under
`// @vitest-environment node` (proving the `server-only` guard is real — see
`01-engineering-foundation.md` §8), with `@supabase/ssr` and `next/headers` mocked:

- calls `createServerClient` with only the public URL and publishable key
- reads cookies from Next.js's request-scoped cookie store
- throws a clear error instead of contacting Supabase when configuration is missing

**`src/app/page.test.tsx`** (5 tests) — the foundation page:

- renders the product name
- renders the short description
- makes clear that finance features are not yet enabled
- contains no fake financial values (asserts no ₹/currency-style patterns anywhere in the rendered
  output)
- uses a single top-level heading for correct document structure

**Total: 16 tests across 4 files, all passing** (verified in this phase — see §6).

No test requires a real Supabase project, and no test performs any data mutation — every external
dependency (`@supabase/ssr`, `next/headers`, `server-only`) is mocked at the module boundary.

## 4. CI Steps

`.github/workflows/ci.yml` runs on push and pull request to `main`, with `permissions: contents: read`
(least privilege — no deploy, no write access, no automatic commits). Steps, in order:

1. Checkout (`actions/checkout@v4`)
2. Set up pnpm (`pnpm/action-setup@v4`, version read from `package.json`'s `packageManager` field)
3. Set up Node.js (`actions/setup-node@v4`, version read from `.nvmrc`, pnpm store caching enabled)
4. `pnpm install --frozen-lockfile` (fails if the lockfile is out of sync, rather than silently
   updating it)
5. `pnpm format:check`
6. `pnpm lint`
7. `pnpm typecheck`
8. `pnpm test`
9. `pnpm build`

Two fake, clearly-labelled placeholder environment values
(`NEXT_PUBLIC_SUPABASE_URL=https://ci-placeholder.supabase.co`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci_placeholder_0000000000`) are set at the workflow
level, defensively — the build was verified to succeed without them (§3 of
`03-supabase-foundation.md`), but Next.js inlines any referenced `NEXT_PUBLIC_*` value at build time, so
providing correctly-shaped fakes keeps the CI build representative of a real one without ever risking a
live call. No real credential appears anywhere in the workflow file.

## 5. Local Equivalents

Every CI step has an identical local command (see `02-local-development.md` for full detail):

| CI step          | Local command       |
| ---------------- | ------------------- |
| Install          | `pnpm install`      |
| Formatting check | `pnpm format:check` |
| Lint             | `pnpm lint`         |
| Typecheck        | `pnpm typecheck`    |
| Tests            | `pnpm test`         |
| Build            | `pnpm build`        |

`pnpm check` runs the first four (format, lint, typecheck, test) in one command for a fast local
feedback loop; CI runs all steps individually for clearer failure attribution and additionally runs
`pnpm build`.

## 6. Verification Actually Performed (This Phase)

Run directly, in this environment, with real output reviewed (not assumed):

| Command             | Result                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install`      | Succeeded — 24 packages installed, `pnpm-lock.yaml` up to date                                                                             |
| `pnpm format:check` | Passed — "All matched files use Prettier code style!"                                                                                      |
| `pnpm lint`         | Passed — zero errors, zero warnings                                                                                                        |
| `pnpm typecheck`    | Passed — zero errors                                                                                                                       |
| `pnpm test`         | Passed — 16/16 tests, 4/4 files                                                                                                            |
| `pnpm build`        | Succeeded — Turbopack production build, both routes (`/`, `/_not-found`) prerendered as static content, **zero environment variables set** |

Two real failures were found and fixed during this phase (not hidden): the `jsdom@30`/`undici@8`
crash (fixed by pinning `jsdom@^29`) and missing RTL cleanup between tests causing accumulated-render
failures (fixed by explicit `afterEach(cleanup)`). Both are documented in
`01-engineering-foundation.md` §8 and `02-local-development.md` §11, since either could plausibly
resurface for a future contributor upgrading a dependency without reading this far.

The GitHub Actions workflow itself has **not** been executed by a real GitHub Actions runner in this
session — there is no GitHub remote configured yet (see `PHASE_1_SUMMARY.md`). Its YAML structure and
the commands it runs are correct (each command was independently verified locally, per the table
above), but "the workflow ran green on GitHub" is not a claim made here, since it hasn't run there yet.

## 7. Security Checks (Quality-Adjacent)

- **Client/server boundary:** `src/lib/supabase/server.ts` imports `server-only`; its own test suite
  proves the guard is live (§3). No server-only module is imported by any client-rendered page.
- **Secret exposure:** only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
  ever read anywhere in the codebase — confirmed by grepping the full source tree (see
  `PHASE_1_SUMMARY.md` §9 for the exact scan performed).
- **Unused dependencies:** `vite-tsconfig-paths` was added, found to be unnecessary once Vite's native
  `resolve.tsconfigPaths` was used instead, and removed again in the same phase rather than left as dead
  weight.
- **Unsafe `any`:** none introduced. `tsc --noEmit` under strict mode passes, and the two Supabase
  client test files use an explicit local type (`CookiesAdapter`) rather than `any` to type mock call
  arguments.
- **Build-time network requests:** verified absent — see §6 (`pnpm build` succeeds with no environment
  variables set at all, which would be impossible if the build attempted a live Supabase call).
- **Hydration issues:** the foundation page is a plain server-rendered component with no client-only
  state, no `useEffect`, and no browser-only API — nothing on the page can produce a server/client HTML
  mismatch.
- **Accessibility:** the foundation page uses one `<h1>`, semantic `<section>`/`<h2>`/`<dl>` structure,
  and no interactive controls (so no custom keyboard handling was needed); `eslint-plugin-jsx-a11y`
  (bundled in `eslint-config-next`) ran clean against it.

## 8. Known Gaps

- No end-to-end testing — correctly deferred per the brief ("introduce E2E when real user journeys
  exist"); there are none yet.
- The CI workflow's correctness is verified by construction (every command it runs was independently
  run and verified locally) but not yet by an actual GitHub Actions execution, since no remote exists
  yet.
- No dependency-vulnerability scan (`pnpm audit` or equivalent) was run as part of this phase; it is
  recorded as a standing practice to adopt once real dependencies with actual attack surface (auth,
  database queries) exist, per `docs/phase-0/08-security-privacy-and-compliance.md` §15.

## 9. Future Testing Additions

- **Phase 2:** tests for session handling and `proxy.ts` behaviour (Next.js ships experimental testing
  utilities for Proxy — `next/experimental/testing/server` — worth evaluating then).
- **Phase 3:** tests for ledger invariants (transfers excluded from income/expense, audit history on
  edit) once real tables and queries exist.
- **Ongoing:** `pnpm audit` (or equivalent) added to CI once the dependency surface includes anything
  security-sensitive beyond today's static foundation.
