import { AuditLog } from './audit.model';
import { getSettings } from '../settings/settings.model';
import type { AuthUser } from '../../middleware/auth';

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
