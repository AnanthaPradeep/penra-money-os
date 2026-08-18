"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/Button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

/**
 * A safe, generic error surface — never renders a raw error object or a
 * backend message, since those can leak internal details. `onRetry` is
 * optional; when a route provides one (e.g. Next.js's `error.tsx` reset
 * function) it's shown as a real recovery path, not just a dead message.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this page. Please try again.",
  onRetry,
}: Readonly<ErrorStateProps>) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-negative/30 bg-negative-surface px-6 py-12 text-center"
    >
      <div
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-negative/10 text-negative"
      >
        <AlertTriangle className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="mt-2"
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
