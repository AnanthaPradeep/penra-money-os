"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import type { buttonVariants } from "@/components/ui/Button";
import type { VariantProps } from "class-variance-authority";

type SubmitButtonProps = {
  children: ReactNode;
  pendingText?: string;
  /** External disable condition (e.g. a client-side resend cooldown), independent of submission pending state. */
  disabled?: boolean;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  className?: string;
};

/**
 * A submit button with an accessible pending state, shared across every
 * form in the app. Must be rendered inside the `<form>` it submits —
 * `useFormStatus` only sees the nearest ancestor form's pending state.
 * Disabling while pending is this app's mechanism for preventing a
 * duplicate submission on a slow connection or an impatient double-click.
 */
export function SubmitButton({
  children,
  pendingText,
  disabled,
  variant,
  className,
}: Readonly<SubmitButtonProps>) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      className={className ? className : "w-full"}
      disabled={pending || disabled}
      isLoading={pending}
    >
      {pending ? (pendingText ?? "Please wait…") : children}
    </Button>
  );
}
