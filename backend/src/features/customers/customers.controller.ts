import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { assertObjectId, parse } from '../../lib/http';
import { createCustomer, deleteCustomer, getCustomer, listCustomers, updateCustomer } from './customers.service';
import { createCustomerSchema, updateCustomerSchema } from './customers.validation';

export async function listCustomersController(req: Request, res: Response) {
  res.json(await listCustomers(req.query as Record<string, unknown>));
}

export async function getCustomerController(req: Request, res: Response) {
  const id = assertObjectId(req.params.id, 'Customer');
  res.json(await getCustomer(id));
}

export async function createCustomerController(req: Request, res: Response) {
  const me = currentUser(req);
  const body = parse(createCustomerSchema, req.body);
  res.status(201).json(await createCustomer(me, body));
}

export async function updateCustomerController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = assertObjectId(req.params.id, 'Customer');
  const body = parse(updateCustomerSchema, req.body);
  res.json(await updateCustomer(me, id, body));
}

export async function deleteCustomerController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = assertObjectId(req.params.id, 'Customer');
  res.json(await deleteCustomer(me, id));
}
