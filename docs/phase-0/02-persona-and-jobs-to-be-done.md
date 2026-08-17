# 02 — Persona and Jobs to Be Done

## 1. Initial Persona (MVP): The Single Indian Personal User

**Name (archetype):** "The Disciplined Tracker"
**Context:** A financially engaged individual in India, managing their own money across multiple
banks, at least one credit card, some investments, and a handful of recurring subscriptions. This
persona is modelled directly on the product's first real user (the product owner) — it is not a
market-research persona, and is explicitly the *only* persona in scope for the MVP.

### 1.1 Current Pain Points

- Financial picture is spread across 3–6+ apps (multiple bank apps, a UPI app, a broker app, an MF
  app, a PPF passbook or bank net-banking screen, a card app per issuer).
- No single number for "net worth" exists anywhere; if it does, it's a manually maintained spreadsheet
  that goes stale.
- Credit card due dates, minimum-due vs total-due, and utilisation are tracked from memory or
  reconstructed from SMS/email alerts.
- Subscriptions silently renew; the first sign of an unwanted renewal is a bank/card debit.
- CSV/PDF statements exist but require manual re-entry or ad-hoc spreadsheet work to become usable.
- No trustworthy way to see "how much did I actually spend this month, excluding money I just moved
  between my own accounts."
- Investment cost basis and returns (especially for mutual fund SIPs with many small purchases) are
  hard to compute correctly by hand.
- No visibility into recurring or unusual expenses without manually reviewing statements line by line.
- Existing budgeting apps that link bank accounts require handing over banking credentials — a trust
  barrier this persona is not willing to cross.

### 1.2 Financial Accounts and Assets This Persona May Manage

- Two or more savings/salary bank accounts
- A cash "wallet" (physical cash, tracked informally)
- One or more UPI/digital wallet balances
- One or more credit cards
- A personal loan or EMI (e.g., a consumer durable loan, a two-wheeler/car loan)
- Direct equity holdings (Indian stocks via a broker)
- Mutual fund SIPs and lump-sum investments
- A PPF account
- One or more bank Fixed Deposits
- One or more Recurring Deposits
- An EPF account (via employer)
- Possibly an NPS account
- Possibly gold (jewellery or digital gold) and/or a property
- Term or endowment insurance policies
- Recurring subscriptions (OTT, SaaS tools, cloud storage, etc.)

Note: not every account/asset type above is in the MVP build (see `04-mvp-scope.md`); this list
describes what the *persona* realistically holds, which is broader than what v1 of the product tracks.

### 1.3 Primary Jobs to Be Done

Using the "when [situation], I want to [motivation], so I can [outcome]" framing:

1. When I get paid or spend money, I want to record or import the transaction accurately, so I can
   trust my running account balances.
2. When the month ends, I want to see exactly what I spent, by category, excluding transfers between my
   own accounts, so I can understand my real spending behaviour.
3. When I check the app at any time, I want to see my current net worth across everything I own and
   owe, so I know where I stand financially right now.
4. When a credit card statement is generated, I want to see total due, minimum due, due date, and
   utilisation clearly, so I never miss a payment or carry unplanned interest.
5. When I hold stocks or mutual funds, I want to see my invested amount, current value, and gain/loss
   (realised and unrealised), so I understand my investment performance without doing the math myself.
6. When a subscription is about to renew, I want to be reminded in advance, so I can cancel it if I no
   longer want it.
7. When I import a bank/card statement, I want duplicates to be detected and categorisation to be
   suggested, so importing months of history isn't tedious or error-prone.
8. When something in my data looks wrong, I want to inspect and correct it myself, and see a history of
   what changed, so I never have to blindly trust the app.

### 1.4 Secondary Jobs to Be Done

1. When I'm reviewing my finances periodically, I want to see recurring-expense detection and
   unusual-expense flags, so I notice problems (price increases, forgotten subscriptions, anomalies)
   without manually auditing every line.
2. When I'm planning, I want to see my savings rate over time, so I know if my financial habits are
   improving.
3. When I hold a Fixed Deposit or Recurring Deposit, I want to see maturity value and maturity date, so
   I can plan around it.
4. When I'm curious about a company I hold or am researching, I want explainable, source-traceable
   information (not a generic "buy/sell" signal), so I can form my own view.
5. When I set a financial goal, I want to track progress toward it using real account/investment data,
   so the goal stays grounded in reality rather than being a static number I forget about.
6. When I look at my portfolio, I want to see asset allocation across asset classes, so I understand my
   diversification.

### 1.5 Emotional Needs

- **Control**: the feeling that the app reflects reality exactly as the user understands it — never
  "smarter than me" in a way that overrides their judgement.
- **Confidence**: numbers that don't need to be double-checked against a bank app or a spreadsheet
  before being trusted.
- **Calm**: no anxiety-inducing dark patterns (no gamified spending pressure, no shame-based budgeting
  language, no manufactured urgency).
- **Ownership**: this is *their* financial life in *their* private system, not a product mining their
  data for someone else's benefit.
- **Relief from mental load**: not having to remember due dates, renewal dates, or manually compute
  investment returns.

### 1.6 Trust Expectations

- The app will never ask for net-banking passwords, UPI PINs, card PINs, OTPs, or CVVs.
- The app will never silently change a transaction, balance, or categorisation without the change being
  visible and attributable.
- Imported data always shows where it came from (which file, which import batch, which date).
- AI-generated insight always shows the data it was derived from, and never gives a directive
  ("buy this," "sell that") framed as personalised advice.
- Nothing is shared with a third party without the user explicitly initiating that connection.

### 1.7 Privacy Expectations

- All financial data is private to the single user by default; there is no "public profile" or social
  feature in scope.
- No financial data is used for advertising, resale, or any purpose the user did not initiate.
- Data export and (eventually) deletion are always available to the user, never require support-ticket
  negotiation.
- Any future AI processing minimises what is sent to a third-party AI provider and never sends raw
  sensitive identifiers unnecessarily (see `08-security-privacy-and-compliance.md`).

### 1.8 Usage Patterns

| Cadence | Typical activity |
|---|---|
| **Daily** | Quick check of account balances and recent transactions; occasional manual entry of a cash expense. |
| **Weekly** | Review and categorise/tag new transactions; check upcoming bills/subscription renewals; glance at dashboard. |
| **Monthly** | Import bank/card statements; reconcile the month's spending against budget; review credit card statement (due date, total/minimum due); review subscription costs; check savings rate. |
| **Annually** | Review full-year income/expense report aligned to the Indian financial year (April–March); review investment performance (XIRR, realised/unrealised gains) for the year; review net worth trend for the year; review FD/RD maturities and renewals; review insurance and EPF/PPF statements. |

## 2. Future Public Personas (Out of MVP Scope)

The following personas are recorded for direction only. They are explicitly **out of scope** for the
personal MVP and must not influence MVP feature decisions in `04-mvp-scope.md`. They exist to sanity-check
that current architecture choices don't foreclose serving them later.

> **Out of MVP scope — future public product only.**

- **The Household/Family Planner**: wants shared visibility into a family's combined net worth and
  expenses, with controlled per-member access — requires multi-user and family-portfolio features not
  built until Phase 15+ (see `10-product-roadmap.md`).
- **The New Investor**: a public-product user with minimal holdings, primarily interested in
  explainable market/company research and portfolio-allocation education — requires public SaaS,
  broker integration, and stronger regulatory-boundary tooling before this persona can be served safely.
- **The Small Business Owner / Freelancer**: wants to separate personal and business cash flow — out of
  scope entirely for the current product definition; not assumed anywhere in this document set.
- **The NRI or Multi-Currency User**: needs multi-currency support beyond INR — explicitly out of scope;
  base currency is INR only for the foreseeable roadmap (see `00-phase-0-overview.md` fixed assumptions).

These personas are not designed for in Phase 0 beyond this acknowledgement. They should be revisited
only as part of the Phase 15 public-product discovery work.
