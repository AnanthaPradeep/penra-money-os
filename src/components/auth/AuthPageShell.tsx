import type { ReactNode } from "react";

type AuthPageShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** Shared minimal layout for every auth page — heading, optional description, then the form. */
export function AuthPageShell({
  title,
  description,
  children,
}: AuthPageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm opacity-80">{description}</p>
        ) : null}
      </header>
      {children}
    </main>
  );
}
