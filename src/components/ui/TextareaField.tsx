import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

type TextareaFieldProps = {
  id: string;
  name: string;
  label: string;
  rows?: number;
  required?: boolean;
  defaultValue?: string | undefined;
  description?: string | undefined;
  error?: string | undefined;
};

/** A labelled textarea with an accessible, linked error message — the multi-line counterpart to components/ui/Field.tsx. */
export function TextareaField({
  id,
  name,
  label,
  rows = 3,
  required,
  defaultValue,
  description,
  error,
}: Readonly<TextareaFieldProps>) {
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
      <Textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-sm font-medium text-negative"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
