type FieldProps = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "number";
  autoComplete?: string;
  defaultValue?: string | number;
  required?: boolean;
  min?: number;
  max?: number;
  error?: string;
};

/**
 * A labelled input with an accessible, linked error message — shared by
 * every auth and profile form so label association, `autoComplete`,
 * `aria-invalid`, and `aria-describedby` are never each re-implemented
 * (and potentially forgotten) per form.
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
  error,
}: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded-md border border-current/25 bg-transparent px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
