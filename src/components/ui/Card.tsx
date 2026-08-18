import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function Card({ className, children, ...props }: Readonly<CardProps>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-elevated text-elevated-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: Readonly<CardProps>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-5 sm:p-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: Readonly<CardProps>) {
  return (
    <h3
      className={cn("text-lg font-semibold tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: Readonly<CardProps>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: Readonly<CardProps>) {
  return (
    <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: Readonly<CardProps>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-5 pt-0 sm:p-6 sm:pt-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
