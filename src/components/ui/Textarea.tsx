import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/ui/cn";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  Readonly<TextareaHTMLAttributes<HTMLTextAreaElement>>
>(({ className, rows = 3, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "flex w-full min-w-0 rounded-md border border-input-border bg-background px-3 py-2 text-base text-foreground transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-negative sm:text-sm",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
