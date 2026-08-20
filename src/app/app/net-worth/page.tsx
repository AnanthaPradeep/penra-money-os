import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getNetWorthSummaries } from "@/lib/investments/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Net worth — PENRA Money OS",
};

export default async function NetWorthPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/net-worth");
  }

  const supabase = await createSupabaseServerClient();
  const summaries = await getNetWorthSummaries(supabase);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        title="Net worth"
        description="Assets minus liabilities, calculated entirely from your ledger and manual valuations — never fetched or estimated."
      />

      {summaries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing to show yet — add an account or an investment to see your net
          worth.
        </p>
      ) : (
        summaries.map((summary) => (
          <div key={summary.currency} className="flex flex-col gap-6">
            {summaries.length > 1 ? (
              <SectionHeader title={summary.currency} />
            ) : null}

            <Card>
              <CardContent className="flex flex-col gap-1 p-6 pt-6">
                <p className="text-sm text-muted-foreground">Net worth</p>
                <AmountDisplay value={summary.netWorth} size="xl" />
              </CardContent>
            </Card>

            <section
              aria-labelledby={`assets-heading-${summary.currency}`}
              className="flex flex-col gap-3"
            >
              <SectionHeader
                id={`assets-heading-${summary.currency}`}
                title="Assets"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Cash and bank
                    </p>
                    <AmountDisplay value={summary.cashAndBank} size="lg" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">Investments</p>
                    <AmountDisplay value={summary.investmentValue} size="lg" />
                    <p className="text-xs text-muted-foreground">
                      manually valued or at cost basis
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">PPF</p>
                    <AmountDisplay value={summary.ppfBalance} size="lg" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Fixed deposits
                    </p>
                    <AmountDisplay value={summary.fdValue} size="lg" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Recurring deposits
                    </p>
                    <AmountDisplay value={summary.rdBalance} size="lg" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm font-medium text-foreground">
                      Total assets
                    </p>
                    <AmountDisplay value={summary.totalAssets} size="lg" />
                  </CardContent>
                </Card>
              </div>
            </section>

            <section
              aria-labelledby={`liabilities-heading-${summary.currency}`}
              className="flex flex-col gap-3"
            >
              <SectionHeader
                id={`liabilities-heading-${summary.currency}`}
                title="Liabilities"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Credit card outstanding
                    </p>
                    <AmountDisplay
                      value={summary.creditCardOutstanding}
                      size="lg"
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Other liabilities
                    </p>
                    <AmountDisplay value={summary.otherLiabilities} size="lg" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm font-medium text-foreground">
                      Total liabilities
                    </p>
                    <AmountDisplay value={summary.totalLiabilities} size="lg" />
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>
        ))
      )}

      <div className="flex gap-4 text-sm">
        <Link
          href="/app/investments"
          className="font-medium text-primary hover:underline"
        >
          View investments
        </Link>
        <Link
          href="/app/accounts"
          className="font-medium text-primary hover:underline"
        >
          View accounts
        </Link>
      </div>
    </div>
  );
}
