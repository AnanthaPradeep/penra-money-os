import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { TAX_EXPORT_DISCLAIMER } from "@/lib/tax/export/reports";
import { isValidFinancialYearId, parseFinancialYearId } from "@/lib/tax/financial-year";
import {
  INCOME_CATEGORY_LABELS,
  RECONCILIATION_SOURCE_LABELS,
  TAX_ASSET_CLASS_LABELS,
  TAX_PAYMENT_TYPE_LABELS,
  WITHHOLDING_TYPE_LABELS,
} from "@/lib/tax/mapping";
import { formatINR } from "@/lib/money/format";
import { getTaxReviewPackData } from "@/lib/tax/print-pack";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tax review pack — PENRA Money OS" };

type PageProps = { params: Promise<{ financialYear: string }> };

const SECTION = "border-b border-gray-300 py-4 break-inside-avoid";
const TABLE_HEAD =
  "border-b border-gray-400 py-1 pr-3 text-left font-semibold text-gray-700";
const TABLE_CELL = "border-b border-gray-200 py-1 pr-3 align-top";

export default async function TaxReviewPackPrintPage({
  params,
}: Readonly<PageProps>) {
  const { financialYear } = await params;
  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}/reports/print`);
  }

  const fy = parseFinancialYearId(financialYear);
  const supabase = await createSupabaseServerClient();
  const data = await getTaxReviewPackData(supabase, fy);

  const warnings: string[] = [];
  if (!data.ruleSetLookup.available) {
    warnings.push(`No versioned tax rule set is published for ${fy.label} yet.`);
  }
  if (data.capitalGains && data.capitalGains.report.status === "partial") {
    warnings.push(
      "Some capital-gains disposals could not be fully matched or classified.",
    );
  }
  if (data.capitalGains && data.capitalGains.unclassifiedHoldingCount > 0) {
    warnings.push(
      `${data.capitalGains.unclassifiedHoldingCount} investment holding(s) are not yet classified for tax purposes.`,
    );
  }
  if (data.capitalGains && data.capitalGains.mixedCurrencyHoldingCount > 0) {
    warnings.push(
      `${data.capitalGains.mixedCurrencyHoldingCount} investment holding(s) have activities in more than one currency and are excluded from capital-gains matching.`,
    );
  }
  if (!data.regimeComparison || !data.regimeComparison.available) {
    warnings.push(
      data.regimeComparison && !data.regimeComparison.available
        ? data.regimeComparison.reasonCode === "no_profile"
          ? "Old vs new regime comparison unavailable — no tax profile set up."
          : "Old vs new regime comparison unavailable — profile outside supported scope."
        : "Old vs new regime comparison unavailable for this financial year.",
    );
  }

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-sm text-gray-900 print:p-0">
      <div className="mb-2 flex items-center justify-between print:hidden">
        <p className="text-xs text-gray-500">
          Use your browser&apos;s Print (Ctrl/Cmd+P) and choose &ldquo;Save as
          PDF&rdquo; to export this page.
        </p>
      </div>

      <header className={SECTION}>
        <p className="text-lg font-bold">PENRA — Tax review pack</p>
        <p>
          {fy.label} ({fy.assessmentYearLabel})
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-700">
          <div>
            <dt className="inline font-medium">Generated: </dt>
            <dd className="inline">{formatIstDateTime(data.generatedAt)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Currency: </dt>
            <dd className="inline">INR</dd>
          </div>
          <div>
            <dt className="inline font-medium">Rule-set version: </dt>
            <dd className="inline">
              {data.ruleSetLookup.available
                ? data.ruleSetLookup.ruleSet.ruleSetVersion
                : "unavailable"}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Completeness: </dt>
            <dd className="inline">
              {warnings.length === 0 ? "complete" : "partial — see warnings below"}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-gray-600">{TAX_EXPORT_DISCLAIMER}</p>
      </header>

      {warnings.length > 0 ? (
        <section className={SECTION}>
          <p className="font-semibold">Warnings / unsupported items</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-gray-700">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={SECTION}>
        <p className="font-semibold">Tax profile</p>
        {data.profile ? (
          <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div>
              <dt className="inline font-medium">Residential status: </dt>
              <dd className="inline">{data.profile.residentialStatus}</dd>
            </div>
            <div>
              <dt className="inline font-medium">PAN (masked): </dt>
              <dd className="inline">{data.profile.maskedPanLabel ?? "not recorded"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Business/professional income: </dt>
              <dd className="inline">
                {data.profile.hasBusinessOrProfessionalIncome ? "yes" : "no"}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Salary/pension income: </dt>
              <dd className="inline">
                {data.profile.hasSalaryOrPensionIncome ? "yes" : "no"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-1 text-xs text-gray-600">No tax profile set up.</p>
        )}
      </section>

      <section className={SECTION}>
        <p className="font-semibold">Income</p>
        {data.incomeAdjustments.length === 0 ? (
          <p className="mt-1 text-xs text-gray-600">No income classified.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={TABLE_HEAD}>Category</th>
                <th className={TABLE_HEAD}>Gross</th>
                <th className={TABLE_HEAD}>TDS</th>
                <th className={TABLE_HEAD}>Net</th>
                <th className={TABLE_HEAD}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.incomeAdjustments.map((i) => (
                <tr key={i.id}>
                  <td className={TABLE_CELL}>{INCOME_CATEGORY_LABELS[i.category]}</td>
                  <td className={TABLE_CELL}>{formatINR(i.grossAmount)}</td>
                  <td className={TABLE_CELL}>{formatINR(i.tdsAmount)}</td>
                  <td className={TABLE_CELL}>{formatINR(i.netAmount)}</td>
                  <td className={TABLE_CELL}>{i.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={SECTION}>
        <p className="font-semibold">Capital gains</p>
        {!data.capitalGains ? (
          <p className="mt-1 text-xs text-gray-600">
            Unavailable — no versioned rule set for this financial year.
          </p>
        ) : data.capitalGains.report.lines.length === 0 ? (
          <p className="mt-1 text-xs text-gray-600">No disposals this financial year.</p>
        ) : (
          <>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={TABLE_HEAD}>Instrument</th>
                  <th className={TABLE_HEAD}>Acquired</th>
                  <th className={TABLE_HEAD}>Disposed</th>
                  <th className={TABLE_HEAD}>Term</th>
                  <th className={TABLE_HEAD}>Units</th>
                  <th className={TABLE_HEAD}>Gain/loss</th>
                </tr>
              </thead>
              <tbody>
                {data.capitalGains.report.lines.map((line, idx) => (
                  <tr key={`${line.disposalActivityId}-${line.lotId}-${idx}`}>
                    <td className={TABLE_CELL}>
                      {line.displayName}
                      {line.isinOrSymbol ? ` (${line.isinOrSymbol})` : ""}
                    </td>
                    <td className={TABLE_CELL}>{line.acquisitionDate}</td>
                    <td className={TABLE_CELL}>{line.disposalDate}</td>
                    <td className={TABLE_CELL}>
                      {line.term === "short_term" ? "Short-term" : "Long-term"}
                    </td>
                    <td className={TABLE_CELL}>{line.quantity.toString()}</td>
                    <td className={TABLE_CELL}>{formatINR(line.rawGain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div>
                <dt className="inline font-medium">Total gains: </dt>
                <dd className="inline">{formatINR(data.capitalGains.report.totalGains)}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Total losses: </dt>
                <dd className="inline">{formatINR(data.capitalGains.report.totalLosses)}</dd>
              </div>
              <div>
                <dt className="inline font-medium">u/s 112A LTCG exemption applied: </dt>
                <dd className="inline">
                  {formatINR(data.capitalGains.report.ltcgExemptionApplied)}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Status: </dt>
                <dd className="inline">{data.capitalGains.report.status}</dd>
              </div>
            </dl>
          </>
        )}
      </section>

      <section className={SECTION}>
        <p className="font-semibold">Deductions</p>
        {data.deductions.length === 0 ? (
          <p className="mt-1 text-xs text-gray-600">No deductions recorded.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={TABLE_HEAD}>Section</th>
                <th className={TABLE_HEAD}>Claimed</th>
                <th className={TABLE_HEAD}>Evidence</th>
                <th className={TABLE_HEAD}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.deductions.map((d) => (
                <tr key={d.id}>
                  <td className={TABLE_CELL}>{d.section}</td>
                  <td className={TABLE_CELL}>{formatINR(d.claimedAmount)}</td>
                  <td className={TABLE_CELL}>{d.evidenceLabel ?? "—"}</td>
                  <td className={TABLE_CELL}>{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={SECTION}>
        <p className="font-semibold">TDS/TCS and payments</p>
        {data.withholdings.length === 0 && data.payments.length === 0 ? (
          <p className="mt-1 text-xs text-gray-600">No TDS/TCS or payments recorded.</p>
        ) : (
          <>
            {data.withholdings.length > 0 ? (
              <table className="mt-2 w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={TABLE_HEAD}>Type</th>
                    <th className={TABLE_HEAD}>Deductor</th>
                    <th className={TABLE_HEAD}>Withheld on</th>
                    <th className={TABLE_HEAD}>Amount</th>
                    <th className={TABLE_HEAD}>Reconciliation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.withholdings.map((w) => (
                    <tr key={w.id}>
                      <td className={TABLE_CELL}>
                        {WITHHOLDING_TYPE_LABELS[w.withholdingType]}
                      </td>
                      <td className={TABLE_CELL}>{w.deductorName}</td>
                      <td className={TABLE_CELL}>{w.withheldOn}</td>
                      <td className={TABLE_CELL}>{formatINR(w.taxWithheld)}</td>
                      <td className={TABLE_CELL}>{w.reconciliationStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {data.payments.length > 0 ? (
              <table className="mt-2 w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={TABLE_HEAD}>Type</th>
                    <th className={TABLE_HEAD}>Paid on</th>
                    <th className={TABLE_HEAD}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id}>
                      <td className={TABLE_CELL}>{TAX_PAYMENT_TYPE_LABELS[p.paymentType]}</td>
                      <td className={TABLE_CELL}>{p.paidOn}</td>
                      <td className={TABLE_CELL}>{formatINR(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </>
        )}
      </section>

      <section className={SECTION}>
        <p className="font-semibold">AIS/26AS reconciliation</p>
        {data.reconciliationItems.length === 0 ? (
          <p className="mt-1 text-xs text-gray-600">No reconciliation items recorded.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={TABLE_HEAD}>Source</th>
                <th className={TABLE_HEAD}>Category</th>
                <th className={TABLE_HEAD}>Reported</th>
                <th className={TABLE_HEAD}>PENRA</th>
                <th className={TABLE_HEAD}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.reconciliationItems.map((r) => (
                <tr key={r.id}>
                  <td className={TABLE_CELL}>{RECONCILIATION_SOURCE_LABELS[r.source]}</td>
                  <td className={TABLE_CELL}>{r.incomeCategory}</td>
                  <td className={TABLE_CELL}>
                    {r.reportedAmount ? formatINR(r.reportedAmount) : "—"}
                  </td>
                  <td className={TABLE_CELL}>
                    {r.penraAmount ? formatINR(r.penraAmount) : "—"}
                  </td>
                  <td className={TABLE_CELL}>{r.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={SECTION}>
        <p className="font-semibold">Old vs new regime (neutral comparison)</p>
        {data.regimeComparison?.available ? (
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={TABLE_HEAD}></th>
                <th className={TABLE_HEAD}>Old regime</th>
                <th className={TABLE_HEAD}>New regime</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={TABLE_CELL}>Taxable ordinary income</td>
                <td className={TABLE_CELL}>
                  {formatINR(data.regimeComparison.result.old.taxableOrdinaryIncome)}
                </td>
                <td className={TABLE_CELL}>
                  {formatINR(data.regimeComparison.result.new.taxableOrdinaryIncome)}
                </td>
              </tr>
              <tr>
                <td className={TABLE_CELL}>Total estimated liability</td>
                <td className={TABLE_CELL}>
                  {formatINR(data.regimeComparison.result.old.totalTaxLiability)}
                </td>
                <td className={TABLE_CELL}>
                  {formatINR(data.regimeComparison.result.new.totalTaxLiability)}
                </td>
              </tr>
              <tr>
                <td className={TABLE_CELL}>Status</td>
                <td className={TABLE_CELL}>{data.regimeComparison.result.old.status}</td>
                <td className={TABLE_CELL}>{data.regimeComparison.result.new.status}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="mt-1 text-xs text-gray-600">
            Unavailable — see warnings above. This comparison is never a recommendation
            of either regime.
          </p>
        )}
      </section>

      <footer className="pt-4 text-xs text-gray-500">
        {TAX_EXPORT_DISCLAIMER} Internal PENRA record identifiers are not shown in this
        pack. Asset classes referenced follow PENRA&apos;s own scope:{" "}
        {Object.values(TAX_ASSET_CLASS_LABELS).join(", ")}.
      </footer>
    </div>
  );
}
