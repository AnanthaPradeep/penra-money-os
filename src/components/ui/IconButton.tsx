import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Button, type buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/ui/cn";
import type { VariantProps } from "class-variance-authority";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Pick<VariantProps<typeof buttonVariants>, "variant"> & {
    icon: ReactNode;
    /** Required, not optional — an icon-only button with no accessible name is invisible to assistive tech. */
    "aria-label": string;
  };

/** A square icon-only button that always carries an accessible name via `aria-label`. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Readonly<IconButtonProps>
>(({ icon, className, variant = "ghost", ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant={variant}
      size="icon"
      className={cn("shrink-0", className)}
      {...props}
    >
      {icon}
    </Button>
  );
});
IconButton.displayName = "IconButton";
