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
export function FormMessage({ message, tone = "error" }: FormMessageProps) {
  if (!message) {
    return null;
  }

  const isError = tone === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${
        isError ? "border-current/40" : "border-current/20"
      }`}
    >
      <strong className="font-semibold">
        {isError ? "Error: " : "Success: "}
      </strong>
      {message}
    </p>
  );
}
