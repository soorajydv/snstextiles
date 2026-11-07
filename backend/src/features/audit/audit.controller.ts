import type { Request, Response } from 'express';
import { listAuditLogs } from './audit.service';
import type { AuditQuery } from './audit.validation';

export async function listAuditLogsController(req: Request, res: Response) {
  res.json(await listAuditLogs(req.query as AuditQuery));
}
