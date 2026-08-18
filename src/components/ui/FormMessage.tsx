import { AlertTriangle, CheckCircle2 } from "lucide-react";

type FormMessageProps = {
  message?: string;
  tone?: "error" | "success";
};

/**
 * Accessible, non-colour-only status region shared by every form. Error
 * messages use `role="alert"` (assertive — announced immediately); success
 * messages use `role="status"` (polite). Never renders a raw error string
 * from an external system — callers are responsible for passing only
 * already-normalised, safe copy.
 */
export function FormMessage({
  message,
  tone = "error",
}: Readonly<FormMessageProps>) {
  if (!message) {
    return null;
  }

  const isError = tone === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "flex items-start gap-2 rounded-md border border-negative/30 bg-negative-surface px-3 py-2.5 text-sm text-negative"
          : "flex items-start gap-2 rounded-md border border-positive/30 bg-positive-surface px-3 py-2.5 text-sm text-positive"
      }
    >
      {isError ? (
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      )}
      <span>
        <span className="sr-only">{isError ? "Error: " : "Success: "}</span>
        {message}
      </span>
    </p>
  );
}
