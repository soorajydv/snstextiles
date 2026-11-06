export const ROLES = ['owner', 'design', 'cutting', 'printing', 'stitching', 'finishing', 'accounts', 'customer'] as const;
export type BuiltInRole = (typeof ROLES)[number];
export type Role = string;
export const STAFF_ROLES: BuiltInRole[] = ROLES.filter((r) => r !== 'customer');

/** Feature permissions used by the API and mirrored by the frontend for UI visibility. */
export const PERMISSIONS = [
  'dashboard.view',
  'orders.view', 'orders.create', 'orders.update', 'orders.delete', 'orders.artwork.upload', 'orders.approve', 'orders.feedback', 'orders.stage.complete', 'orders.send_back', 'orders.deliver', 'orders.invoice',
  'customers.view', 'customers.create', 'customers.update', 'customers.delete',
  'payments.view', 'payments.record', 'payments.verify', 'payments.delete',
  'inventory.view', 'inventory.create', 'inventory.update', 'inventory.move', 'inventory.adjust', 'inventory.suppliers.create',
  'reports.view',
  'users.view', 'users.create', 'users.update', 'users.password_reset', 'users.delete',
  'roles.view', 'roles.create', 'roles.update', 'roles.delete',
  'settings.view', 'settings.update',
  'audit.view', 'audit.retention.update',
  'profile.update', 'account.delete',
  'attendance.view', 'attendance.checkin', 'attendance.checkout', 'attendance.approve',
  'site.overview',
  'site.settings.view', 'site.settings.update',
  'site.media.view', 'site.media.upload', 'site.media.delete',
  'site.categories.view', 'site.categories.create', 'site.categories.update', 'site.categories.delete',
  'site.products.view', 'site.products.create', 'site.products.update', 'site.products.delete', 'site.products.import',
  'site.pages.view', 'site.pages.create', 'site.pages.update', 'site.pages.delete',
  'site.posts.view', 'site.posts.create', 'site.posts.update', 'site.posts.delete',
  'site.enquiries.view', 'site.enquiries.update', 'site.enquiries.delete',
  'site.reviews.view', 'site.reviews.moderate', 'site.reviews.delete',
  'site.subscribers.view', 'site.subscribers.export', 'site.subscribers.delete',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Broad permissions that were split into one permission per action. Roles stored with an old key are
 * migrated once at startup (see ensureSystemRoles) so they keep exactly the access they had.
 */
export const LEGACY_PERMISSIONS: Record<string, Permission[]> = {
  'customers.manage': ['customers.create', 'customers.update'],
  'inventory.manage': ['inventory.create', 'inventory.update', 'inventory.suppliers.create'],
  'users.manage': ['users.view', 'users.create', 'users.update', 'users.password_reset', 'users.delete'],
  'roles.manage': ['roles.view', 'roles.create', 'roles.update', 'roles.delete'],
  'settings.manage': ['settings.update', 'audit.retention.update'],
  'profile.manage': ['profile.update'],
  'site.view': ['site.overview', 'site.settings.view', 'site.media.view', 'site.categories.view', 'site.products.view', 'site.pages.view', 'site.posts.view', 'site.reviews.view', 'site.subscribers.view', 'site.subscribers.export'],
  'site.manage': [
    'site.settings.update', 'site.media.upload', 'site.media.delete',
    'site.categories.create', 'site.categories.update', 'site.categories.delete',
    'site.products.create', 'site.products.update', 'site.products.delete', 'site.products.import',
    'site.pages.create', 'site.pages.update', 'site.pages.delete',
    'site.posts.create', 'site.posts.update', 'site.posts.delete',
    'site.reviews.moderate', 'site.reviews.delete', 'site.subscribers.delete',
  ],
  'site.enquiries': ['site.enquiries.view', 'site.enquiries.update', 'site.enquiries.delete'],
};

const allPermissions = [...PERMISSIONS] as Permission[];
const profilePermissions: Permission[] = ['profile.update', 'account.delete'];
const staffAttendance: Permission[] = ['attendance.view', 'attendance.checkin', 'attendance.checkout'];

export const ROLE_PERMISSIONS: Record<BuiltInRole, Permission[]> = {
  owner: allPermissions,
  design: ['dashboard.view', 'orders.view', 'orders.artwork.upload', 'orders.feedback', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  cutting: ['dashboard.view', 'orders.view', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  printing: ['dashboard.view', 'orders.view', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  stitching: ['dashboard.view', 'orders.view', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  finishing: ['dashboard.view', 'orders.view', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  accounts: ['dashboard.view', 'orders.view', 'orders.create', 'orders.update', 'orders.invoice', 'customers.view', 'customers.create', 'customers.update', 'payments.view', 'payments.record', 'payments.verify', 'reports.view', 'settings.view', ...LEGACY_PERMISSIONS['site.view'], ...LEGACY_PERMISSIONS['site.enquiries'], ...staffAttendance, ...profilePermissions],
  customer: ['dashboard.view', 'orders.view', 'orders.create', 'orders.approve', 'orders.feedback', 'payments.view', 'payments.record', 'settings.view', ...profilePermissions],
};

export function permissionsForRole(role: Role) {
  return ROLE_PERMISSIONS[role as BuiltInRole] ?? [];
}

/** Roles allowed to see prices, payments and invoices (customers see only their own). */
export const FINANCE_ROLES: Role[] = ['owner', 'accounts', 'customer'];

export const STAGES = ['design', 'printing', 'stitching', 'finishing', 'ready', 'delivered'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  design: 'Design & confirmation',
  printing: 'Printing',
  stitching: 'Stitching',
  finishing: 'Finishing',
  ready: 'Ready to dispatch',
  delivered: 'Delivered',
};

/** The department that is allowed to complete each stage (owner can always act). */
export const STAGE_DEPARTMENT: Partial<Record<Stage, Role>> = {
  design: 'design',
  printing: 'printing',
  stitching: 'stitching',
  finishing: 'finishing',
};

/** Production roles only see the queues they work on. */
export const ROLE_STAGES: Partial<Record<Role, Stage[]>> = {
  design: ['design'],
  printing: ['printing'],
  stitching: ['stitching'],
  finishing: ['finishing', 'ready'],
};

export const PRODUCT_CONFIGS = [
  'Front sublimation jersey with plain shorts',
  'Front + back sublimation jersey with plain shorts',
  'Full sublimation jersey with plain shorts',
  'Full sublimation jersey and full sublimation shorts',
  'Front sublimation jersey with plain trouser',
  'Front + back sublimation jersey with plain trouser',
  'Full sublimation jersey with plain trouser',
  'Full sublimation jersey and full sublimation trouser',
  'Jersey only — front sublimation',
  'Jersey only — front + back sublimation',
  'Jersey only — full sublimation',
] as const;

export const NECK_TYPES = ['Round neck', 'V neck', 'Polo neck', 'IPL neck', 'Band neck'] as const;
export const SLEEVES = ['Half sleeve', 'Full sleeve'] as const;
export const SIZES = ['', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] as const;
export const PAYMENT_METHODS = ['Cash', 'Bank transfer', 'Cheque', 'eSewa', 'Khalti', 'Fonepay', 'Other'] as const;
export const DELIVERY_METHODS = ['Customer pickup', 'Own vehicle', 'Courier', 'Bus cargo', 'Other'] as const;
