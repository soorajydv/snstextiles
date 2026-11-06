/**
 * Report endpoints take only optional query parameters, which the services read leniently
 * (invalid values fall back to sensible defaults), so there is no zod schema here.
 */
export type ReportRangeQuery = { from?: unknown; to?: unknown };
