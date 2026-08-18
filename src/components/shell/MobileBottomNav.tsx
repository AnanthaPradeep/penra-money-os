"use client";

import { usePathname } from "next/navigation";

import { isNavItemActive, NAV_ITEMS } from "@/components/shell/nav-items";
import { MobileNavItem } from "@/components/shell/MobileNavItem";

/**
 * `pb-[env(safe-area-inset-bottom)]` reserves space on devices with a home
 * indicator (notched phones) so the nav never sits under it; the page
 * content's own bottom padding (see AppShell) is what keeps content from
 * being hidden behind this fixed bar, not this component.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-mobile-nav-border bg-mobile-nav px-2 pt-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <MobileNavItem
          key={item.href}
          item={item}
          isActive={isNavItemActive(pathname, item.href)}
        />
      ))}
    </nav>
  );
}
