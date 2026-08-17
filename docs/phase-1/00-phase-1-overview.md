# 00 — Phase 1 Overview

**Phase:** Phase 1 — Repository, Next.js, Quality Tooling and Supabase Foundation
**Product:** PENRA Money OS
**Depends on:** `docs/phase-0/` (product foundation, already complete — see
`docs/phase-0/PHASE_0_SUMMARY.md`)

## 1. Objective

Establish a stable, production-minded engineering foundation for PENRA Money OS: a Next.js App Router
application in TypeScript, responsive/PWA-ready, with a Supabase client and CLI foundation, environment
validation, code-quality tooling, unit/component testing, and CI verification — with clear documentation
so any future AI coding session (Claude in VS Code, GitHub Copilot, or otherwise) can continue the work
without needing this conversation's history.

This phase builds **application scaffolding only**. It does not implement any finance feature, any
authentication flow, any database table, or a final visual design.

## 2. Scope

- Next.js (App Router, TypeScript, `src/` layout, Tailwind CSS, ESLint) project foundation.
- Repository baseline: git initialisation, `.gitignore`, `.editorconfig`, Node version declaration.
- Package scripts for dev, build, lint, typecheck, format, test, and a combined `check`.
- Environment-variable architecture: `.env.example`, a typed (Zod) validation module, safe failure
  behaviour.
- Supabase dependency foundation: browser client, server client, and the Supabase CLI as a
  devDependency — no queries, no auth flows, no tables.
- Supabase CLI local configuration (`supabase/config.toml`) — no migrations, no seed data, no Docker
  requirement for normal frontend work.
- A minimal, accessible foundation page stating what PENRA Money OS is and that finance features are
  not yet enabled.
- Vitest + React Testing Library testing foundation with meaningful tests (not snapshot-only).
- A GitHub Actions CI workflow running format, lint, typecheck, test, and build.
- Phase 1 documentation set (this directory) and an updated root `README.md`.

## 3. Non-Goals

Everything below is explicitly **not** built in Phase 1 — see the root `README.md` and
`docs/phase-0/04-mvp-scope.md` for where each eventually belongs:

- Email/OAuth signup, login, or password reset
- Session refresh, protected routes, or a `proxy.ts` file (Phase 2 — see
  `03-supabase-foundation.md` §7)
- User profile tables, finance database tables, or any migration for financial entities
- Row Level Security policies (nothing to secure yet — no tables exist)
- Bank accounts, transactions, expenses, budgets, subscriptions, investments, market prices, or NAV
  data
- A dashboard, AI integration, market research, or statement/CSV/PDF import
- Supabase Edge Functions, scheduled jobs, or payment processing
- Deployment, final branding, or a final design system

## 4. Inputs from Phase 0

Phase 0 (`docs/phase-0/`) is the authoritative product source and was reviewed in full before this
phase began. Decisions carried forward as binding constraints on the engineering foundation:

- **Single personal user, India-first, INR, Asia/Kolkata, April–March FY** — no domain logic exists yet
  in Phase 1, but nothing built here should make honouring these harder later (`04-mvp-scope.md`,
  `00-phase-0-overview.md`).
- **Supabase (PostgreSQL, Auth, Storage, Edge Functions) as the backend**, with Row Level Security from
  the first real table and a provider-adapter mindset for external services
  (`09-architecture-decisions.md` ADR-01–07).
- **Decimal-safe money handling** is a permanent rule for all future financial calculations
  (`05-domain-glossary-and-rules.md` §2, ADR-13) — no monetary code exists yet in Phase 1, so nothing to
  implement here, but noted so no future phase reaches for floating-point.
- **No bank credential storage, no CVV/PIN/OTP storage, no direct bank scraping**
  (`08-security-privacy-and-compliance.md` §2) — directly shapes the "no secret key, no credential
  capture" rules in this phase's environment/Supabase design.
- **Multi-user-ready architecture, single-user product today** — reflected in choosing RLS-from-day-one
  as a standing Supabase convention (to be applied once real tables exist), not in anything user-facing
  yet.
- **Next.js responsive PWA first, Expo React Native later** (ADR-08–09) — this phase implements the
  Next.js half only.

No Phase 0 document was found to contradict any Phase 1 fixed decision; where Phase 0 was silent on an
implementation detail (e.g., exact npm package versions), this phase's own research (documented in
`01-engineering-foundation.md` and `05-dependency-baseline.md`) fills the gap.

## 5. Deliverables

| #   | Deliverable                                                                                         | Status |
| --- | --------------------------------------------------------------------------------------------------- | ------ |
| 1   | Next.js App Router + TypeScript + Tailwind + ESLint project                                         | Done   |
| 2   | Repository baseline (git, `.gitignore`, `.editorconfig`, `.nvmrc`)                                  | Done   |
| 3   | Package scripts (dev/build/start/lint/lint:fix/typecheck/format/format:check/test/test:watch/check) | Done   |
| 4   | Environment-variable architecture (`.env.example` + Zod validation)                                 | Done   |
| 5   | Supabase browser + server client foundation                                                         | Done   |
| 6   | Supabase CLI local foundation (`supabase/config.toml`)                                              | Done   |
| 7   | Minimal foundation page + metadata                                                                  | Done   |
| 8   | Vitest + React Testing Library foundation with meaningful tests                                     | Done   |
| 9   | GitHub Actions CI workflow                                                                          | Done   |
| 10  | Phase 1 documentation set                                                                           | Done   |
| 11  | Root `README.md`                                                                                    | Done   |

## 6. Definition of Done

- Phase 0 documents were reviewed before implementation began.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all succeed.
- No finance table, authentication UI, or route protection exists anywhere in the repository.
- No prohibited data (CVV/PIN/OTP/passwords/secret keys) appears in any file.
- `.env.local` is git-ignored; `.env.example` contains placeholders only.
- The production build does not contact Supabase and does not require any real credential.
- CI configuration is present and uses only fake, non-sensitive placeholder values.
- All Phase 1 documentation listed in §5 exists and is internally consistent with Phase 0.
- `docs/phase-1/PHASE_1_STATUS.md` and `docs/phase-1/PHASE_1_SUMMARY.md` are complete and current.
- No existing file (from Phase 0 or otherwise) was deleted, reset, or destructively overwritten.
- No commit, push, or pull request was created.

## 7. Acceptance Checklist

- [x] Repository inspected before any change was made; confirmed empty of application code.
- [x] Next.js App Router foundation exists, using TypeScript, `src/`, Tailwind, ESLint, and the `@/*`
      import alias.
- [x] TypeScript strict mode is enabled and `pnpm typecheck` passes with zero errors.
- [x] Tailwind CSS v4 is wired through PostCSS and used on the foundation page.
- [x] Supabase browser and server clients exist, use only `NEXT_PUBLIC_SUPABASE_URL` and
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and contain no queries, auth flows, or route protection.
- [x] The Supabase CLI foundation exists (`supabase/config.toml`); no migration, seed data, or Docker
      dependency was introduced.
- [x] No finance table, authentication page, or protected route exists.
- [x] Environment handling fails clearly and only when something actually needs Supabase — unrelated
      pages, the production build, and all tests work without any real credential.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, and `pnpm build` all pass (see
      `docs/phase-1/04-quality-and-ci.md` for the recorded results).
- [x] A GitHub Actions CI workflow exists, uses least-privilege permissions, fake placeholder values,
      and performs no deployment or automatic commit.
- [x] Full documentation set exists under `docs/phase-1/`, plus an updated root `README.md`.
- [x] `PHASE_1_STATUS.md` was maintained throughout and reflects the final state.
- [x] No secret was committed; `.gitignore` correctly excludes `.env.local` while tracking
      `.env.example`.
- [x] No destructive Git operation was performed; no commit was created (per explicit instruction).
