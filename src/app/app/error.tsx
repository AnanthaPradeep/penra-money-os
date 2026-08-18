"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Next.js requires this file to be a Client Component and to accept
 * `error`/`reset`. `error` is logged by code only (never rendered) — it
 * can carry backend details that must never reach the screen; the visible
 * UI is always the same safe, generic message.
 */
export default function AppError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[app-error]", { digest: error.digest });
    }
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      description="We couldn't load this page. Please try again."
      onRetry={reset}
    />
  );
}
