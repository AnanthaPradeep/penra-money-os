"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";

import { useMounted } from "@/lib/ui/use-mounted";

/** Placed once in the root layout. Theme-aware so toasts never render with the wrong palette after a theme switch. */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  return (
    <SonnerToaster
      theme={mounted && resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-border bg-elevated text-elevated-foreground shadow-lg",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
