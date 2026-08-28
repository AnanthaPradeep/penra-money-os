import {
  CalendarClock,
  CreditCard,
  FileUp,
  Home,
  Landmark,
  LineChart,
  ListTree,
  PiggyBank,
  PlusCircle,
  Receipt,
  Repeat,
  Rocket,
  Scale,
  Search,
  Settings,
  Star,
  Target,
  TrendingUp,
  Wallet,
  Wallet2,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

/**
 * The core mobile bottom-nav routes — deliberately unchanged from Phase 4
 * (Home/Accounts/Add transaction/Profile). A phone-width bottom bar has no
 * room for more without becoming cramped, so Transactions/Categories are
 * desktop-sidebar-only (see SECONDARY_NAV_ITEMS below) rather than added
 * here; both are still reachable on mobile via in-page links ("View all
 * transactions", the transaction composer's category picker, etc.).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/accounts", label: "Accounts", icon: Wallet },
  { href: "/app/transactions/new", label: "Add transaction", icon: PlusCircle },
  { href: "/app/settings/profile", label: "Profile", icon: Settings },
];

/** Extra desktop-sidebar-only links — see the NAV_ITEMS comment for why these aren't in the shared (mobile + desktop) list. */
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/app/transactions", label: "Transactions", icon: Receipt },
  { href: "/app/import", label: "Import", icon: FileUp },
  { href: "/app/categories", label: "Categories", icon: ListTree },
  { href: "/app/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/app/wallets", label: "Wallets", icon: Wallet2 },
  { href: "/app/goals", label: "Goals", icon: Target },
  { href: "/app/debts", label: "Debts", icon: CreditCard },
  { href: "/app/forecast", label: "Forecast", icon: LineChart },
  { href: "/app/tax", label: "Tax", icon: Landmark },
  { href: "/app/recurring", label: "Recurring", icon: Repeat },
  { href: "/app/investments", label: "Investments", icon: TrendingUp },
  { href: "/app/net-worth", label: "Net worth", icon: Scale },
  { href: "/app/watchlists", label: "Watchlists", icon: Star },
  { href: "/app/research", label: "Research", icon: Search },
  { href: "/app/ipos", label: "IPOs", icon: Rocket },
  { href: "/app/events", label: "Events", icon: CalendarClock },
];

/** True when `pathname` is on this nav item's route, including its own sub-routes (e.g. /app/accounts/[id] still highlights "Accounts"). */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
