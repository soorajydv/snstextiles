export const ROLES = ['owner', 'design', 'cutting', 'printing', 'stitching', 'finishing', 'accounts', 'customer'] as const;
export type BuiltInRole = (typeof ROLES)[number];
export type Role = string;
export const STAFF_ROLES: BuiltInRole[] = ROLES.filter((r) => r !== 'customer');

/** Feature permissions used by the API and mirrored by the frontend for UI visibility. */
export const PERMISSIONS = [
  'dashboard.view',
  'orders.view', 'orders.create', 'orders.update', 'orders.delete', 'orders.artwork.upload', 'orders.approve', 'orders.feedback', 'orders.stage.complete', 'orders.send_back', 'orders.deliver', 'orders.invoice',
  'customers.view', 'customers.manage', 'customers.delete',
  'payments.view', 'payments.record', 'payments.verify', 'payments.delete',
  'inventory.view', 'inventory.manage', 'inventory.move', 'inventory.adjust',
  'reports.view', 'users.manage', 'settings.view', 'settings.manage', 'audit.view',
  'roles.manage',
  'profile.manage', 'account.delete',
  'attendance.view', 'attendance.checkin', 'attendance.checkout', 'attendance.approve',
  'site.view', 'site.manage', 'site.enquiries',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const allPermissions = [...PERMISSIONS] as Permission[];
const profilePermissions: Permission[] = ['profile.manage', 'account.delete'];
const staffAttendance: Permission[] = ['attendance.view', 'attendance.checkin', 'attendance.checkout'];

export const ROLE_PERMISSIONS: Record<BuiltInRole, Permission[]> = {
  owner: allPermissions,
  design: ['dashboard.view', 'orders.view', 'orders.artwork.upload', 'orders.feedback', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  cutting: ['dashboard.view', 'orders.view', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  printing: ['dashboard.view', 'orders.view', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  stitching: ['dashboard.view', 'orders.view', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  finishing: ['dashboard.view', 'orders.view', 'orders.stage.complete', 'inventory.view', 'inventory.move', 'settings.view', ...staffAttendance, ...profilePermissions],
  accounts: ['dashboard.view', 'orders.view', 'orders.create', 'orders.update', 'orders.invoice', 'customers.view', 'customers.manage', 'payments.view', 'payments.record', 'payments.verify', 'reports.view', 'settings.view', 'site.view', 'site.enquiries', ...staffAttendance, ...profilePermissions],
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
