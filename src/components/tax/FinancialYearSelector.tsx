"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/Select";

type FinancialYearSelectorProps = {
  financialYearId: string;
  options: string[];
  basePath?: string;
};

/** A financial-year picker that navigates to the equivalent sub-route for the chosen year — e.g. switching from /app/tax/2025-26/income to /app/tax/2024-25/income. */
export function FinancialYearSelector({
  financialYearId,
  options,
  basePath = "/app/tax",
}: Readonly<FinancialYearSelectorProps>) {
  const router = useRouter();

  return (
    <div className="w-40">
      <Select
        id="financial-year-selector"
        name="financialYear"
        label="Financial year"
        options={options.map((id) => ({ value: id, label: `FY ${id}` }))}
        defaultValue={financialYearId}
        onChange={(event) => {
          const nextFy = event.target.value;
          const suffix =
            typeof window !== "undefined"
              ? window.location.pathname.split(
                  `${basePath}/${financialYearId}`,
                )[1]
              : "";
          router.push(`${basePath}/${nextFy}${suffix ?? ""}`);
        }}
      />
    </div>
  );
}
