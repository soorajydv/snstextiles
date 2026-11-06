import { Role as RoleModel } from './role.model';
import { User } from '../users/user.model';
import { permissionsForRole, PERMISSIONS, ROLE_PERMISSIONS, ROLES, type Permission } from '../../lib/constants';
import { badRequest, conflict, notFound, parse } from '../../lib/http';
import { audit } from '../audit/audit.service';
import type { AuthUser } from '../../middleware/auth';
import { updateSchema, type RoleInput } from './roles.validation';

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
    { $setOnInsert: { name: BUILT_IN_NAMES[key], permissions: ROLE_PERMISSIONS[key], system: true } },
    { upsert: true },
  )));
  // Clean up the removed permission separately; MongoDB cannot update the same
  // array path with both $setOnInsert and $pull in one operation.
  await RoleModel.updateMany({ key: { $in: ROLES } }, { $pull: { permissions: 'payments.reverse' } });
  // The owner always holds every permission, including ones added after the role was first stored.
  await RoleModel.updateOne({ key: 'owner' }, { $addToSet: { permissions: { $each: ROLE_PERMISSIONS.owner } } });
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

function dto(role: Record<string, any>) {
  return { id: String(role._id), key: role.key, name: role.name, description: role.description ?? '', permissions: role.permissions ?? [], system: !!role.system };
}

export async function listRoleDtos() {
  return { roles: (await listRoles()).map(dto), permissions: PERMISSIONS };
}

export async function createRole(me: AuthUser, body: RoleInput) {
  if (await RoleModel.exists({ key: body.key })) throw conflict('A role with this key already exists');
  const role = await RoleModel.create({ ...body, system: false });
  await audit(me, 'role.created', 'Role', String(role._id), `Created role ${role.name}`);
  return { role: dto(role.toObject()) };
}

/** The body is validated after the role lookup, so an unknown role reports 404 before any field error. */
export async function updateRole(me: AuthUser, key: string, rawBody: unknown) {
  const role = await RoleModel.findOne({ key });
  if (!role) throw notFound('Role not found');
  const body = parse(updateSchema, rawBody);
  if (key === 'owner' && !body.permissions.includes('roles.manage')) {
    throw badRequest('The owner role must retain roles.manage permission');
  }
  const before = new Set(role.permissions);
  const after = new Set(body.permissions);
  const added = body.permissions.filter((permission) => !before.has(permission));
  const removed = role.permissions.filter((permission) => !after.has(permission));
  role.name = body.name;
  role.description = body.description;
  role.permissions = body.permissions;
  await role.save();
  const affectedUsers = await User.countDocuments({ role: key });
  const permissionChange = [
    added.length ? `added: ${added.join(', ')}` : '',
    removed.length ? `removed: ${removed.join(', ')}` : '',
  ].filter(Boolean).join('; ');
  await audit(me, permissionChange ? 'role.permissions_updated' : 'role.updated', 'Role', String(role._id), `Updated role ${role.name}${permissionChange ? ` (${permissionChange}; ${affectedUsers} linked user${affectedUsers === 1 ? '' : 's'})` : ''}`);
  return { role: dto(role.toObject()) };
}

export async function deleteRole(me: AuthUser, key: string) {
  const role = await RoleModel.findOne({ key });
  if (!role) throw notFound('Role not found');
  if (role.system) throw badRequest('Built-in roles cannot be deleted');
  if (await User.exists({ role: key })) throw conflict('Reassign all users with this role before deleting it');
  await role.deleteOne();
  await audit(me, 'role.deleted', 'Role', String(role._id), `Deleted role ${role.name}`);
  return { ok: true };
}
