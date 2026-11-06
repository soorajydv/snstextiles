import { Router } from 'express';
import { AuditLog } from './audit.model';
import { requirePermission } from '../../middleware/auth';
import { escapeRegex, pagination } from '../../lib/http';

export const auditRouter = Router();
auditRouter.get('/', requirePermission('audit.view'), async (req, res) => {
  const { limit, skip, page } = pagination(req.query as Record<string, unknown>, 50);
  const query = req.query as Record<string, string | undefined>;
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
  res.json({
    logs: logs.map((l) => ({ id: String(l._id), actorName: l.actorName, actorRole: l.actorRole, action: l.action, entity: l.entity, entityId: l.entityId, summary: l.summary, at: l.createdAt })),
    total,
    page,
    limit,
    actions: await AuditLog.distinct('action'),
  });
});
