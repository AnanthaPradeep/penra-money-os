"use client";

import Link from "next/link";
import { useActionState } from "react";

import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";
import { logInAction } from "@/lib/auth/actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

type LoginFormProps = {
  next?: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const [state, formAction] = useActionState(
    logInAction,
    INITIAL_AUTH_ACTION_STATE,
  );

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field
        id="login-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={fieldError("email")}
      />
      <Field
        id="login-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldError("password")}
      />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}

      <SubmitButton pendingText="Signing in…">Log in</SubmitButton>

      <div className="flex flex-col gap-1 text-sm opacity-80">
        <Link
          href="/forgot-password"
          className="font-medium underline underline-offset-2"
        >
          Forgot your password?
        </Link>
        <p>
          Don&rsquo;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium underline underline-offset-2"
          >
            Sign up
          </Link>
        </p>
      </div>
    </form>
  );
}
