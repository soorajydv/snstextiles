import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import { listAuditLogsController } from './audit.controller';

export const auditRouter = Router();
auditRouter.get('/', requirePermission('audit.view'), listAuditLogsController);
