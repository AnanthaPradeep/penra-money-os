"use client";

import { useActionState, useEffect, useState } from "react";

import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";
import { resendVerificationAction } from "@/lib/auth/actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";

/**
 * Client-side-only convenience — the actual enforcement is Supabase's own
 * server-side rate limiting (`auth.rate_limit` / `auth.email.max_frequency`
 * in supabase/config.toml). This cooldown only prevents accidental
 * double-clicks and sets expectations; a user bypassing it client-side
 * gains nothing, since the server still enforces its own limit.
 */
const COOLDOWN_SECONDS = 60;

export function ResendVerificationForm() {
  const [state, formAction] = useActionState(
    resendVerificationAction,
    INITIAL_AUTH_ACTION_STATE,
  );
  const [cooldown, setCooldown] = useState(0);

  // Starting the cooldown the moment `state` flips to "success" is state
  // *derived from* a change during render, not a subscription to an
  // external system — so it belongs in the render body (guarded by the
  // "did this state object actually change" ref check below), not an
  // effect. See https://react.dev/learn/you-might-not-need-an-effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.status === "success") {
      setCooldown(COOLDOWN_SECONDS);
    }
  }

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Field
        id="resend-verification-email"
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

      <SubmitButton pendingText="Sending…" disabled={cooldown > 0}>
        {cooldown > 0
          ? `Resend available in ${cooldown}s`
          : "Resend confirmation email"}
      </SubmitButton>
    </form>
  );
}
