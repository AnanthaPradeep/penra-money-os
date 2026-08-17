"use client";

import { useActionState } from "react";

import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";
import { resetPasswordAction } from "@/lib/auth/actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(
    resetPasswordAction,
    INITIAL_AUTH_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field
        id="reset-password-password"
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldError("password")}
      />
      <Field
        id="reset-password-confirm-password"
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldError("confirmPassword")}
      />

      <p className="text-xs opacity-70">
        Use at least 12 characters. A long, unique passphrase is safer than a
        short one with symbols.
      </p>

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Updating password…">
        Set new password
      </SubmitButton>
    </form>
  );
}
