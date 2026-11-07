import { AuditLog } from './audit.model';
import { getSettings } from '../settings/settings.model';
import type { AuthUser } from '../../middleware/auth';
import { escapeRegex, pagination } from '../../lib/http';
import type { AuditQuery } from './audit.validation';

/** Records a critical action. Failures are logged but never break the request. */
export async function audit(user: AuthUser | null, action: string, entity: string, entityId: string, summary: string) {
  try {
    const settings = await getSettings();
    const expiresAt = new Date(Date.now() + settings.auditRetentionDays * 24 * 60 * 60 * 1000);
    await AuditLog.create({
      actor: user?.id ?? null,
      actorName: user?.name ?? 'system',
      actorRole: user?.role ?? '',
      action,
      entity,
      entityId,
      summary,
      expiresAt,
    });
  } catch (err) {
    console.error('Failed to write audit log', err);
  }
}

export async function listAuditLogs(query: AuditQuery) {
  const { limit, skip, page } = pagination(query as Record<string, unknown>, 50);
  const filter: Record<string, unknown> = {};
  if (query.action?.trim()) filter.action = query.action.trim();
  if (query.search?.trim()) {
    const rx = { $regex: escapeRegex(query.search.trim()), $options: 'i' };
    filter.$or = [
      { actorName: rx },
      { actorRole: rx },
      { action: rx },
      { entity: rx },
      { entityId: rx },
      { summary: rx },
    ];
  }
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    logs: logs.map((l) => ({ id: String(l._id), actorName: l.actorName, actorRole: l.actorRole, action: l.action, entity: l.entity, entityId: l.entityId, summary: l.summary, at: l.createdAt })),
    total,
    page,
    limit,
    actions: await AuditLog.distinct('action'),
  };
}
