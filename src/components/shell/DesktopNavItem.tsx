import Link from "next/link";

import type { NavItem } from "@/components/shell/nav-items";
import { cn } from "@/lib/ui/cn";

type DesktopNavItemProps = {
  item: NavItem;
  isActive: boolean;
};

export function DesktopNavItem({
  item,
  isActive,
}: Readonly<DesktopNavItemProps>) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-active text-sidebar-active-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-active/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}
