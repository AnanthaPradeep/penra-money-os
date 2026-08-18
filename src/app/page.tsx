import { ArrowRight, Landmark, Lock, ScrollText } from "lucide-react";
import Link from "next/link";

import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { Button } from "@/components/ui/Button";

const PILLARS = [
  {
    icon: Landmark,
    title: "Accounts you actually hold",
    description:
      "Bank, cash, wallet, credit card, and loan accounts — organised the way your money really moves, not the way an app template assumes it does.",
  },
  {
    icon: ScrollText,
    title: "A ledger, not a spreadsheet",
    description:
      "Every transaction is recorded as a balanced, auditable double-entry — the same discipline real accounting systems use, kept private to you.",
  },
  {
    icon: Lock,
    title: "Private by default",
    description:
      "This is a personal system, not a social one. Your data is never sold, shared, or used to train anything — it exists to serve you.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
          >
            P
          </span>
          <span className="text-base font-semibold tracking-tight">
            PENRA Money OS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-16 px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <section className="flex flex-col items-start gap-6">
          <span className="w-fit rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            A private money operating system
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Your private personal money operating system.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            PENRA Money OS keeps a calm, accurate record of your accounts and
            transactions — built on an auditable double-entry ledger, and built
            for one person: you.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/signup">
                Create your account
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </section>

        <section
          aria-label="What PENRA Money OS manages"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5"
            >
              <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <pillar.icon aria-hidden="true" className="size-5" />
              </span>
              <h2 className="text-base font-semibold text-foreground">
                {pillar.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {pillar.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
        PENRA Money OS
      </footer>
    </div>
  );
}
