import Link from "next/link";

import type { NavItem } from "@/components/shell/nav-items";
import { cn } from "@/lib/ui/cn";

type MobileNavItemProps = {
  item: NavItem;
  isActive: boolean;
};

export function MobileNavItem({
  item,
  isActive,
}: Readonly<MobileNavItemProps>) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-xs font-medium transition-colors",
        isActive ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
      {item.label}
    </Link>
  );
}
