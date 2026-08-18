import type { ReactNode } from "react";

import { DesktopSidebar } from "@/components/shell/DesktopSidebar";
import { MobileBottomNav } from "@/components/shell/MobileBottomNav";
import { MobileTopBar } from "@/components/shell/MobileTopBar";

type AppShellProps = {
  displayName: string | null;
  email: string | null;
  children: ReactNode;
};

/**
 * The one protected-area shell every `/app/*` route renders inside (see
 * src/app/app/layout.tsx). Desktop gets a persistent left sidebar; mobile
 * gets a compact top bar plus a fixed bottom nav instead — never both, and
 * never a sidebar overlay, per the product direction for this phase.
 */
export function AppShell({
  displayName,
  email,
  children,
}: Readonly<AppShellProps>) {
  return (
    <div className="flex min-h-full">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground"
      >
        Skip to content
      </a>

      <DesktopSidebar displayName={displayName} email={email} />

      <div className="flex min-h-full flex-1 flex-col">
        <MobileTopBar email={email} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-8 lg:pb-8"
        >
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
