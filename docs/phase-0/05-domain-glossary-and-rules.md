# 05 — Domain Glossary and Rules

This document is the **single authoritative source** for financial-domain terminology, formulas, and
calculation rules. Every other document, and every future implementation, must use these definitions —
they are not redefined elsewhere.

## 1. Glossary

### Account
A container that holds money or debt and has a running balance derived from its transactions plus a
manual opening balance. Types in MVP: bank, cash, wallet, credit card, loan. An account belongs to
exactly one user (see `06-conceptual-data-model.md`).

### Asset
Anything of positive monetary value owned by the user. Two forms: (1) an **Account** with a positive
balance or a **Holding** with positive market value (both computed from transactions), or (2) a generic
manually-entered **Asset** record (a single current value + effective date) for asset classes without a
dedicated module (gold, property, EPF, NPS, bonds, investment-linked insurance in MVP).

### Liability
Anything of negative monetary value owed by the user: a loan/credit-card **Account** with an outstanding
balance, or a generic manually-entered **Liability** record for informal/unmodelled debts.

### Net Worth
`Net Worth = Σ(Asset values) − Σ(Liability values)`, computed as of a specific valuation timestamp (see
"Valuation Snapshot" below). Never a manually typed number — always derived.

### Income
A transaction that increases the user's total wealth from a source external to their own accounts
(salary, interest, dividend, refund treated as income-equivalent, etc.). See "Transfer" for the explicit
exclusion.

### Expense
A transaction that decreases the user's total wealth to a destination external to their own accounts.

### Transfer
A movement of money between two accounts **both owned by the same user**. A transfer is never counted as
income or expense in any report, budget, or savings-rate calculation (Product Principle 14). Structurally,
a transfer is represented as two linked ledger entries (a debit on the source account, a credit on the
destination account) sharing a transfer identifier, both explicitly tagged `type = transfer`.

### Refund
Money returned to the user for a previously recorded expense, reducing that expense's net effect for
reporting purposes without deleting the original expense record. Linked to the original expense
transaction where possible.

### Reimbursement
Money received from a third party (e.g., an employer) that offsets a previously recorded expense the
user paid personally. Distinct from Refund in source (a third party, not the original merchant) but
treated identically for net-spend reporting: it offsets, it does not count as unrelated income.

### Investment Transaction
An atomic, immutable record of a single investment event: buy, sell, contribution, withdrawal,
dividend/interest received, or a corporate action. The source of truth for all investment figures;
holdings are always derived from the sum of investment transactions, never entered directly.

### Holding
A **derived, point-in-time aggregation** of an instrument's position within an account: quantity/units
held, average cost, invested amount, and (combined with a Market Price) current value and unrealised
gain/loss. Recomputed from Investment Transactions, not independently editable.

### Position
Synonym for Holding in this document set — the current state of an instrument within an account.

### Quantity
The number of shares (stocks) or units (mutual funds) held. Stored with sufficient decimal precision to
represent fractional mutual-fund units (see §3).

### Units
Synonym for Quantity, used specifically for mutual funds, PPF-equivalent, and similar instruments priced
per-unit.

### Cost Basis
The total amount paid to acquire the units/quantity currently held, in INR, using the costing method
defined in §4.

### Average Cost
`Average Cost per unit = Cost Basis ÷ Quantity Held`. Recalculated after every buy using the weighted
average method (see §4); a sell does not change average cost, only reduces quantity and proportionally
reduces cost basis.

### Market Value
`Market Value = Quantity Held × Latest Known Price (or NAV)`, as of the price's own effective date — not
necessarily "now." Every market value must be paired with the price's effective date (Product Principle
11).

### Realised Gain/Loss
For a sell (or withdrawal) event: `Realised Gain/Loss = Sale Proceeds − Cost Basis of Units Sold` (cost
basis computed per §4's costing method), net of any transaction fees recorded against that event.

### Unrealised Gain/Loss
For currently-held units: `Unrealised Gain/Loss = Market Value − Cost Basis of Units Held`, as of the
market value's effective date.

### NAV (Net Asset Value)
The official per-unit price of a mutual fund scheme on a given date, sourced from AMFI (see
`07-data-source-strategy.md`). Always stored with its effective date; a mutual fund holding's current
value is always `Units × NAV as of the NAV's own date`, never an assumed "today."

### CAGR (Compound Annual Growth Rate)
`CAGR = (Ending Value / Beginning Value)^(1 / Years) − 1`, used for single lump-sum, non-interrupted
growth periods. Not used where cash flows occur at multiple points in time — XIRR is used instead (see
next).

### XIRR (Extended Internal Rate of Return)
The annualised rate of return `r` that satisfies:

```
Σ [ CFi / (1 + r)^((di − d0) / 365) ] = 0
```

where `CFi` is each cash flow (negative for money invested/outflow, positive for money received/
inflow), `di` is that cash flow's date, and `d0` is the date of the first cash flow. For an unrealised
position, the current market value is included as a final synthetic positive cash flow dated at the
valuation date. Solved numerically (e.g., Newton-Raphson with a defined convergence tolerance and
iteration cap, falling back to bisection if it fails to converge) — never approximated by a simpler
formula, since SIP-style investments have irregular, multi-date cash flows.

### Credit Utilisation
`Credit Utilisation = Outstanding Balance ÷ Credit Limit × 100%`, computed as of the latest known
outstanding balance.

### Statement Balance
The total balance reported by the card issuer as of a specific statement date — manually entered in
MVP, always carrying that statement's date as its effective date.

### Total Due
The total amount owed as of the statement date, as reported by the issuer (manually entered in MVP).

### Minimum Due
The minimum payment required by the due date, as reported by the issuer (manually entered in MVP).

### Budget
A user-defined spending limit for a category over a period (MVP: monthly). `Budget Utilisation = Actual
Category Spend (excluding transfers) ÷ Budgeted Amount × 100%` for that period.

### Subscription
A recurring, user-tracked payment obligation with a defined billing frequency, next renewal date, and
lifecycle status (active/paused/cancelled). Not automatically derived from transactions in MVP (manual
setup; auto-detection is a future Could-have, see `03-feature-inventory.md` §7).

### Maturity Value
The value an FD, RD, or PPF instrument reaches at its maturity date. If entered directly from the
institution's certificate, it is authoritative and labelled "confirmed." If computed from principal,
rate, and tenure using the standard compound-interest (FD) or recurring-deposit future-value (RD)
formula, it must be **clearly labelled as a projection, not a guarantee** (Product Principle 7) — actual
maturity value is always subject to the issuing institution's terms.

### Valuation Snapshot
A recorded, timestamped state of net worth (or a component of it) at a specific point in time, used to
build net-worth history. Snapshots are additive/append-only records, not overwritten — they form the
basis of "net-worth history" trend reporting.

## 2. Monetary Precision Rules

- **No monetary value is ever represented, stored, or calculated using binary floating-point types**
  (e.g., IEEE 754 `float`/`double`). This is a permanent, non-negotiable rule (Product Principle 13).
- Monetary amounts are represented as **fixed-point decimal values** — conceptually, an arbitrary-precision
  decimal type (e.g., PostgreSQL `NUMERIC`) or an integer count of the currency's minor unit (paisa),
  consistently chosen at implementation time (Phase 3), never mixed within the same system.
- Every monetary field is paired with an explicit ISO 4217 currency code, even though INR is the only
  currency in current scope — this avoids a future multi-currency migration having to retrofit the field.
- Intermediate calculations (average cost, XIRR inputs, percentage computations) must preserve decimal
  precision through the entire calculation chain, not just at storage and display.

## 3. Rounding Rules

- Rounding to the nearest paisa (2 decimal places) happens **only at the point of display or of
  recording a final, immutable amount** (e.g., a completed transaction) — never mid-calculation.
- The default rounding mode is **round-half-up** for currency display, applied consistently everywhere,
  unless a specific regulatory or institutional convention requires otherwise for a specific calculation
  (documented at the point of use if that ever arises — none identified in MVP scope).
- Quantity/units (e.g., mutual fund units) may require more than 2 decimal places (commonly 3–4 for
  Indian mutual funds) and must not be rounded to whole numbers.
- Percentage figures (utilisation, savings rate, XIRR) are computed at full precision and rounded only
  for display (typically 2 decimal places).

## 4. Investment Costing Method

- The MVP default costing method is **weighted average cost**: each buy/contribution updates a single
  running average cost per unit for that holding; a sell/withdrawal reduces quantity and cost basis
  proportionally at that average, without changing the average cost of remaining units.
- Every Investment Transaction retains its own original **lot-level detail** (date, quantity, price,
  fees) even though the MVP's displayed cost basis uses the weighted-average method. This is a deliberate
  design choice so that a different costing method (FIFO, specific identification) can be computed
  retroactively later — for tax-related reporting, for example — **without re-importing any data**.
- No document in this set asserts a specific statutory tax-costing method (e.g., FIFO for capital
  gains); tax computation is out of MVP scope entirely (see `04-mvp-scope.md` non-goals), and any future
  tax-adjacent feature must be verified against current, cited tax law at the time it is built, not
  assumed from this document.

## 5. Date/Time Rules

- All timestamps are stored in UTC internally and displayed in **Asia/Kolkata** by default.
- Every user-facing "as of" date (transaction date, valuation date, statement date, snapshot date) is a
  **calendar date in the user's locale**, not a bare timestamp, unless the underlying event genuinely has
  intraday significance (e.g., an audit-event timestamp, which is a full timestamp).
- A transaction's date is the date the transaction occurred (or, for imports, the date reported by the
  source statement), which may differ from the date it was entered into the system (`created_at`).

## 6. Financial-Year Rules

- The Indian financial year runs **April 1 to March 31**. Any "annual" report, budget, or aggregation
  labelled as FY-aligned uses this range, not the calendar year, unless explicitly labelled "calendar
  year."
- FY is named by its ending year in this product's convention (e.g., "FY 2026" = April 1, 2025 – March
  31, 2026) — this convention must be applied consistently everywhere FY is displayed, and stated
  explicitly wherever it could be ambiguous to a user.

## 7. Transfer Handling

- A transfer must reference exactly two accounts owned by the same user (the source and destination);
  cross-user transfers are not modelled in the single-user MVP and are out of scope until multi-user
  support exists.
- Transfers are excluded from: income totals, expense totals, category reports, budget-consumption
  calculations, and savings-rate calculations. They are included in: account balance updates and net
  worth (since net worth is unaffected by a transfer between the same user's own assets, and the ledger
  entries correctly move the balance between accounts).
- A transfer's two ledger entries are created and deleted together; editing a transfer edits both sides
  atomically, never one side independently.

## 8. Reversal Handling

- Financial data is never silently overwritten. A correction to a previously recorded transaction is
  either (a) an **edit**, preserving full audit history of the prior value, or (b) a **reversal**: a new,
  linked transaction that offsets the original, when the source system (e.g., a bank) itself issued a
  reversal/chargeback — the original transaction is never deleted in this case, preserving the true
  history of what the bank reported.
- A user-initiated correction of their own data-entry mistake (not a bank-issued reversal) may use a
  direct **edit** with audit history instead of a reversal entry, since no external event needs to be
  represented.

## 9. Duplicate Handling

- Duplicate detection during CSV import compares candidate transactions against existing transactions
  using a combination of account, date, amount, and description/reference similarity within a
  configurable tolerance window.
- Suspected duplicates are **flagged for user review at import time**, never silently discarded or
  silently merged — the user makes the final call (Product Principle 6: no silent financial-data
  changes).
- Once an import batch is committed, its transactions retain a permanent link back to that batch (see
  "Import Batch" in `06-conceptual-data-model.md`), so a later duplicate check against a different
  import can still identify the original source.

## 10. Deleted/Voided Transaction Handling

- Transactions are **soft-deleted** (marked void/deleted with an audit event), not hard-deleted from the
  database, so that historical reports and audit trails remain reconstructible.
- A voided transaction is excluded from all balance, report, and net-worth calculations going forward,
  but remains queryable in the audit history for transparency.
- Hard deletion (physical removal of a row) is reserved for explicit user-initiated data-deletion
  requests under privacy rights (see `08-security-privacy-and-compliance.md`), not for routine
  corrections.

## 11. Investment Valuation Rules

- Every Holding's current value is only ever computed using the **latest available Market Price / NAV
  that has an effective date on or before "now"** — never an extrapolated or assumed price.
- If no price is available for an instrument (feed gap, unlisted instrument, manual-only asset), the
  system falls back to the **last known price**, and the UI must clearly indicate the value is **stale**
  along with that price's effective date (see §12).
- A manually entered price/valuation always overrides an automated feed value for that same date if the
  user explicitly provides one — the user's correction takes precedence (Product Principle 4: user
  control before automatic modification).

## 12. Missing-Market-Data Behaviour

- Missing price/NAV data is never silently treated as zero or as "no change" without indication — the
  UI/report must distinguish "no data available" from "value is genuinely unchanged."
- When market data is missing for a required valuation (e.g., a net-worth snapshot on a date with no
  price feed), the system uses the most recent prior available price and labels the resulting valuation
  as based on stale data, including how stale (the gap in days) where feasible.
- Scheduled price/NAV update jobs (Phase 10+) must log failures explicitly (see audit/observability
  requirements in `08-security-privacy-and-compliance.md`) rather than failing silently.
