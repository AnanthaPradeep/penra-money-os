import { AlertCircle } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";

type FieldProps = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "number" | "date";
  autoComplete?: string | undefined;
  defaultValue?: string | number | undefined;
  required?: boolean;
  min?: number | undefined;
  max?: number | undefined;
  step?: string | number | undefined;
  inputMode?: "text" | "decimal" | "numeric" | "email" | "none";
  placeholder?: string | undefined;
  /** Extra guidance shown under the label, above the input — e.g. "Only the last 4 digits, never the full number." */
  description?: string | undefined;
  error?: string | undefined;
};

/**
 * A labelled input with an accessible, linked error message — shared by
 * every auth and profile form so label association, `autoComplete`,
 * `aria-invalid`, and `aria-describedby` are never each re-implemented
 * (and potentially forgotten) per form. `type="password"` automatically
 * renders the show/hide-enabled PasswordInput instead of a plain input —
 * every password field in the app gets that control for free.
 */
export function Field({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  required,
  min,
  max,
  step,
  inputMode,
  placeholder,
  description,
  error,
}: Readonly<FieldProps>) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const sharedProps = {
    id,
    name,
    autoComplete,
    defaultValue,
    required,
    min,
    max,
    step,
    inputMode,
    placeholder,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy,
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={id}
        className={
          required
            ? "after:ml-0.5 after:text-negative after:content-['*']"
            : undefined
        }
      >
        {label}
      </Label>
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {type === "password" ? (
        <PasswordInput {...sharedProps} />
      ) : (
        <Input type={type} {...sharedProps} />
      )}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-medium text-negative"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
