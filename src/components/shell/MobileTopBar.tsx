"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";

import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { IconButton } from "@/components/ui/IconButton";
import { logOutAction } from "@/lib/auth/actions";

type MobileTopBarProps = {
  email: string | null;
};

export function MobileTopBar({ email }: Readonly<MobileTopBarProps>) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b border-mobile-nav-border bg-mobile-nav px-4 lg:hidden">
      <Link href="/app" className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
        >
          P
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          PENRA Money OS
        </span>
      </Link>

      <div className="flex items-center gap-1">
        <ThemeSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              icon={<User className="size-4" aria-hidden="true" />}
              aria-label="Account menu"
              variant="ghost"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
      </div>
    </header>
  );
}
