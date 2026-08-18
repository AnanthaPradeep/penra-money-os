import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/ui/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        outline:
          "border border-input-border bg-transparent text-foreground hover:bg-muted-surface",
        ghost: "bg-transparent text-foreground hover:bg-muted-surface",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
        link: "bg-transparent p-0 text-primary underline underline-offset-2 hover:text-primary-hover",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner and disables the button — distinct from the plain HTML `disabled` prop so callers can tell "busy" from "unavailable" apart in their own logic if needed. */
    isLoading?: boolean;
  };

/**
 * The one button implementation for the whole app — every variant/size
 * combination used anywhere should come from here, never a one-off
 * `<button className="...">`. `isLoading` renders a spinner and forces
 * `disabled`, which is the app-wide mechanism for preventing a duplicate
 * submit on a slow network rather than each form re-inventing it.
 */
export const Button = forwardRef<HTMLButtonElement, Readonly<ButtonProps>>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    // Radix's Slot requires exactly one element child — asChild is for
    // wrapping a single element (typically a Link), which never carries a
    // loading state, so the spinner branch only applies to the real
    // <button> case below.
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
