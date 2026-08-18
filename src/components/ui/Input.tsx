import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/ui/cn";

export const inputStyles =
  "flex h-11 w-full min-w-0 rounded-md border border-input-border bg-background px-3 text-base text-foreground transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-negative sm:text-sm";

export const Input = forwardRef<
  HTMLInputElement,
  Readonly<InputHTMLAttributes<HTMLInputElement>>
>(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(inputStyles, className)}
      {...props}
    />
  );
});
Input.displayName = "Input";
