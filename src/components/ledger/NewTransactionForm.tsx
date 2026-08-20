"use client";

import {
  ArrowLeftRight,
  CreditCard,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import { CreditCardPaymentForm } from "@/components/ledger/CreditCardPaymentForm";
import { CreditCardPurchaseForm } from "@/components/ledger/CreditCardPurchaseForm";
import { ExpenseTransactionForm } from "@/components/ledger/ExpenseTransactionForm";
import { IncomeTransactionForm } from "@/components/ledger/IncomeTransactionForm";
import type { PayeeOption } from "@/components/ledger/PayeeCombobox";
import { TransferTransactionForm } from "@/components/ledger/TransferTransactionForm";
import type { AccountOption, CategoryOption } from "@/components/ledger/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  MANUAL_TRANSACTION_TYPE_LABELS,
  MANUAL_TRANSACTION_TYPES,
  type ManualTransactionType,
} from "@/lib/ledger/transaction-types";

const TYPE_ICONS: Record<ManualTransactionType, typeof TrendingUp> = {
  income: TrendingUp,
  expense: TrendingDown,
  transfer: ArrowLeftRight,
  credit_card_purchase: Receipt,
  credit_card_payment: CreditCard,
};

type NewTransactionFormProps = {
  accounts: AccountOption[];
  incomeCategories: CategoryOption[];
  expenseCategories: CategoryOption[];
  payees: PayeeOption[];
  idempotencyKey: string;
  defaultAccountId?: string | undefined;
  defaultDate?: string | undefined;
};

/**
 * Each transaction type is its own form component with its own
 * useActionState call — switching `type` just changes which one is
 * mounted, rather than trying to share a single hook across five
 * different Server Actions. idempotencyKey is generated once, server-side,
 * by the page rendering this form (see src/app/app/transactions/new/
 * page.tsx) — not client-side, since a client-generated random value would
 * differ between the server-rendered and hydrated passes and trip a
 * hydration mismatch. Switching transaction type re-mounts a *different*
 * form component, not a fresh instance of the same one, so the same key
 * survives a type switch and still only ever names one real submission
 * attempt.
 */
export function NewTransactionForm({
  accounts,
  incomeCategories,
  expenseCategories,
  payees,
  idempotencyKey,
  defaultAccountId,
  defaultDate,
}: Readonly<NewTransactionFormProps>) {
  const defaultAccount = accounts.find((a) => a.id === defaultAccountId);
  const [type, setType] = useState<ManualTransactionType>(
    defaultAccount?.accountType === "credit_card"
      ? "credit_card_purchase"
      : "expense",
  );
  const creditCardAccounts = accounts.filter(
    (account) => account.accountType === "credit_card",
  );

  const options = MANUAL_TRANSACTION_TYPES.map((manualType) => ({
    value: manualType,
    label: MANUAL_TRANSACTION_TYPE_LABELS[manualType],
    icon: (() => {
      const Icon = TYPE_ICONS[manualType];
      return <Icon aria-hidden="true" className="size-4" />;
    })(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        label="Transaction type"
        options={options}
        value={type}
        onChange={setType}
      />

      {type === "income" ? (
        <IncomeTransactionForm
          accounts={accounts}
          categories={incomeCategories}
          payees={payees}
          idempotencyKey={idempotencyKey}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
      {type === "expense" ? (
        <ExpenseTransactionForm
          accounts={accounts}
          categories={expenseCategories}
          payees={payees}
          idempotencyKey={idempotencyKey}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
      {type === "transfer" ? (
        <TransferTransactionForm
          accounts={accounts}
          idempotencyKey={idempotencyKey}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
      {type === "credit_card_purchase" ? (
        <CreditCardPurchaseForm
          creditCardAccounts={creditCardAccounts}
          categories={expenseCategories}
          payees={payees}
          idempotencyKey={idempotencyKey}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
      {type === "credit_card_payment" ? (
        <CreditCardPaymentForm
          creditCardAccounts={creditCardAccounts}
          fromAccounts={accounts}
          idempotencyKey={idempotencyKey}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
    </div>
  );
}
