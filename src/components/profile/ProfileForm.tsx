"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_PROFILE_ACTION_STATE } from "@/lib/profile/action-state";
import { updateProfileAction } from "@/lib/profile/actions";
import type { ProfileRow } from "@/lib/profile/types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type ProfileFormProps = {
  profile: ProfileRow;
};

function ReadOnlyField({
  id,
  label,
  value,
}: Readonly<{ id: string; label: string; value: string }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} readOnly disabled />
    </div>
  );
}

/**
 * Base currency, locale, timezone, and financial-year start are rendered
 * as disabled fields, not omitted — the data model and Server Action both
 * already support editing them (each has a schema default, so a disabled
 * field simply submits nothing and the default applies), but this personal,
 * India-focused version doesn't yet offer a UI to change them.
 */
export function ProfileForm({ profile }: Readonly<ProfileFormProps>) {
  const [state, formAction] = useActionState(
    updateProfileAction,
    INITIAL_PROFILE_ACTION_STATE,
  );

  // Synchronising with sonner's own toast manager, an external system —
  // exactly what an effect is for, and distinct from calling React's own
  // setState here (which this deliberately does not do).
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  const monthName =
    MONTH_NAMES[profile.financial_year_start_month - 1] ?? "April";

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field
        id="profile-display-name"
        name="displayName"
        label="Name"
        autoComplete="name"
        required
        defaultValue={profile.display_name ?? ""}
        error={fieldError("displayName")}
      />

      <ReadOnlyField
        id="profile-base-currency"
        label="Base currency"
        value={profile.base_currency}
      />
      <ReadOnlyField
        id="profile-locale"
        label="Locale"
        value={profile.locale}
      />
      <ReadOnlyField
        id="profile-timezone"
        label="Timezone"
        value={profile.timezone}
      />
      <ReadOnlyField
        id="profile-fy-start"
        label="Financial year starts"
        value={monthName}
      />

      <p className="text-xs text-muted-foreground">
        Base currency, locale, timezone, and financial-year start are fixed to
        India defaults (INR, en-IN, Asia/Kolkata, April) in this personal
        version.
      </p>

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
