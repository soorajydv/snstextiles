import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import { avatarUpload } from '../../lib/uploads';
import {
  getLogoController,
  getSettingsController,
  removeBusinessLogoController,
  updateAuditRetentionController,
  updateBusinessLogoController,
  updateSettingsController,
} from './settings.controller';

export const settingsRouter = Router();

settingsRouter.get('/', requirePermission('settings.view'), getSettingsController);
settingsRouter.put('/', requirePermission('settings.update'), updateSettingsController);
settingsRouter.patch('/audit-retention', requirePermission('audit.retention.update'), updateAuditRetentionController);
settingsRouter.get('/logo', requirePermission('settings.view'), getLogoController);
settingsRouter.patch('/business-logo', requirePermission('settings.update'), avatarUpload.single('logo'), updateBusinessLogoController);
settingsRouter.delete('/business-logo', requirePermission('settings.update'), removeBusinessLogoController);
