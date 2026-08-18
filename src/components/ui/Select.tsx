import { AlertCircle, ChevronDown } from "lucide-react";
import type { ChangeEvent } from "react";

import { Label } from "@/components/ui/Label";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  id: string;
  name: string;
  label: string;
  options: SelectOption[];
  defaultValue?: string | undefined;
  required?: boolean;
  placeholder?: string | undefined;
  description?: string | undefined;
  error?: string | undefined;
  onChange?: ((event: ChangeEvent<HTMLSelectElement>) => void) | undefined;
};

/** A labelled select with an accessible, linked error message — the Select counterpart to components/ui/Field.tsx. */
export function Select({
  id,
  name,
  label,
  options,
  defaultValue,
  required,
  placeholder,
  description,
  error,
  onChange,
}: Readonly<SelectProps>) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

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
      <div className="relative">
        <select
          id={id}
          name={name}
          defaultValue={defaultValue ?? ""}
          required={required}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-11 w-full appearance-none rounded-md border border-input-border bg-background px-3 pr-10 text-base text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-negative sm:text-sm"
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
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
