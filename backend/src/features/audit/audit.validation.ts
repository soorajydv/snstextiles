/**
 * The audit log list takes only optional query filters (pagination, action, free-text search),
 * which the service reads leniently, so there is no zod schema here.
 */
export type AuditQuery = Record<string, string | undefined>;
