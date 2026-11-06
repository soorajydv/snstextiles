import { getSettings, Settings } from './settings.model';
import type { AuthUser } from '../../middleware/auth';
import {
  DELIVERY_METHODS, NECK_TYPES, PAYMENT_METHODS, PERMISSIONS, PRODUCT_CONFIGS, SIZES, SLEEVES, STAGE_LABELS, STAGES,
} from '../../lib/constants';
import { listRoles, permissionsForUserRole } from '../roles/roles.service';
import { INVENTORY_CATEGORIES } from '../inventory/inventory.model';
import { badRequest } from '../../lib/http';
import { audit } from '../audit/audit.service';
import { removeStoredFile, storedFilePath } from '../../lib/uploads';
import type { AuditRetentionInput, SettingsInput } from './settings.validation';

const dto = (s: Record<string, any>) => ({
  businessName: s.businessName,
  logoUrl: s.logoStoredName ? '/api/settings/logo' : '',
  address: s.address,
  phone: s.phone,
  email: s.email,
  panNumber: s.panNumber,
  currency: s.currency,
  timezone: s.timezone,
  orderPrefix: s.orderPrefix,
  invoicePrefix: s.invoicePrefix,
  dueSoonDays: s.dueSoonDays,
  auditRetentionDays: s.auditRetentionDays,
  invoiceFooter: s.invoiceFooter,
});

export async function getSettingsDto() {
  return { settings: dto((await getSettings()).toObject()) };
}

export async function updateSettings(user: AuthUser, body: SettingsInput) {
  await getSettings();
  const saved = await Settings.findByIdAndUpdate('global', body, { returnDocument: 'after' }).lean();
  await audit(user, 'settings.updated', 'Settings', 'global', 'Updated business settings');
  return { settings: dto(saved!) };
}

export async function updateAuditRetention(user: AuthUser, body: AuditRetentionInput) {
  const saved = await Settings.findByIdAndUpdate('global', body, { returnDocument: 'after' }).lean();
  await audit(user, 'settings.audit_retention.updated', 'Settings', 'global', `Set audit-log retention to ${body.auditRetentionDays} days`);
  return { auditRetentionDays: saved?.auditRetentionDays };
}

/** The stored logo file, or null when no logo has been uploaded. */
export async function getLogoFile() {
  const settings = await getSettings();
  if (!settings.logoStoredName) return null;
  return { mimeType: settings.logoMimeType ?? 'application/octet-stream', path: storedFilePath(settings.logoStoredName) };
}

export async function updateBusinessLogo(user: AuthUser, file: Express.Multer.File | undefined) {
  if (!file) throw badRequest('logo: Select an image to upload');
  const settings = await getSettings();
  const previous = settings.logoStoredName;
  settings.logoStoredName = file.filename;
  settings.logoMimeType = file.mimetype;
  await settings.save();
  removeStoredFile(previous);
  await audit(user, 'settings.business_logo_updated', 'Settings', 'global', 'Updated the business profile logo');
  return { settings: dto(settings.toObject()) };
}

export async function removeBusinessLogo(user: AuthUser) {
  const settings = await getSettings();
  const previous = settings.logoStoredName;
  settings.logoStoredName = null;
  settings.logoMimeType = null;
  await settings.save();
  removeStoredFile(previous);
  await audit(user, 'settings.business_logo_removed', 'Settings', 'global', 'Removed the business profile logo');
  return { settings: dto(settings.toObject()) };
}

/** Static option lists so the frontend never hard-codes business vocabulary. */
export async function getMeta(user: AuthUser) {
  return {
    roles: (await listRoles()).map((role) => ({ key: role.key, name: role.name, description: role.description ?? '', permissions: role.permissions ?? [], system: role.system })),
    stages: STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s] })),
    productConfigs: PRODUCT_CONFIGS,
    neckTypes: NECK_TYPES,
    sleeves: SLEEVES,
    sizes: SIZES.filter(Boolean),
    paymentMethods: PAYMENT_METHODS,
    deliveryMethods: DELIVERY_METHODS,
    inventoryCategories: INVENTORY_CATEGORIES,
    permissions: await permissionsForUserRole(user.role),
    availablePermissions: PERMISSIONS,
  };
}
