import { Decimal, type Money } from "@/lib/money/decimal";
import { assertLiteral } from "@/lib/types/literal";
import type {
  DebtPaymentRow,
  DebtPaymentScheduleRow,
  DebtRateHistoryRow,
  DebtRow,
} from "@/lib/debts/types";

export const DEBT_TYPES = [
  "personal_loan",
  "home_loan",
  "vehicle_loan",
  "education_loan",
  "credit_card",
  "borrowed_money",
  "other",
] as const;
export type DebtType = (typeof DEBT_TYPES)[number];

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  personal_loan: "Personal loan",
  home_loan: "Home loan",
  vehicle_loan: "Vehicle loan",
  education_loan: "Education loan",
  credit_card: "Credit card",
  borrowed_money: "Borrowed money",
  other: "Other",
};

export const DEBT_INTEREST_METHODS = [
  "reducing_balance",
  "flat_rate",
  "manual_schedule",
] as const;
export type DebtInterestMethod = (typeof DEBT_INTEREST_METHODS)[number];

export const DEBT_PAYMENT_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
] as const;
export type DebtPaymentFrequency = (typeof DEBT_PAYMENT_FREQUENCIES)[number];

export const DEBT_STATUSES = [
  "draft",
  "active",
  "paused",
  "paid_off",
  "closed",
  "defaulted",
  "archived",
] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

export const DEBT_PAYMENT_TYPES = ["scheduled", "prepayment"] as const;
export type DebtPaymentType = (typeof DEBT_PAYMENT_TYPES)[number];

export const PREPAYMENT_ASSUMPTIONS = [
  "reduce_tenure",
  "reduce_payment",
  "custom",
] as const;
export type PrepaymentAssumption = (typeof PREPAYMENT_ASSUMPTIONS)[number];

export const DEBT_PAYMENT_STATUSES = ["posted", "reversed"] as const;
export type DebtPaymentStatus = (typeof DEBT_PAYMENT_STATUSES)[number];

export type Debt = {
  id: string;
  name: string;
  debtType: DebtType;
  liabilityAccountId: string;
  currency: string;
  originalPrincipal: Money;
  annualInterestRate: Money;
  interestMethod: DebtInterestMethod;
  paymentFrequency: DebtPaymentFrequency;
  startDate: string;
  contractualEndDate: string | null;
  minimumPayment: Money | null;
  dueDay: number | null;
  status: DebtStatus;
  notes: string | null;
  createdAt: string;
};

export function mapDebtRow(row: DebtRow): Debt {
  return {
    id: row.id,
    name: row.name,
    debtType: assertLiteral(row.debt_type, DEBT_TYPES, "debts.debt_type"),
    liabilityAccountId: row.liability_account_id,
    currency: row.currency,
    originalPrincipal: new Decimal(row.original_principal),
    annualInterestRate: new Decimal(row.annual_interest_rate),
    interestMethod: assertLiteral(
      row.interest_method,
      DEBT_INTEREST_METHODS,
      "debts.interest_method",
    ),
    paymentFrequency: assertLiteral(
      row.payment_frequency,
      DEBT_PAYMENT_FREQUENCIES,
      "debts.payment_frequency",
    ),
    startDate: row.start_date,
    contractualEndDate: row.contractual_end_date,
    minimumPayment:
      row.minimum_payment === null ? null : new Decimal(row.minimum_payment),
    dueDay: row.due_day,
    status: assertLiteral(row.status, DEBT_STATUSES, "debts.status"),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export type DebtRateHistoryEntry = {
  id: string;
  debtId: string;
  annualInterestRate: Money;
  effectiveDate: string;
  notes: string | null;
};

export function mapDebtRateHistoryRow(
  row: DebtRateHistoryRow,
): DebtRateHistoryEntry {
  return {
    id: row.id,
    debtId: row.debt_id,
    annualInterestRate: new Decimal(row.annual_interest_rate),
    effectiveDate: row.effective_date,
    notes: row.notes,
  };
}

export type DebtPaymentScheduleRowItem = {
  id: string;
  debtId: string;
  installmentNumber: number;
  dueDate: string;
  openingPrincipal: Money;
  scheduledPayment: Money;
  principalComponent: Money;
  interestComponent: Money;
  feesComponent: Money;
  closingPrincipal: Money;
};

export function mapDebtPaymentScheduleRow(
  row: DebtPaymentScheduleRow,
): DebtPaymentScheduleRowItem {
  return {
    id: row.id,
    debtId: row.debt_id,
    installmentNumber: row.installment_number,
    dueDate: row.due_date,
    openingPrincipal: new Decimal(row.opening_principal),
    scheduledPayment: new Decimal(row.scheduled_payment),
    principalComponent: new Decimal(row.principal_component),
    interestComponent: new Decimal(row.interest_component),
    feesComponent: new Decimal(row.fees_component),
    closingPrincipal: new Decimal(row.closing_principal),
  };
}

export type DebtPayment = {
  id: string;
  debtId: string;
  scheduleRowId: string | null;
  paymentType: DebtPaymentType;
  principalAmount: Money;
  interestAmount: Money;
  feesAmount: Money;
  paymentAccountId: string;
  relatedTransactionId: string;
  prepaymentAssumption: PrepaymentAssumption | null;
  status: DebtPaymentStatus;
  effectiveDate: string;
};

export function mapDebtPaymentRow(row: DebtPaymentRow): DebtPayment {
  return {
    id: row.id,
    debtId: row.debt_id,
    scheduleRowId: row.schedule_row_id,
    paymentType: assertLiteral(
      row.payment_type,
      DEBT_PAYMENT_TYPES,
      "debt_payments.payment_type",
    ),
    principalAmount: new Decimal(row.principal_amount),
    interestAmount: new Decimal(row.interest_amount),
    feesAmount: new Decimal(row.fees_amount),
    paymentAccountId: row.payment_account_id,
    relatedTransactionId: row.related_transaction_id,
    prepaymentAssumption:
      row.prepayment_assumption === null
        ? null
        : assertLiteral(
            row.prepayment_assumption,
            PREPAYMENT_ASSUMPTIONS,
            "debt_payments.prepayment_assumption",
          ),
    status: assertLiteral(
      row.status,
      DEBT_PAYMENT_STATUSES,
      "debt_payments.status",
    ),
    effectiveDate: row.effective_date,
  };
}
