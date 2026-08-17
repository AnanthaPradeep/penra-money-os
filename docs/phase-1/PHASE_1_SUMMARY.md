# PHASE 1 SUMMARY — PENRA Money OS

> **This document is self-contained.** A new AI session (Claude in VS Code, GitHub Copilot, or any other
> assistant) with no access to prior chat history should be able to read this file plus
> `docs/phase-1/PHASE_1_STATUS.md` and correctly resume work at Phase 2, without needing to read the
> other Phase 1 documents first — though they remain the authoritative detail behind everything
> summarised here.

## 1. Phase Status

**COMPLETE.** All required deliverables exist, all verification commands pass, and no non-goal was
violated. Explicit user approval is required before Phase 2 (authentication) or any database-schema
work begins — none has been given as of this document's writing.

## 2. Phase Objective

Establish a stable, production-minded engineering foundation for PENRA Money OS: Next.js App Router in
TypeScript, Tailwind CSS, a Supabase client/CLI foundation, environment validation, code-quality
tooling, unit/component testing, and CI — with no finance functionality, authentication flow, database
table, or final UI design.

## 3. What Was Implemented

- A Next.js 16.3.1 App Router application (TypeScript, `src/`, Tailwind CSS v4, ESLint flat config,
  `@/*` import alias), scaffolded via a verified temp-directory `create-next-app` run and merged into
  the existing `docs/`-only repository without touching any Phase 0 file.
- A local git repository (`git init`, default branch `main`) — **no commit created**, per instruction.
- Repository baseline: `.gitignore`, `.editorconfig`, `.nvmrc` (20.19.0).
- Full script set: `dev`, `build`, `start`, `lint`, `lint:fix`, `typecheck`, `format`, `format:check`,
  `test`, `test:watch`, `check`, plus Supabase-related `supabase:init`, `db:types:local`,
  `db:types:linked`.
- A typed, Zod-validated, **lazy** environment module (`src/lib/env/client.ts`) for the two public
  Supabase values — never throws on import, only when a Supabase client is actually requested; never
  logs the values themselves, even in its own error messages (tested).
- Supabase browser client (`src/lib/supabase/client.ts`) and server client (`src/lib/supabase/server.ts`,
  guarded by the `server-only` package) — public values only, no queries, no auth, no route protection,
  no `proxy.ts` (explicitly deferred to Phase 2).
- Supabase CLI local foundation: `supabase/config.toml` generated via `supabase init`, reviewed for
  embedded secrets (none found), no migration, no seed data, no Docker dependency introduced.
- A minimal, accessible foundation page (product name, description, foundation-status summary, and an
  explicit "finance features are not yet enabled" notice) with no fake financial data, no login form, no
  charts, and no external image/font network dependency.
- A Vitest + React Testing Library testing foundation, with 16 real (non-snapshot) tests across 4 files.
- A GitHub Actions CI workflow (install → format:check → lint → typecheck → test → build), least-
  privilege permissions, fake placeholder env values only.
- Full documentation set (this file, `PHASE_1_STATUS.md`, and `00`–`05`) plus an updated root
  `README.md`.

## 4. Files Created

**Repository baseline / config** (15): `.editorconfig`, `.env.example`, `.github/workflows/ci.yml`,
`.gitignore`, `.nvmrc`, `.prettierignore`, `.prettierrc.json`, `eslint.config.mjs`, `next.config.ts`,
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `postcss.config.mjs`, `tsconfig.json`,
`vitest.config.mts`.

**Next.js-generated agent guidance** (2, kept deliberately — see
`docs/phase-1/01-engineering-foundation.md` §8): `AGENTS.md`, `CLAUDE.md`.

**Application source** (7): `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`,
`src/app/favicon.ico`, `src/lib/env/client.ts`, `src/lib/supabase/client.ts`,
`src/lib/supabase/server.ts`.

**Tests + shared setup** (5): `src/app/page.test.tsx`, `src/lib/env/client.test.ts`,
`src/lib/supabase/client.test.ts`, `src/lib/supabase/server.test.ts`, `src/test/setup.ts`.

**Supabase CLI** (2): `supabase/config.toml`, `supabase/.gitignore`.

**Documentation** (9): `docs/phase-1/00-phase-1-overview.md` through `05-dependency-baseline.md` (6
files), `docs/phase-1/PHASE_1_STATUS.md`, `docs/phase-1/PHASE_1_SUMMARY.md` (this file), and the root
`README.md`.

**Total: 40 files created.** Auto-generated, git-ignored build artifacts (`next-env.d.ts`,
`tsconfig.tsbuildinfo`, `.next/`, `node_modules/`) exist on disk from running the verification commands
but are not counted as deliverables and will never be committed.

## 5. Files Modified

None. Every file this phase touched was newly created by this phase; no pre-existing file (from Phase 0
or otherwise) was edited. All 15 Phase 0 documents under `docs/phase-0/` were verified present and
unchanged at the end of this phase.

## 6. Installed Dependencies and Versions

Full table with rationale in `docs/phase-1/05-dependency-baseline.md`. Headline versions:

**Production:** `next@16.3.1`, `react@19.2.8`, `react-dom@19.2.8`, `@supabase/supabase-js@2.112.3`,
`@supabase/ssr@0.12.4`, `server-only@0.0.1`, `zod@4.4.3`.

**Development:** `typescript@5.9.3`, `@types/node@20.19.43`, `@types/react@19.2.18`,
`@types/react-dom@19.2.4`, `@tailwindcss/postcss@4.3.3`, `tailwindcss@4.3.3`, `eslint@9.39.5`,
`eslint-config-next@16.3.1`, `eslint-config-prettier@10.1.8`, `prettier@3.9.6`, `vitest@4.1.10`,
`@vitejs/plugin-react@6.0.5`, `@testing-library/react@16.3.2`, `@testing-library/jest-dom@7.0.1`,
`@testing-library/user-event@14.6.4`, `jsdom@29.1.1` (deliberately not `30.x` — see §12),
`supabase@2.114.0`.

## 7. Package Manager

**pnpm 10.34.1**, pinned via `packageManager` in `package.json`. `pnpm-lock.yaml` is the single lockfile
in the repository. No package manager was pre-selected, so pnpm was chosen per the fixed decision to
prefer it in that case.

## 8. Node Version

**20.19.0**, declared in `.nvmrc` and as `engines.node: ">=20.9.0"` in `package.json` — the actual
runtime installed in this development environment, and the version every command in this phase was
verified against. See §12 for the LTS-currency caveat.

## 9. Supabase Setup Status

- **Client foundation:** complete (browser + server factories, public-values-only, tested).
- **CLI foundation:** complete (`supabase init` run; `supabase/config.toml` reviewed for secrets — none
  found).
- **Local Docker stack (`supabase start`):** not run — Docker is unavailable in this environment, and
  nothing in Phase 1 requires it.
- **Remote project link (`supabase link`):** not run — no project reference or credentials were provided
  in this session; none was invented.
- **Database schema / migrations:** none exist — none were created, per explicit Phase 1 scope.
- **Generated types (`src/types/database.types.ts`):** do not exist. Scripts to generate them
  (`pnpm db:types:local` / `pnpm db:types:linked`) are prepared but unrun, since fabricating finance
  table types was explicitly disallowed and no real schema exists yet.

## 10. Whether Remote Supabase Connectivity Was Actually Verified

**No — not verified, not configured.** No live network request was made to any Supabase project in this
phase, and none is claimed to have succeeded. What was verified instead: the production build succeeds
with **zero** Supabase environment variables set (proving the app never contacts Supabase at build
time), and both client factories were tested (with `@supabase/ssr` mocked, no real network call) to
confirm they pass through only the two public values and fail safely — with a clear, non-value-leaking
error — when those values are absent.

## 11. Environment Variables Required

Exactly two, both public, both optional for everything in Phase 1 (dev, lint, typecheck, test, build all
work without either being set):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never a secret/service-role key — none is used anywhere in this codebase. See
`docs/phase-1/03-supabase-foundation.md` §4–5.

## 12. Test / Lint / Typecheck / Build / Formatting Results

All commands below were actually executed in this environment; results are as observed, not assumed.

| Command             | Result   | Detail                                                                                                                             |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` | **Pass** | "All matched files use Prettier code style!" (Phase 0 docs excluded from scope — see `.prettierignore` and the note in §14)        |
| `pnpm lint`         | **Pass** | 0 errors, 0 warnings                                                                                                               |
| `pnpm typecheck`    | **Pass** | 0 errors, TypeScript strict mode                                                                                                   |
| `pnpm test`         | **Pass** | 16/16 tests, 4/4 files (see `04-quality-and-ci.md` §3 for the full list)                                                           |
| `pnpm build`        | **Pass** | Turbopack production build; both routes (`/`, `/_not-found`) statically prerendered; succeeded with zero environment variables set |
| `pnpm check`        | **Pass** | Runs format:check → lint → typecheck → test in sequence                                                                            |

Two real problems were found and fixed during this phase, not hidden:

1. **`jsdom@30` crashed on this environment's Node 20.19.0** with
   `TypeError: webidl.util.markAsUncloneable is not a function`, traced to an `undici@8` incompatibility
   pulled in by that jsdom major. Fixed by pinning `jsdom` to `^29` (which depends on `undici@^7`); all
   tests pass under it.
2. **Testing Library's DOM state leaked between tests** in the same file, because `test.globals` is off
   (all Vitest APIs are explicitly imported) and Testing Library's auto-cleanup only activates when it
   detects a _global_ `afterEach`. Fixed by explicitly registering `afterEach(() => cleanup())` in
   `src/test/setup.ts`.

Both are documented in `docs/phase-1/01-engineering-foundation.md` §8 specifically so a future dependency
upgrade doesn't silently reintroduce either.

## 13. CI Status

`.github/workflows/ci.yml` exists, is structurally correct, and every command it runs was independently
verified locally (table above). It has **not** actually executed on a real GitHub Actions runner in this
session, because no GitHub remote is configured — there is no claim here that it has been observed to
pass in Actions itself, only that its steps are individually proven to work.

## 14. Security Checks

- Repository-wide grep for credential patterns (`service_role`, `SUPABASE_SERVICE`, `sk_live`/`sk_test`,
  AWS access-key pattern, PEM private-key headers, generic `PASSWORD=`, JWT-looking `eyJhbGciOi...`
  strings) across all source, config, and doc files: **one match**, a comment in
  `supabase/config.toml` naming the `service_role` _database role_ — not a credential value.
- `.env.local` confirmed git-ignored (tested with a real, then-deleted, dummy file); `.env.example`
  confirmed trackable and contains placeholders only.
- `node_modules/` confirmed git-ignored.
- No `.env.local` exists anywhere in the repository at the end of this phase.
- `src/lib/supabase/server.ts` is guarded by the `server-only` package; its own test suite proves the
  guard is live by mocking it and showing the module only behaves as a no-op with that mock present.
- No CVV, PIN, OTP, banking password, or Supabase secret/service-role key appears anywhere in the
  repository.
- No database table, migration, or RLS policy exists — nothing to secure yet, and nothing was created.
- No production data mutation was ever attempted — every Supabase-adjacent test mocks `@supabase/ssr`
  and/or `next/headers`; no test or command in this phase made a real network call.

## 15. Assumptions

1. No package manager, framework, or application code pre-existed, so scaffolding via a verified
   temp-directory `create-next-app` run and merge was the correct path.
2. The repository is intended for eventual GitHub hosting (a CI workflow was added) despite no remote
   being configured in this session — inferred from the brief's own framing ("Claude in VS Code and
   GitHub Copilot" alternating on this repository).
3. `@types/node` was pinned to the latest `20.x` patch rather than the newest available major (`26.x`)
   to keep type definitions aligned with the actually-installed Node runtime.
4. `git init` (without a commit) was judged to be within "repository baseline" scope, since later
   deliverables (`.gitignore`, CI, "git status review" as a verification step) all presuppose a git
   repository exists.

## 16. Blockers

None that prevented completing Phase 1. Two items are genuinely pending, not blocking:

- No Supabase project credentials were provided — remote linking and live connectivity verification are
  deferred to whenever real credentials are available, not required for Phase 1 completion.
- Docker is unavailable in this environment — blocks only the optional local Supabase stack
  (`supabase start`), which nothing in this phase depends on.

## 17. Deferred Work

See `docs/phase-1/05-dependency-baseline.md` §5 for the full list of intentionally-deferred dependencies
and `docs/phase-1/03-supabase-foundation.md` §11–12 for what specifically remains for Phase 2 and Phase 3. Headline items: Supabase Auth integration and `proxy.ts` session refresh (Phase 2); the core ledger
schema, RLS policies, and first real `db:types` run (Phase 3); `src/components/` and `src/types/` will
be created only once they have genuine content (no premature scaffolding).

## 18. Known Warnings

- **Node 20.x is past its official LTS support window** as of this phase's authoring date (August
  2026), even though every command here ran correctly on it and Next.js 16.3.1 only requires
  `>=20.9.0`. No version manager was available to upgrade safely in this environment. Recommended:
  upgrade the development machine to an active LTS line (22.x or 24.x) before production use.
- **`jsdom` must stay on the `^29` line** until the `undici@8` incompatibility with this environment's
  Node version is independently confirmed resolved (e.g., after a Node upgrade) — see §12.
- A `pnpm install` warning about one deprecated transitive dependency (`tsconfck@3.1.6`) was observed;
  it does not affect any Phase 1 functionality and is noted for future awareness only (see
  `05-dependency-baseline.md` §4).

## 19. Exact Phase 2 Starting Point

Per `docs/phase-0/10-product-roadmap.md`, **Phase 2: Authentication and Personal Profile** is next, and
only after explicit user approval. Its scope, per that roadmap entry and `03-supabase-foundation.md`
§11: provision/link a real Supabase project; integrate Supabase Auth (sign-in/sign-out, session
handling); implement `proxy.ts` (Next.js's current Proxy convention — the deprecated `middleware.ts` is
never used) for session refresh via `supabase.auth.getClaims()`, propagating the refreshed token to
Server Components and the browser via cookies; create the `User` entity / personal profile as the first
real database table, with **Row Level Security enabled from that very first table** (per
`docs/phase-0/09-architecture-decisions.md` ADR-03) — not retrofitted later.

**Do not begin Phase 2, or create any database table, without explicit user approval.**
