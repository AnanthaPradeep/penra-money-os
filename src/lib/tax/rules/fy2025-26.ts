import { Decimal } from "@/lib/money/decimal";
import type { TaxRuleSet } from "@/lib/tax/rules/types";

/**
 * FY 2025-26 (AY 2026-27), individual resident, non-business/profession.
 *
 * The Union Budget 2025 (1 February 2025) substantially revised the new
 * regime's slabs and rebate threshold, raising the effective nil-tax
 * point to ₹12,00,000 of taxable ordinary income (₹12,75,000 for salaried
 * taxpayers after the standard deduction) via a larger section 87A
 * rebate. The old regime's slabs and 80C/80D-style deductions are
 * unchanged from FY 2024-25. Capital-gains rates for listed equity/
 * equity-oriented mutual funds carry the single 12.5%/20% (LTCG/STCG)
 * rate for the whole year — unlike FY 2024-25, there is no mid-year
 * statutory rate change to represent here.
 */
export const FY_2025_26: TaxRuleSet = {
  financialYearId: "2025-26",
  assessmentYearId: "2026-27",
  ruleSetVersion: "in-individual-2025-26.v1",
  effectiveFrom: "2025-04-01",
  effectiveTo: "2026-03-31",
  taxpayerScope: {
    taxpayerType: "individual",
    residentialStatus: "resident",
    businessOrProfession: false,
    currency: "INR",
  },
  regimes: {
    old: {
      slabs: [
        {
          from: new Decimal(0),
          to: new Decimal(250000),
          ratePercent: new Decimal(0),
        },
        {
          from: new Decimal(250000),
          to: new Decimal(500000),
          ratePercent: new Decimal(5),
        },
        {
          from: new Decimal(500000),
          to: new Decimal(1000000),
          ratePercent: new Decimal(20),
        },
        { from: new Decimal(1000000), to: null, ratePercent: new Decimal(30) },
      ],
      rebate: {
        thresholdIncome: new Decimal(500000),
        maxRebateAmount: new Decimal(12500),
        section: "87A",
      },
      standardDeduction: new Decimal(50000),
      cessPercent: new Decimal(4),
      surchargeSupportedUpToIncome: new Decimal(5000000),
      deductionSectionsAllowed: [
        "80C",
        "80D",
        "80E",
        "80G",
        "80TTA",
        "80TTB",
        "24b",
        "HRA",
      ],
    },
    new: {
      slabs: [
        {
          from: new Decimal(0),
          to: new Decimal(400000),
          ratePercent: new Decimal(0),
        },
        {
          from: new Decimal(400000),
          to: new Decimal(800000),
          ratePercent: new Decimal(5),
        },
        {
          from: new Decimal(800000),
          to: new Decimal(1200000),
          ratePercent: new Decimal(10),
        },
        {
          from: new Decimal(1200000),
          to: new Decimal(1600000),
          ratePercent: new Decimal(15),
        },
        {
          from: new Decimal(1600000),
          to: new Decimal(2000000),
          ratePercent: new Decimal(20),
        },
        {
          from: new Decimal(2000000),
          to: new Decimal(2400000),
          ratePercent: new Decimal(25),
        },
        { from: new Decimal(2400000), to: null, ratePercent: new Decimal(30) },
      ],
      rebate: {
        thresholdIncome: new Decimal(1200000),
        maxRebateAmount: new Decimal(60000),
        section: "87A",
      },
      standardDeduction: new Decimal(75000),
      cessPercent: new Decimal(4),
      surchargeSupportedUpToIncome: new Decimal(5000000),
      deductionSectionsAllowed: ["80CCD(2)"],
    },
  },
  capitalGains: {
    holdingPeriodThresholds: [
      { assetClass: "listed_equity", longTermThresholdMonths: 12 },
      {
        assetClass: "equity_oriented_mutual_fund",
        longTermThresholdMonths: 12,
      },
    ],
    rates: [
      {
        assetClass: "listed_equity",
        term: "long_term",
        ratePercent: new Decimal(12.5),
        exemptionAmount: new Decimal(125000),
        effectiveFrom: "2025-04-01",
        effectiveTo: null,
      },
      {
        assetClass: "listed_equity",
        term: "short_term",
        ratePercent: new Decimal(20),
        exemptionAmount: null,
        effectiveFrom: "2025-04-01",
        effectiveTo: null,
      },
      {
        assetClass: "equity_oriented_mutual_fund",
        term: "long_term",
        ratePercent: new Decimal(12.5),
        exemptionAmount: new Decimal(125000),
        effectiveFrom: "2025-04-01",
        effectiveTo: null,
      },
      {
        assetClass: "equity_oriented_mutual_fund",
        term: "short_term",
        ratePercent: new Decimal(20),
        exemptionAmount: null,
        effectiveFrom: "2025-04-01",
        effectiveTo: null,
      },
    ],
    grandfatheringSupported: false,
    indexationSupported: false,
  },
  deductionCatalog: [
    {
      section: "80C",
      label: "Section 80C (PPF, ELSS, life insurance, etc.)",
      maxAmount: new Decimal(150000),
      regimes: ["old"],
    },
    {
      section: "80D",
      label: "Section 80D (health insurance premium)",
      maxAmount: new Decimal(25000),
      regimes: ["old"],
    },
    {
      section: "80E",
      label: "Section 80E (education loan interest)",
      maxAmount: null,
      regimes: ["old"],
    },
    {
      section: "80G",
      label: "Section 80G (donations)",
      maxAmount: null,
      regimes: ["old"],
    },
    {
      section: "80TTA",
      label: "Section 80TTA (savings account interest)",
      maxAmount: new Decimal(10000),
      regimes: ["old"],
    },
    {
      section: "80TTB",
      label: "Section 80TTB (senior-citizen interest income)",
      maxAmount: new Decimal(50000),
      regimes: ["old"],
    },
    {
      section: "24b",
      label: "Section 24(b) (home loan interest — self-occupied)",
      maxAmount: new Decimal(200000),
      regimes: ["old"],
    },
    {
      section: "80CCD(2)",
      label: "Section 80CCD(2) (employer NPS contribution)",
      maxAmount: null,
      regimes: ["old", "new"],
    },
  ],
  source: {
    title:
      "Union Budget 2025 — Finance Act, 2025, individual income-tax provisions for AY 2026-27",
    url: "https://incometaxindia.gov.in/pages/acts/finance-acts.aspx",
    publishedDate: "2025-02-01",
  },
};
