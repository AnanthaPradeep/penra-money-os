"use client";

import Link from "next/link";
import { useActionState } from "react";

import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";
import { signUpAction } from "@/lib/auth/actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

type SignupFormProps = {
  next?: string;
};

export function SignupForm({ next }: SignupFormProps) {
  const [state, formAction] = useActionState(
    signUpAction,
    INITIAL_AUTH_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field
        id="signup-display-name"
        name="displayName"
        label="Name"
        autoComplete="name"
        required
        error={fieldError("displayName")}
      />
      <Field
        id="signup-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={fieldError("email")}
      />
      <Field
        id="signup-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldError("password")}
      />
      <Field
        id="signup-confirm-password"
        name="confirmPassword"
        label="Confirm password"
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

      <SubmitButton pendingText="Creating your account…">
        Create account
      </SubmitButton>

      <p className="text-sm opacity-80">
        Already have an account?{" "}
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
