"use client";

import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * A `role="radiogroup"` of visually-distinct buttons — arrow-key navigable
 * like native radios, but laid out as a compact segmented selector rather
 * than a vertical list. Used for "choose one of a few mutually exclusive
 * options that changes the rest of the form" (transaction type), where a
 * plain `<select>` would hide the options behind an extra click.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: Readonly<SegmentedControlProps<T>>) {
  function handleKeyDown(event: KeyboardEvent, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + options.length) % options.length;
    const nextOption = options[nextIndex];
    if (!nextOption) {
      return;
    }
    onChange(nextOption.value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted-surface p-1.5"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              isSelected
                ? "bg-elevated text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
