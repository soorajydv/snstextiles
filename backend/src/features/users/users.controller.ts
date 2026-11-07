import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { assertObjectId, parse } from '../../lib/http';
import { createUser, deleteUser, listUsers, resetUserPassword, updateUser } from './users.service';
import { createSchema, resetPasswordSchema, updateSchema } from './users.validation';

export async function listUsersController(req: Request, res: Response) {
  res.json(await listUsers(req.query as Record<string, string | undefined>));
}

export async function createUserController(req: Request, res: Response) {
  const me = currentUser(req);
  const body = parse(createSchema, req.body);
  res.status(201).json(await createUser(me, body));
}

export async function updateUserController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = assertObjectId(req.params.id, 'User');
  const body = parse(updateSchema, req.body);
  res.json(await updateUser(me, id, body));
}

export async function resetUserPasswordController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = assertObjectId(req.params.id, 'User');
  const { password } = parse(resetPasswordSchema, req.body);
  res.json(await resetUserPassword(me, id, password));
}

export async function deleteUserController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = assertObjectId(req.params.id, 'User');
  res.json(await deleteUser(me, id));
}
