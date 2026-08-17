# 02 — Local Development

All commands below use **pnpm** (10.34.1) — the package manager selected for this repository. See
`01-engineering-foundation.md` §2 for why.

## 1. Prerequisites

- **Node.js 20.19.0** (or any version satisfying `>=20.9.0`). See `.nvmrc`. If you use a Node version
  manager, run `nvm use` (or equivalent) in the repository root.
- **pnpm 10.34.1.** Install via `npm install -g pnpm` or `corepack enable` if you don't already have it.
- **Git.**
- **Docker is not required** for anything in this phase — not for `dev`, `lint`, `typecheck`, `test`, or
  `build`. It is only needed later if you choose to run the local Supabase stack
  (`supabase start`), which is out of Phase 1's scope. See `03-supabase-foundation.md` §6.
- A Supabase project is **not required** to run this phase's app, tests, or build. It is only needed if
  you want a foundation page that could eventually reach a real project in a later phase.

## 2. Installing Dependencies

```bash
pnpm install
```

This reads `pnpm-lock.yaml` and installs the exact versions recorded there (see
`05-dependency-baseline.md`).

## 3. Setting Up Environment Variables

```bash
cp .env.example .env.local
```

Then, if you have a Supabase project, fill in its two public values in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

You can find both in your Supabase project's dashboard under **Project Settings → API**. Use the
**publishable** key, never the **secret**/service-role key — see `03-supabase-foundation.md` §4–5 for
why that distinction matters.

**You do not need to do this to work on Phase 1.** Nothing in the foundation page, the test suite, or
the production build calls Supabase. `.env.local` only matters once a later phase actually adds a
Supabase-backed feature.

`.env.local` is git-ignored (`.gitignore`) — it will never be committed. Never put a real value into
`.env.example` itself; that file is tracked in git and must only ever contain placeholders.

## 4. Starting the Development Server

```bash
pnpm dev
```

Opens at `http://localhost:3000`. Next.js 16 uses Turbopack by default for `dev` and `build`.

## 5. Running Formatting

```bash
pnpm format         # rewrites files in place
pnpm format:check   # verifies formatting without writing (used in CI)
```

Prettier is configured via `.prettierrc.json`. `docs/phase-0/` is intentionally excluded from
formatting (see `.prettierignore`) — those are finished Phase 0 deliverables, not part of this phase's
engineering scope, and are left untouched.

## 6. Running Lint

```bash
pnpm lint       # reports problems
pnpm lint:fix   # applies safe autofixes
```

ESLint uses the flat-config format (`eslint.config.mjs`), built on `eslint-config-next` (Core Web
Vitals + TypeScript + accessibility rules via `eslint-plugin-jsx-a11y`) plus `eslint-config-prettier` to
disable any stylistic rule that would conflict with Prettier.

## 7. Running Typecheck

```bash
pnpm typecheck
```

Runs `tsc --noEmit` under TypeScript strict mode. This does not require a prior build — it does not
depend on Next's auto-generated route types (`.next/types/`), which is why the root layout uses an
explicit `{ children: ReactNode }` prop type instead of Next's generated `LayoutProps<"/">` helper (that
generated type only exists after a build/dev run, which would make typecheck order-dependent — not
acceptable given typecheck runs before build in CI).

## 8. Running Tests

```bash
pnpm test         # runs once (used in CI)
pnpm test:watch   # watch mode for local development
```

Vitest + React Testing Library, jsdom environment. See `04-quality-and-ci.md` for the full test
strategy and what each test actually verifies. No test requires a real Supabase project or performs any
network call.

## 9. Running the Production Build

```bash
pnpm build
```

Verified to succeed with **zero environment variables set** — the build never contacts Supabase (see
`03-supabase-foundation.md` §8). To run the built app locally afterward: `pnpm start`.

## 10. Running the Combined Check

```bash
pnpm check
```

Runs, in order: `format:check` → `lint` → `typecheck` → `test`. This is the fast, non-destructive
everyday quality gate. It intentionally does not include `pnpm build` (which is slower and is run as
its own explicit step, matching the CI workflow's structure — see `04-quality-and-ci.md`).

## 11. Troubleshooting Common Setup Errors

**`pnpm: command not found`**
Install pnpm first (`npm install -g pnpm` or `corepack enable`), then retry.

**`pnpm install` fails with an engine/Node version error**
Check `node --version` against `.nvmrc` (20.19.0) / the `engines.node` field in `package.json`
(`>=20.9.0`). Use a Node version manager to switch if needed.

**`pnpm typecheck` fails with `Cannot find name 'LayoutProps'`**
This should not happen — the root layout deliberately does not depend on Next's generated route types
(see §7). If you see this, check that `src/app/layout.tsx` still imports `ReactNode` from `"react"`
rather than using a generated `LayoutProps<...>` type.

**Vitest fails to start with a `webidl.util.markAsUncloneable is not a function` error**
This is a known `jsdom@30` / `undici@8` incompatibility with some Node 20.x builds. This repository
pins `jsdom` to the `^29` line specifically to avoid it (see `01-engineering-foundation.md` §8 and
`05-dependency-baseline.md`). If you see this error, check that `pnpm-lock.yaml` actually resolved
`jsdom` to a `29.x` version (`pnpm list jsdom`) and re-run `pnpm install` if not.

**A test importing the server Supabase client throws "This module cannot be imported from a Client
Component module"**
This is the `server-only` package's conditional-exports guard, not a bug — see
`01-engineering-foundation.md` §8. Any new test that imports `@/lib/supabase/server` needs
`vi.mock("server-only", () => ({}))` at the top, following the existing pattern in
`src/lib/supabase/server.test.ts`.

**`getClientEnv()` throws "Invalid or missing Supabase public environment configuration"**
This is expected and intentional when `.env.local` isn't set up — it only happens when code actually
tries to create a Supabase client (browser or server), never from unrelated pages, tests, or the
production build. Follow §3 above to resolve it, or ignore it entirely if you're not working on
anything Supabase-related yet.

**Supabase CLI commands (`pnpm exec supabase ...`) mention Docker**
Only `supabase start` (running the full local stack) needs Docker. `supabase init` (already run — see
`supabase/config.toml`) does not, and nothing in this phase requires the local stack to be running.
