import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { parse } from '../../lib/http';
import {
  getLogoFile, getMeta, getSettingsDto, removeBusinessLogo, updateAuditRetention, updateBusinessLogo, updateSettings,
} from './settings.service';
import { auditRetentionSchema, settingsSchema } from './settings.validation';

export async function getSettingsController(_req: Request, res: Response) {
  res.json(await getSettingsDto());
}

export async function updateSettingsController(req: Request, res: Response) {
  const user = currentUser(req);
  const body = parse(settingsSchema, req.body);
  res.json(await updateSettings(user, body));
}

export async function updateAuditRetentionController(req: Request, res: Response) {
  const user = currentUser(req);
  const body = parse(auditRetentionSchema, req.body);
  res.json(await updateAuditRetention(user, body));
}

export async function getLogoController(_req: Request, res: Response) {
  const logo = await getLogoFile();
  if (!logo) { res.status(404).end(); return; }
  res.type(logo.mimeType).sendFile(logo.path, (err) => { if (err && !res.headersSent) res.status(404).end(); });
}

export async function updateBusinessLogoController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await updateBusinessLogo(user, req.file));
}

export async function removeBusinessLogoController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await removeBusinessLogo(user));
}

export async function metaController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await getMeta(user));
}
