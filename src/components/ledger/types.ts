/**
 * Plain, RSC-serializable shape for passing an account into a client
 * transaction form. AccountWithBalance (src/lib/accounts/queries.ts)
 * carries a Decimal, which is a class instance and cannot cross the
 * Server -> Client Component prop boundary — displayBalance here is
 * already a string.
 */
export type AccountOption = {
  id: string;
  name: string;
  accountType: string;
  displayBalance: string;
};

/** Plain, RSC-serializable shape for passing a category into a client transaction form. */
export type CategoryOption = {
  id: string;
  name: string;
};
