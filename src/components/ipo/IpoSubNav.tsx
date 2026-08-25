"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/ui/cn";

type IpoSubNavProps = {
  ipoId: string;
};

/** The Overview/Documents/Financials/Research tab strip shared by every IPO detail sub-route — mirrors src/components/research/CompanySubNav.tsx. */
export function IpoSubNav({ ipoId }: Readonly<IpoSubNavProps>) {
  const pathname = usePathname();
  const base = `/app/ipos/${ipoId}`;

  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/documents`, label: "Documents" },
    { href: `${base}/financials`, label: "Financials" },
    { href: `${base}/research`, label: "Research" },
  ];

  return (
    <nav
      aria-label="IPO sections"
      className="flex gap-1 overflow-x-auto border-b border-border"
    >
      {tabs.map((tab) => {
        const isActive =
          tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
