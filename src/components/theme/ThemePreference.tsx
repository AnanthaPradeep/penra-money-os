"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMounted } from "@/lib/ui/use-mounted";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: { value: ThemeOption; label: string; icon: ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: <Sun aria-hidden="true" className="size-4" />,
  },
  {
    value: "dark",
    label: "Dark",
    icon: <Moon aria-hidden="true" className="size-4" />,
  },
  {
    value: "system",
    label: "System",
    icon: <Monitor aria-hidden="true" className="size-4" />,
  },
];

function isThemeOption(value: string | undefined): value is ThemeOption {
  return value === "light" || value === "dark" || value === "system";
}

/** The full-size theme preference control for the profile settings page — the compact ThemeSwitcher dropdown in the shell is the same setting, just a smaller control. */
export function ThemePreference() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted && isThemeOption(theme) ? theme : "system";

  return (
    <SegmentedControl
      label="Theme"
      options={OPTIONS}
      value={current}
      onChange={setTheme}
    />
  );
}
