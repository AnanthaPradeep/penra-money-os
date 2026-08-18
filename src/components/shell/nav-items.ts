import { Home, PlusCircle, Settings, Wallet } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

/**
 * The complete, deliberately short navigation for this phase — only
 * routes that actually exist. Investments/budgets/subscriptions are not
 * listed at all rather than shown disabled, per the product direction for
 * this phase.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/accounts", label: "Accounts", icon: Wallet },
  { href: "/app/transactions/new", label: "Add transaction", icon: PlusCircle },
  { href: "/app/settings/profile", label: "Profile", icon: Settings },
];

/** True when `pathname` is on this nav item's route, including its own sub-routes (e.g. /app/accounts/[id] still highlights "Accounts"). */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
