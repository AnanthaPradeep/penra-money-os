"use client";

import { ArrowLeftRight, CreditCard, Receipt, TrendingUp } from "lucide-react";
import { useState } from "react";

import { RecurringBillForm } from "@/components/recurring/RecurringBillForm";
import { RecurringIncomeForm } from "@/components/recurring/RecurringIncomeForm";
import { RecurringTransferForm } from "@/components/recurring/RecurringTransferForm";
import type {
  RecurringAccountOption,
  RecurringCategoryOption,
} from "@/components/recurring/types";
import type { PayeeOption } from "@/components/ledger/PayeeCombobox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  RECURRING_ITEM_KIND_LABELS,
  RECURRING_ITEM_KINDS,
  type RecurringItemKind,
} from "@/lib/recurring/types";

const KIND_ICONS: Record<RecurringItemKind, typeof TrendingUp> = {
  subscription: CreditCard,
  bill: Receipt,
  income: TrendingUp,
  transfer: ArrowLeftRight,
};

type RecurringItemFormProps = {
  accounts: RecurringAccountOption[];
  incomeCategories: RecurringCategoryOption[];
  expenseCategories: RecurringCategoryOption[];
  payees: PayeeOption[];
  defaultStartDate: string;
  defaultKind?: RecurringItemKind;
};

/** Each kind is its own form component with its own useActionState call, exactly like NewTransactionForm (src/components/ledger) — switching `kind` just changes which one is mounted. */
export function RecurringItemForm({
  accounts,
  incomeCategories,
  expenseCategories,
  payees,
  defaultStartDate,
  defaultKind = "bill",
}: Readonly<RecurringItemFormProps>) {
  const [kind, setKind] = useState<RecurringItemKind>(defaultKind);

  const options = RECURRING_ITEM_KINDS.map((k) => ({
    value: k,
    label: RECURRING_ITEM_KIND_LABELS[k],
    icon: (() => {
      const Icon = KIND_ICONS[k];
      return <Icon aria-hidden="true" className="size-4" />;
    })(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        label="What kind of recurring item is this?"
        options={options}
        value={kind}
        onChange={setKind}
      />

      {kind === "bill" || kind === "subscription" ? (
        <RecurringBillForm
          kind={kind}
          accounts={accounts}
          categories={expenseCategories}
          payees={payees}
          defaultStartDate={defaultStartDate}
        />
      ) : null}
      {kind === "income" ? (
        <RecurringIncomeForm
          accounts={accounts}
          categories={incomeCategories}
          payees={payees}
          defaultStartDate={defaultStartDate}
        />
      ) : null}
      {kind === "transfer" ? (
        <RecurringTransferForm
          accounts={accounts}
          defaultStartDate={defaultStartDate}
        />
      ) : null}
    </div>
  );
}
