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
import { TransferTransactionForm } from "@/components/ledger/TransferTransactionForm";
import type { AccountOption } from "@/components/ledger/types";
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
  defaultAccountId?: string | undefined;
  defaultDate?: string | undefined;
};

/**
 * Each transaction type is its own form component with its own
 * useActionState call — switching `type` just changes which one is
 * mounted, rather than trying to share a single hook across five
 * different Server Actions.
 */
export function NewTransactionForm({
  accounts,
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
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
      {type === "expense" ? (
        <ExpenseTransactionForm
          accounts={accounts}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
      {type === "transfer" ? (
        <TransferTransactionForm
          accounts={accounts}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
      {type === "credit_card_purchase" ? (
        <CreditCardPurchaseForm
          creditCardAccounts={creditCardAccounts}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
      {type === "credit_card_payment" ? (
        <CreditCardPaymentForm
          creditCardAccounts={creditCardAccounts}
          fromAccounts={accounts}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
        />
      ) : null}
    </div>
  );
}
