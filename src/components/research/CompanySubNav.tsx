"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/ui/cn";

type CompanySubNavProps = {
  instrumentId: string;
};

/** The Overview/Financials/Notes/Thesis tab strip shared by every company-research sub-route. */
export function CompanySubNav({ instrumentId }: Readonly<CompanySubNavProps>) {
  const pathname = usePathname();
  const base = `/app/research/companies/${instrumentId}`;

  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/financials`, label: "Financials" },
    { href: `${base}/notes`, label: "Notes" },
    { href: `${base}/thesis`, label: "Thesis" },
  ];

  return (
    <nav
      aria-label="Company research sections"
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
