"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * Wraps next-themes with this app's fixed configuration (class-based
 * switching, matching the `.dark` selector in globals.css; persisted to
 * localStorage automatically; system theme supported). `suppressHydrationWarning`
 * on <html> in the root layout is what next-themes' own docs call for — the
 * server has no way to know the client's stored preference before paint, so
 * the class attribute legitimately differs for one render.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
