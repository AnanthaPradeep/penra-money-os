# 04 — MVP Scope

## 1. Exact MVP Definition

The **Personal MVP** is the feature set required for the product owner to run their entire personal
financial life (accounts, transactions, expenses, credit cards, subscriptions, core investments, and
net worth) inside PENRA Money OS as their sole source of truth, single-user, on Supabase, with no
automated payments, no trade execution, and no bank credential storage.

The Personal MVP is delivered **incrementally across Roadmap Phases 1–14** (see
`10-product-roadmap.md`); "MVP complete" is synonymous with the exit criteria of **Phase 14: Personal
production release**. It is not a single sprint — it is the cumulative feature set at the end of that
phase sequence.

The MVP is intentionally narrower than the full feature inventory in `03-feature-inventory.md`. Every
row marked **MVP = Yes** or **MVP = Partial** in that inventory is in scope; every row marked **MVP =
No** is out of scope for this release, regardless of how valuable it may sound.

## 2. In-Scope Features (Summary)

- **Accounts**: bank, cash, wallet, credit card, and basic loan/liability accounts; manual opening
  balances; account status; last-four-digit identifiers.
- **Transactions**: income, expense, transfer, refund, reimbursement, fee, interest, dividend; manual
  entry; editing with full audit history; CSV import with duplicate detection; categorisation; tags and
  notes; search and filters.
- **Expenses**: categories/subcategories, monthly budgets, monthly and FY-aligned annual reports,
  merchant tracking, recurring-expense detection, unusual-expense flags, savings-rate calculation.
- **Income**: recording, categorisation, multiple streams, trend reporting.
- **Credit cards**: limit, statement date, due date, total/minimum due, available credit, utilisation,
  annual-fee reminder, EMI tracking — metadata only (name, issuer, last four digits).
- **Subscriptions**: name, amount, frequency, next renewal, trial expiry, payment account, status,
  monthly/annual cost aggregation.
- **Investments (manual tracking only)**: Indian stocks, mutual funds, PPF, FD, RD — buy/sell,
  contributions, withdrawals, units/quantity, average cost, invested amount, current value, realised
  and unrealised gain/loss, XIRR where applicable, asset allocation, valuation date and source.
- **Net worth**: assets, liabilities, current net worth, net-worth history/snapshots, liquid vs
  non-liquid split, investment allocation, month-over-month change, manual asset valuation (including a
  generic manual Asset/Liability entry for gold, property, EPF, NPS, bonds, and investment-linked
  insurance cash value — see §3).
- **Dashboard**: current net worth, total assets, total liabilities, available cash, monthly
  income/expense, savings rate, credit-card outstanding, investment value, upcoming bills/subscriptions,
  FD/RD/PPF reminders, important financial alerts.
- **Alerts**: upcoming bills/EMIs, credit card due dates, subscription renewals/trials, FD/RD/PPF
  maturity, budget thresholds, unusual transactions.
- **Documents**: statement/document upload for import, with document-to-import-batch linkage.

## 3. Deliberate Scope Boundary: Generic Manual Assets/Liabilities

Gold, real estate, EPF, NPS, bonds, and investment-linked insurance are **not** built as dedicated
tracked modules (with lot-level transactions, live pricing, or XIRR) in the MVP. They are representable
in net worth only through the **generic manual Asset / Liability entity** — a single current value plus
an effective date, entered and updated by hand. This keeps net worth reasonably complete for a real
Indian personal user without expanding the MVP's engineering surface to six additional dedicated asset
modules. Dedicated modules for these asset classes are explicitly future work (see
`03-feature-inventory.md` §§13–18 and `11-open-decisions-and-risks.md`).

## 4. Out-of-Scope Features (Summary)

Everything marked **MVP = No** in `03-feature-inventory.md`, including but not limited to:

- Dedicated EPF, NPS, bond, gold, property, and insurance modules
- PDF statement parsing (CSV import only in MVP; PDF is a documented Should for a later phase)
- Goals module
- Tax support (capital gains summaries, tax-saving tagging, filing)
- Market research, company research, and AI insights features
- Family finance / multi-user / household portfolios
- Public SaaS capabilities (multi-tenancy, billing, admin dashboard)
- Broker API integrations and automated market-data feeds (manual entry/override is the MVP mechanism)
- Account Aggregator integration
- Mobile push notifications (the mobile app itself is post-MVP; see roadmap Phase 15+ note)
- Anything in the explicit non-goals list (§6)

## 5. Must-Have Requirements

1. A user can create bank, cash, wallet, credit card, and basic loan accounts with a manual opening
   balance.
2. A user can manually record income, expense, and transfer transactions; transfers never appear as
   income or expense in any report.
3. A user can import a CSV bank/card statement, with duplicate transactions flagged before import
   completes.
4. Every transaction edit produces a visible audit history entry; no edit is silent.
5. A user can categorise transactions and see monthly and FY-aligned annual expense reports.
6. A user can track a credit card's limit, statement date, due date, total/minimum due, and see
   computed available credit and utilisation.
7. A user can track subscriptions and see aggregated monthly/annual subscription cost.
8. A user can manually record stock, mutual fund, PPF, FD, and RD transactions and see computed
   holdings: quantity/units, average cost, invested amount, current value, realised/unrealised
   gain/loss, and XIRR where applicable.
9. Every valuation (market price, NAV, manual asset value) carries an effective date and a recorded
   source.
10. A user can see current net worth and a net-worth history trend, computed from real account and
    holding data — never a manually typed net-worth number.
11. A dashboard surfaces net worth, cash, income/expense, savings rate, credit card outstanding,
    investment value, and upcoming bills/subscriptions/maturities in one view.
12. No CVV, PIN, OTP, net-banking password, UPI PIN, or full card number is ever collected or stored,
    anywhere in the system.
13. All monetary values use fixed-point decimal arithmetic; no monetary value is ever stored or
    calculated as a binary floating-point number.
14. All imported transactions retain a reference to their source file and import batch.

## 6. Should-Have Requirements

- Merchant tracking, recurring-expense detection, and unusual-expense flags.
- Annual fee and EMI tracking on credit cards.
- Trial-expiry tracking for subscriptions.
- Scheduled AMFI NAV import (vs. manual-only NAV entry) once Phase 9/10 infrastructure exists.
- Alerts delivered in-app for bills, due dates, renewals, and maturities (email/push is a Could, not a
  Should, for MVP).
- Liquid vs non-liquid asset split and month-over-month net worth change on the dashboard.

## 7. Could-Have Requirements

- PDF statement import (parsing).
- Split transactions across multiple categories.
- Card rewards/cashback tracking.
- Envelope/rollover budgeting styles.
- Basic goal definition and progress tracking, if time permits after core MVP requirements are stable —
  explicitly not required for MVP completion.

## 8. Won't-Have-Now Requirements

- Anything requiring a second user, shared access, or role-based permissions.
- Anything requiring a broker, AA, or bank API integration.
- Any AI-generated insight, research, or natural-language Q&A feature.
- Any billing, subscription-plan, or admin/support tooling.
- Any tax filing, capital-gains-for-filing, or credit-scoring feature.
- Any dedicated EPF/NPS/bond/gold/property/insurance module beyond the generic manual asset entry.

## 9. MVP User Journeys

1. **Onboarding a financial picture**: user creates their bank, cash, wallet, and credit card accounts
   with opening balances; adds their PPF, an FD, and their brokerage/MF holdings as opening positions;
   sees an initial net-worth number.
2. **Monthly reconciliation**: user imports the month's bank and credit card CSV statements; resolves
   flagged duplicates; categorises new transactions; reviews the monthly expense report and savings
   rate; checks the dashboard for anything requiring attention.
3. **Credit card cycle**: user's card statement date passes; user enters the statement's total due,
   minimum due, and due date; dashboard/alerts surface the upcoming due date; user marks it paid via a
   transaction/transfer, and utilisation updates automatically.
4. **Investment update**: user records a new SIP purchase or a stock buy/sell; average cost, invested
   amount, and current value update; user checks unrealised gain/loss and XIRR for that holding.
5. **Subscription review**: user reviews the subscriptions list, sees an upcoming renewal flagged,
   decides to cancel one, and updates its status to cancelled.
6. **Net worth check-in**: user opens the dashboard at any time and sees current net worth, its
   month-over-month change, and a breakdown of liquid vs non-liquid assets.
7. **Correcting a mistake**: user notices a mis-categorised or duplicate transaction, edits/deletes it,
   and can see the audit trail showing what changed and when.

## 10. MVP Success Metrics

Since this is a single, non-commercial, personal-use release, success is measured qualitatively and
behaviourally rather than by growth/revenue metrics:

- The product owner stops using any prior spreadsheet or app for net worth and cash-flow tracking.
- Zero instances of the app's reported net worth or account balance being wrong without an identifiable,
  traceable cause (import error, un-entered transaction, etc. — all traceable, none "mysterious").
- Every credit card due date and every FD/RD/PPF maturity in the relevant period is surfaced by the app
  before it happens, at least once, without being missed.
- A full month's bank/card CSV statements can be imported and reconciled in a single sitting without
  needing to hand-edit more than a small minority of transactions.
- No monetary calculation (average cost, gain/loss, XIRR, utilisation, net worth) is ever found to
  diverge from an independent manual check.

## 11. MVP Release Acceptance Criteria

The Personal MVP (end of Roadmap Phase 14) is accepted as complete when:

1. All Must-Have requirements (§5) are implemented and verified.
2. A full financial-year cycle (or a representative multi-month test period) has been run through the
   system covering: account creation, manual entry, CSV import, categorisation, budgeting, credit-card
   cycle tracking, subscription tracking, and investment transactions across all five MVP investment
   types.
3. Net worth, XIRR, utilisation, and gain/loss figures have been independently spot-checked against
   manual calculation for at least one representative case each.
4. No sensitive-data prohibition (§ Non-Goals, `08-security-privacy-and-compliance.md`) has been
   violated anywhere in the implementation.
5. Backup/recovery and audit-history mechanisms (per `08-security-privacy-and-compliance.md`) are in
   place and verified before the product owner relies on the system as sole source of truth.

## 12. Explicit Phase 0 / MVP Non-Goals

The following are permanent product boundaries for the current scope, not merely deferred features.
They apply to both Phase 0 and the entire Personal MVP:

- Direct bank login
- Bank website scraping
- Storing banking passwords
- Reading OTPs
- Automatic payment initiation
- Stock or mutual-fund order placement
- Algorithmic trading
- Public personalised buy/sell recommendations
- Tax filing
- Loan underwriting
- Credit scoring
- Account Aggregator production integration
- Family accounts
- Multi-user collaboration
- Admin dashboard
- Paid subscriptions
- Cryptocurrency trading
- Fully autonomous AI financial decisions

Future versions may reconsider some of these only after dedicated security, legal, and regulatory
review — not as a default assumption of this document set.

## 13. Scope-Creep Guardrails

- Any feature not listed as MVP = Yes/Partial in `03-feature-inventory.md` requires an explicit,
  documented scope decision (updating both that inventory and this document) before it is built —
  it cannot be added silently during implementation phases.
- "It would be easy to also add X while I'm in this code" is not sufficient justification to expand
  MVP scope; X goes into the feature inventory as a future item instead.
- If a Should/Could requirement threatens the delivery of a Must requirement, the Must requirement wins
  and the Should/Could item is deferred, not compressed.
