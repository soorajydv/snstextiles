import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { parse } from '../../lib/http';
import { createRole, deleteRole, listRoleDtos, updateRole } from './roles.service';
import { roleSchema } from './roles.validation';

export async function listRolesController(_req: Request, res: Response) {
  res.json(await listRoleDtos());
}

export async function createRoleController(req: Request, res: Response) {
  const me = currentUser(req);
  const body = parse(roleSchema, req.body);
  res.status(201).json(await createRole(me, body));
}

export async function updateRoleController(req: Request, res: Response) {
  const me = currentUser(req);
  const key = String(req.params.key).toLowerCase();
  res.json(await updateRole(me, key, req.body));
}

export async function deleteRoleController(req: Request, res: Response) {
  const me = currentUser(req);
  const key = String(req.params.key).toLowerCase();
  res.json(await deleteRole(me, key));
}
