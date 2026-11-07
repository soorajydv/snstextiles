/**
 * Optional modules switched on in the frontend environment (inlined at build time).
 * The public website / online shop and everything about it in the portal stay hidden
 * unless NEXT_PUBLIC_WEBSITE_ENABLED=true.
 */
export const WEBSITE_ENABLED = process.env.NEXT_PUBLIC_WEBSITE_ENABLED === 'true';
