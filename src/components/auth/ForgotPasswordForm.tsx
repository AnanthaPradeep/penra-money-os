"use client";

import Link from "next/link";
import { useActionState } from "react";

import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    INITIAL_AUTH_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field
        id="forgot-password-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={fieldError("email")}
      />

      {state.status !== "idle" ? (
        <FormMessage
          message={state.message}
          tone={state.status === "success" ? "success" : "error"}
        />
      ) : null}

      <SubmitButton pendingText="Sending…">
        Send reset instructions
      </SubmitButton>

      <p className="text-sm opacity-80">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="font-medium underline underline-offset-2"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
