"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: ReactNode;
  pendingText?: string;
  /** External disable condition (e.g. a client-side resend cooldown), independent of submission pending state. */
  disabled?: boolean;
};

/**
 * A submit button with an accessible pending state, shared across every
 * form in the app. Must be rendered inside the `<form>` it submits —
 * `useFormStatus` only sees the nearest ancestor form's pending state.
 */
export function SubmitButton({
  children,
  pendingText,
  disabled,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className="w-full rounded-md border border-current px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (pendingText ?? "Please wait…") : children}
    </button>
  );
}
