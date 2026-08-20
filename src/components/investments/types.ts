/** Plain, RSC-serializable account option for an investment form — same shape as src/components/recurring/types.ts's RecurringAccountOption. */
export type InvestmentAccountOption = {
  id: string;
  name: string;
  accountType: string;
  displayBalance: string;
};

/** Plain, RSC-serializable category option for an investment activity form. */
export type InvestmentCategoryOption = {
  id: string;
  name: string;
};
