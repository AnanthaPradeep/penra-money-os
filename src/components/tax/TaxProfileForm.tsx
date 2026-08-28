"use client";

import { useActionState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_TAX_ACTION_STATE } from "@/lib/tax/action-state";
import { saveTaxProfileAction } from "@/lib/tax/actions";
import type { TaxProfile } from "@/lib/tax/mapping";

const RESIDENTIAL_STATUS_OPTIONS = [
  { value: "resident", label: "Resident" },
  { value: "non_resident", label: "Non-resident (NRI) — unsupported for automated estimates" },
  { value: "resident_not_ordinarily_resident", label: "Resident but not ordinarily resident (RNOR) — unsupported for automated estimates" },
];

const REGIME_OPTIONS = [
  { value: "old", label: "Old regime" },
  { value: "new", label: "New regime" },
];

const AGE_BAND_OPTIONS = [
  { value: "below_60", label: "Below 60" },
  { value: "60_to_80", label: "60 to 80 (senior citizen slabs unsupported)" },
  { value: "above_80", label: "Above 80 (super senior slabs unsupported)" },
];

export function TaxProfileForm({
  profile,
}: Readonly<{ profile: TaxProfile | null }>) {
  const [state, formAction] = useActionState(
    saveTaxProfileAction,
    INITIAL_TAX_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Taxpayer profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Select
            id="tax-residential-status"
            name="residentialStatus"
            label="Residential status"
            options={RESIDENTIAL_STATUS_OPTIONS}
            defaultValue={profile?.residentialStatus ?? "resident"}
            required
            description="Automated slab, rebate, and capital-gains estimates are only available for a resident individual not carrying on business or a profession."
            error={fieldError("residentialStatus")}
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="hasBusinessOrProfessionalIncome"
              value="true"
              defaultChecked={profile?.hasBusinessOrProfessionalIncome ?? false}
              className="size-4 rounded border-input-border"
            />
            I have business or professional income
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="hasSalaryOrPensionIncome"
              value="true"
              defaultChecked={profile?.hasSalaryOrPensionIncome ?? true}
              className="size-4 rounded border-input-border"
            />
            I have salary or pension income (for the standard deduction)
          </label>
          <Select
            id="tax-age-band"
            name="ageBand"
            label="Age band (optional)"
            options={AGE_BAND_OPTIONS}
            defaultValue={profile?.ageBand ?? ""}
            placeholder="Not set"
            error={fieldError("ageBand")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Comparison preference</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Select
            id="tax-regime-preference"
            name="defaultRegimePreference"
            label="Default regime for viewing (optional)"
            options={REGIME_OPTIONS}
            defaultValue={profile?.defaultRegimePreference ?? ""}
            placeholder="No preference"
            description="This only changes which regime's numbers are shown first — PENRA never chooses a regime for you."
            error={fieldError("defaultRegimePreference")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Identity (optional)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <Field
            id="tax-masked-pan"
            name="maskedPanLabel"
            label="Last 4 characters of your PAN"
            defaultValue={profile?.maskedPanLabel ?? undefined}
            description="Only up to 4 characters, purely for your own reference. Never your full PAN, and never Aadhaar."
            error={fieldError("maskedPanLabel")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <textarea
            name="notes"
            rows={3}
            defaultValue={profile?.notes ?? undefined}
            className="flex w-full min-w-0 rounded-md border border-input-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground sm:text-sm"
          />
        </CardContent>
      </Card>

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      {state.status === "success" ? (
        <FormMessage message={state.message} tone="success" />
      ) : null}

      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}
