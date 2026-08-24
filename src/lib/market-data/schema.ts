import { z } from "zod";

import { MARKET_INSTRUMENT_KINDS } from "@/lib/market-data/types";

const uuidRequired = z.uuid("Choose a valid option.");

export const searchMarketInstrumentsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Enter a name, scheme code, or ISIN to search.")
    .max(160, "Search text must be 160 characters or fewer."),
  instrumentKind: z.enum(MARKET_INSTRUMENT_KINDS).optional(),
});
export type SearchMarketInstrumentsInput = z.infer<
  typeof searchMarketInstrumentsSchema
>;

export const linkMarketInstrumentSchema = z.object({
  assetId: uuidRequired,
  marketInstrumentId: uuidRequired,
  confirmRemap: z
    .string()
    .optional()
    .transform((raw) => raw === "true"),
});
export type LinkMarketInstrumentInput = z.infer<
  typeof linkMarketInstrumentSchema
>;

export const unlinkMarketInstrumentSchema = z.object({
  assetId: uuidRequired,
});
export type UnlinkMarketInstrumentInput = z.infer<
  typeof unlinkMarketInstrumentSchema
>;
