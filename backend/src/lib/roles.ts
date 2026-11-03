import { Role as RoleModel } from '../models/Role';
import { permissionsForRole, ROLE_PERMISSIONS, ROLES, type Permission } from './constants';

const BUILT_IN_NAMES: Record<(typeof ROLES)[number], string> = {
  owner: 'Owner / Admin',
  design: 'Design team',
  cutting: 'Cutting team',
  printing: 'Printing team',
  stitching: 'Stitching team',
  finishing: 'Finishing team',
  accounts: 'Accounts',
  customer: 'Customer',
};

export async function ensureSystemRoles() {
  await Promise.all(ROLES.map((key) => RoleModel.updateOne(
    { key },
    { $setOnInsert: { key, name: BUILT_IN_NAMES[key], permissions: ROLE_PERMISSIONS[key], system: true } },
    { upsert: true },
  )));
}

export async function permissionsForUserRole(role: string): Promise<Permission[]> {
  const stored = await RoleModel.findOne({ key: role }).select('permissions').lean();
  return stored?.permissions?.length ? stored.permissions as Permission[] : permissionsForRole(role);
}

export async function listRoles() {
  await ensureSystemRoles();
  return RoleModel.find().sort({ system: -1, name: 1 }).lean();
}

export async function roleExists(key: string) {
  if (ROLES.includes(key as (typeof ROLES)[number])) return true;
  return !!(await RoleModel.exists({ key, system: false }));
}
