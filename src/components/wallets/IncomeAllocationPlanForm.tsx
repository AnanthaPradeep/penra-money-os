"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { INCOME_ALLOCATION_MODES } from "@/lib/wallets/mapping";
import { INITIAL_WALLET_ACTION_STATE } from "@/lib/wallets/action-state";
import { saveIncomeAllocationPlanAction } from "@/lib/wallets/actions";

const MODE_OPTIONS = [
  { value: "percentage", label: "Percentage — lines must total exactly 100%" },
  { value: "fixed_amount", label: "Fixed amount — a set amount per wallet" },
  {
    value: "hybrid",
    label: "Hybrid — fixed amounts first, then percentages of what's left",
  },
  { value: "manual", label: "Manual" },
];

type LineDraft = { walletId: string; percentage: string; fixedAmount: string };

type IncomeAllocationPlanFormProps = {
  wallets: { id: string; name: string }[];
};

export function IncomeAllocationPlanForm({
  wallets,
}: Readonly<IncomeAllocationPlanFormProps>) {
  const [state, formAction] = useActionState(
    saveIncomeAllocationPlanAction,
    INITIAL_WALLET_ACTION_STATE,
  );
  const [mode, setMode] =
    useState<(typeof INCOME_ALLOCATION_MODES)[number]>("percentage");
  const [lines, setLines] = useState<LineDraft[]>([
    { walletId: "", percentage: "", fixedAmount: "" },
  ]);

  const walletOptions = wallets.map((w) => ({ value: w.id, label: w.name }));
  const showPercentage = mode === "percentage" || mode === "hybrid";
  const showFixed = mode === "fixed_amount" || mode === "hybrid";

  const linesPayload = JSON.stringify(
    lines
      .filter((line) => line.walletId)
      .map((line) => ({
        wallet_id: line.walletId,
        ...(line.percentage ? { percentage: line.percentage } : {}),
        ...(line.fixedAmount ? { fixed_amount: line.fixedAmount } : {}),
      })),
  );

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  if (wallets.length === 0) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-muted-foreground">
          Create at least one wallet before building an income allocation plan.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">New allocation plan</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <Field
            id="plan-name"
            name="name"
            label="Plan name"
            required
            placeholder="e.g. Salary split"
            error={
              state.status === "error" ? state.fieldErrors?.name : undefined
            }
          />
          <Select
            id="plan-mode"
            name="allocationMode"
            label="Allocation mode"
            options={MODE_OPTIONS}
            defaultValue="percentage"
            required
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "percentage" ||
                value === "fixed_amount" ||
                value === "hybrid" ||
                value === "manual"
              ) {
                setMode(value);
              }
            }}
          />
          <Field
            id="plan-effective-date"
            name="effectiveDate"
            label="Effective from"
            type="date"
            required
            error={
              state.status === "error"
                ? state.fieldErrors?.effectiveDate
                : undefined
            }
          />

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground">
              Allocation lines
            </span>
            {lines.map((line, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <Select
                    id={`line-wallet-${index}`}
                    name={`__line-wallet-${index}`}
                    label="Wallet"
                    options={walletOptions}
                    placeholder="Choose a wallet"
                    defaultValue={line.walletId}
                    onChange={(e) =>
                      updateLine(index, { walletId: e.target.value })
                    }
                  />
                </div>
                {showPercentage ? (
                  <div className="flex w-full flex-col gap-1.5 sm:w-32">
                    <Label htmlFor={`line-percentage-${index}`}>
                      Percentage
                    </Label>
                    <Input
                      id={`line-percentage-${index}`}
                      inputMode="decimal"
                      defaultValue={line.percentage}
                      onChange={(e) =>
                        updateLine(index, { percentage: e.target.value })
                      }
                    />
                  </div>
                ) : null}
                {showFixed ? (
                  <div className="flex w-full flex-col gap-1.5 sm:w-32">
                    <Label htmlFor={`line-fixed-${index}`}>Fixed amount</Label>
                    <Input
                      id={`line-fixed-${index}`}
                      inputMode="decimal"
                      defaultValue={line.fixedAmount}
                      onChange={(e) =>
                        updateLine(index, { fixedAmount: e.target.value })
                      }
                    />
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line"
                  onClick={() =>
                    setLines((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={lines.length === 1}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { walletId: "", percentage: "", fixedAmount: "" },
                ])
              }
            >
              Add line
            </Button>
          </div>

          <input type="hidden" name="lines" value={linesPayload} />

          {state.status === "error" ? (
            <FormMessage message={state.message} tone="error" />
          ) : null}

          <SubmitButton pendingText="Saving…">Save plan</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
