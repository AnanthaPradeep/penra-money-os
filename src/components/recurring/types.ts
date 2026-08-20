/** Plain, RSC-serializable account option for a recurring-item form — same shape as src/components/ledger/types.ts's AccountOption. */
export type RecurringAccountOption = {
  id: string;
  name: string;
  accountType: string;
  displayBalance: string;
};

/** Plain, RSC-serializable category option for a recurring-item form. */
export type RecurringCategoryOption = {
  id: string;
  name: string;
};
