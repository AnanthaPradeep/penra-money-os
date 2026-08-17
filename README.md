# PENRA Money OS

Your private personal money operating system.

PENRA Money OS is a private, single-user-first Personal Money Operating System for India — not just an
expense tracker. See `docs/phase-0/01-product-vision.md` for the full product vision.

## Current Phase

**Phase 1 — Repository, Next.js, Quality Tooling and Supabase Foundation.**

This phase is an **engineering foundation only**. There is no authentication, no database table, no
finance feature, and no final visual design yet. See `docs/phase-1/00-phase-1-overview.md` for exact
scope, and `docs/phase-1/PHASE_1_SUMMARY.md` for a complete handoff summary.

## Technology Foundation

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript, Turbopack)
- [Tailwind CSS](https://tailwindcss.com) 4
- [Supabase](https://supabase.com) (`@supabase/supabase-js` + `@supabase/ssr`) — client/CLI foundation
  only, no queries or auth flows yet
- [Zod](https://zod.dev) for environment-variable validation
- [Vitest](https://vitest.dev) + [React Testing Library](https://testing-library.com/react) for testing
- ESLint + Prettier for code quality
- pnpm as the package manager

See `docs/phase-1/01-engineering-foundation.md` for exact versions and reasoning.

## Local Setup

```bash
pnpm install
cp .env.example .env.local   # optional for Phase 1 — see docs/phase-1/02-local-development.md
pnpm dev
```

Full instructions, including troubleshooting: `docs/phase-1/02-local-development.md`.

## Environment Variables

Two public values only (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Neither is required to run, test, or build this phase of the application. Full detail on what these are
and are not used for: `docs/phase-1/03-supabase-foundation.md`.

## Available Scripts

| Script                              | Purpose                                         |
| ----------------------------------- | ----------------------------------------------- |
| `pnpm dev`                          | Start the development server                    |
| `pnpm build`                        | Production build                                |
| `pnpm start`                        | Run the production build                        |
| `pnpm lint` / `pnpm lint:fix`       | Lint / lint with autofix                        |
| `pnpm typecheck`                    | TypeScript type checking                        |
| `pnpm format` / `pnpm format:check` | Format / verify formatting                      |
| `pnpm test` / `pnpm test:watch`     | Run tests once / in watch mode                  |
| `pnpm check`                        | Combined format:check + lint + typecheck + test |

## Documentation

- `docs/phase-0/` — product foundation (vision, MVP scope, domain rules, data model, architecture
  decisions, roadmap). Start with `docs/phase-0/PHASE_0_SUMMARY.md`.
- `docs/phase-1/` — this phase's engineering foundation. Start with
  `docs/phase-1/PHASE_1_SUMMARY.md`.

## Current Limitations

This is a Phase 1 engineering foundation. It intentionally does **not** yet include: authentication of
any kind, database tables or migrations, Row Level Security policies, bank accounts, transactions,
budgets, subscriptions, investments, a dashboard, AI features, or a final design system. See
`docs/phase-1/00-phase-1-overview.md` §3 for the complete non-goals list.

## Security Warning

**Never commit real credentials.** `.env.local` is git-ignored — always copy `.env.example` to
`.env.local` for real values, never edit `.env.example` itself. Only the two `NEXT_PUBLIC_*` values
above ever belong in this project; a Supabase secret/service-role key, CVV, PIN, OTP, or any banking
credential must never be stored in this repository, in an environment file, or in any client-visible
code, at any phase. See `docs/phase-0/08-security-privacy-and-compliance.md` for the full security and
privacy policy.
