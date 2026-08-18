import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { Card, CardContent } from "@/components/ui/Card";

type AuthPageShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** Shared layout for every auth page — branding, a centred card for the form, and a short privacy reassurance. */
export function AuthPageShell({
  title,
  description,
  children,
}: Readonly<AuthPageShellProps>) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
          >
            P
          </span>
          <span className="text-base font-semibold tracking-tight">
            PENRA Money OS
          </span>
        </Link>
        <ThemeSwitcher />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10 sm:px-6">
        <Card>
          <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {children}
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" />
          Your data is private and never shared or sold.
        </p>
      </main>
    </div>
  );
}
