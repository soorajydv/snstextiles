import { Router } from 'express';
import { z } from 'zod';
import { Role } from './role.model';
import { User } from '../users/user.model';
import { currentUser, requirePermission } from '../../middleware/auth';
import { PERMISSIONS } from '../../lib/constants';
import { listRoles } from './roles.service';
import { badRequest, conflict, notFound, parse } from '../../lib/http';
import { audit } from '../audit/audit.service';

const router = Router();
router.use(requirePermission('roles.manage'));

const roleSchema = z.object({
  key: z.string().trim().toLowerCase().min(2).max(40).regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, numbers and dashes only'),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().default(''),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
});

const updateSchema = roleSchema.omit({ key: true });

function dto(role: Record<string, any>) {
  return { id: String(role._id), key: role.key, name: role.name, description: role.description ?? '', permissions: role.permissions ?? [], system: !!role.system };
}

router.get('/', async (_req, res) => {
  res.json({ roles: (await listRoles()).map(dto), permissions: PERMISSIONS });
});

router.post('/', async (req, res) => {
  const me = currentUser(req);
  const body = parse(roleSchema, req.body);
  if (await Role.exists({ key: body.key })) throw conflict('A role with this key already exists');
  const role = await Role.create({ ...body, system: false });
  await audit(me, 'role.created', 'Role', String(role._id), `Created role ${role.name}`);
  res.status(201).json({ role: dto(role.toObject()) });
});

router.patch('/:key', async (req, res) => {
  const me = currentUser(req);
  const key = String(req.params.key).toLowerCase();
  const role = await Role.findOne({ key });
  if (!role) throw notFound('Role not found');
  const body = parse(updateSchema, req.body);
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
  res.json({ role: dto(role.toObject()) });
});

router.delete('/:key', async (req, res) => {
  const me = currentUser(req);
  const key = String(req.params.key).toLowerCase();
  const role = await Role.findOne({ key });
  if (!role) throw notFound('Role not found');
  if (role.system) throw badRequest('Built-in roles cannot be deleted');
  if (await User.exists({ role: key })) throw conflict('Reassign all users with this role before deleting it');
  await role.deleteOne();
  await audit(me, 'role.deleted', 'Role', String(role._id), `Deleted role ${role.name}`);
  res.json({ ok: true });
});

export default router;
