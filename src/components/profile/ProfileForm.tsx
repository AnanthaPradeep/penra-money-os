"use client";

import { useActionState } from "react";

import { INITIAL_PROFILE_ACTION_STATE } from "@/lib/profile/action-state";
import { updateProfileAction } from "@/lib/profile/actions";
import type { ProfileRow } from "@/lib/profile/types";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

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

/**
 * Base currency, locale, timezone, and financial-year start are rendered
 * as disabled fields, not omitted — the data model and Server Action both
 * already support editing them (each has a schema default, so a disabled
 * field simply submits nothing and the default applies), but this personal,
 * India-focused version doesn't yet offer a UI to change them.
 */
export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction] = useActionState(
    updateProfileAction,
    INITIAL_PROFILE_ACTION_STATE,
  );

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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-base-currency" className="text-sm font-medium">
          Base currency
        </label>
        <input
          id="profile-base-currency"
          value={profile.base_currency}
          disabled
          className="rounded-md border border-current/15 bg-transparent px-3 py-2 text-sm opacity-60"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-locale" className="text-sm font-medium">
          Locale
        </label>
        <input
          id="profile-locale"
          value={profile.locale}
          disabled
          className="rounded-md border border-current/15 bg-transparent px-3 py-2 text-sm opacity-60"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-timezone" className="text-sm font-medium">
          Timezone
        </label>
        <input
          id="profile-timezone"
          value={profile.timezone}
          disabled
          className="rounded-md border border-current/15 bg-transparent px-3 py-2 text-sm opacity-60"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-fy-start" className="text-sm font-medium">
          Financial year starts
        </label>
        <input
          id="profile-fy-start"
          value={monthName}
          disabled
          className="rounded-md border border-current/15 bg-transparent px-3 py-2 text-sm opacity-60"
        />
      </div>

      <p className="text-xs opacity-70">
        Base currency, locale, timezone, and financial-year start are fixed to
        India defaults in this personal version.
      </p>

      {state.status !== "idle" ? (
        <FormMessage
          message={state.message}
          tone={state.status === "success" ? "success" : "error"}
        />
      ) : null}

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
