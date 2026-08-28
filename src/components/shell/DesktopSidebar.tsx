"use client";

import { LogOut, PlusCircle, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DesktopNavItem } from "@/components/shell/DesktopNavItem";
import {
  isNavItemActive,
  NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
} from "@/components/shell/nav-items";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { logOutAction } from "@/lib/auth/actions";

type DesktopSidebarProps = {
  displayName: string | null;
  email: string | null;
};

export function DesktopSidebar({
  displayName,
  email,
}: Readonly<DesktopSidebarProps>) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex print:hidden">
      <div className="flex h-16 items-center gap-2 px-5">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        >
          P
        </span>
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          PENRA Money OS
        </span>
      </div>

      <div className="px-3">
        <Button asChild className="w-full justify-start" size="md">
          <Link href="/app/transactions/new">
            <PlusCircle aria-hidden="true" className="size-4" />
            New transaction
          </Link>
        </Button>
      </div>

      <nav
        aria-label="Primary"
        className="flex flex-1 flex-col gap-1 px-3 py-4"
      >
        {NAV_ITEMS.map((item) => (
          <DesktopNavItem
            key={item.href}
            item={item}
            isActive={isNavItemActive(pathname, item.href)}
          />
        ))}
        <div className="my-2 border-t border-sidebar-border" />
        {SECONDARY_NAV_ITEMS.map((item) => (
          <DesktopNavItem
            key={item.href}
            item={item}
            isActive={isNavItemActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-sidebar-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-active/60"
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted-surface text-muted-foreground"
              >
                <User className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">
                {displayName ?? email ?? "Your account"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {email ? (
              <>
                <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
                <p className="truncate px-2.5 pb-1.5 text-sm text-muted-foreground">
                  {email}
                </p>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href="/app/settings/profile">
                <User aria-hidden="true" className="size-4" />
                Profile settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={logOutAction}>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-negative outline-none select-none hover:bg-negative-surface"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Log out
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeSwitcher />
      </div>
    </aside>
  );
}
