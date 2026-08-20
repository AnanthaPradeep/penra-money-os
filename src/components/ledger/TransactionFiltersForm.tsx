"use client";

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import type { TransactionFiltersSearchParams } from "@/lib/ledger/filters-schema";
import {
  MANUAL_TRANSACTION_TYPE_LABELS,
  MANUAL_TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
} from "@/lib/ledger/transaction-types";

type Option = { id: string; name: string };

type TransactionFiltersFormProps = {
  accounts: Option[];
  categories: Option[];
  current: TransactionFiltersSearchParams;
};

const KIND_OPTIONS = MANUAL_TRANSACTION_TYPES.map((type) => ({
  value: type,
  label: MANUAL_TRANSACTION_TYPE_LABELS[type],
}));

const STATUS_OPTIONS = TRANSACTION_STATUSES.map((status) => ({
  value: status,
  label: status === "posted" ? "Posted" : "Reversed",
}));

/**
 * A plain GET form — submitting it just navigates to
 * /app/transactions?<the fields below>, which the page reads, validates,
 * and re-fetches from. No client-side fetch/state duplication of what the
 * server already does, and the resulting URL is shareable/reload-safe by
 * construction.
 */
export function TransactionFiltersForm({
  accounts,
  categories,
  current,
}: Readonly<TransactionFiltersFormProps>) {
  const hasFilters = Boolean(
    current.q ??
    current.kind ??
    current.account ??
    current.category ??
    current.status ??
    current.from ??
    current.to ??
    current.min ??
    current.max,
  );

  return (
    <form
      method="get"
      action="/app/transactions"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <Field
        id="filter-q"
        name="q"
        label="Search"
        placeholder="Description, notes, reference or payee"
        defaultValue={current.q}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id="filter-kind"
          name="kind"
          label="Type"
          placeholder="Any type"
          options={KIND_OPTIONS}
          defaultValue={current.kind}
        />
        <Select
          id="filter-status"
          name="status"
          label="Status"
          placeholder="Any status"
          options={STATUS_OPTIONS}
          defaultValue={current.status}
        />
        <Select
          id="filter-account"
          name="account"
          label="Account"
          placeholder="Any account"
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          defaultValue={current.account}
        />
        <Select
          id="filter-category"
          name="category"
          label="Category"
          placeholder="Any category"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          defaultValue={current.category}
        />
        <Field
          id="filter-from"
          name="from"
          label="From date"
          type="date"
          defaultValue={current.from}
        />
        <Field
          id="filter-to"
          name="to"
          label="To date"
          type="date"
          defaultValue={current.to}
        />
        <Field
          id="filter-min"
          name="min"
          label="Min amount"
          inputMode="decimal"
          defaultValue={current.min}
        />
        <Field
          id="filter-max"
          name="max"
          label="Max amount"
          inputMode="decimal"
          defaultValue={current.max}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        {hasFilters ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/app/transactions">Clear all filters</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
