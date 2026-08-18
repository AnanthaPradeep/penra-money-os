import type { Tables } from "@/types/database.types";

export const INSTITUTION_TYPES = [
  "bank",
  "wallet",
  "credit_union",
  "broker",
  "lender",
  "other",
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  bank: "Bank",
  wallet: "Wallet",
  credit_union: "Credit union",
  broker: "Broker",
  lender: "Lender",
  other: "Other",
};

/** A row of `public.institutions` (see supabase/migrations), from the generated Database type. */
export type InstitutionRow = Tables<"institutions">;
