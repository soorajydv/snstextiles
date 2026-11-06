/**
 * The dashboard takes a single optional query hint (`recentOrdersSort=recent`); anything else
 * falls back to the default deadline ordering, so there is no zod schema here.
 */
export type RecentOrdersSort = unknown;
