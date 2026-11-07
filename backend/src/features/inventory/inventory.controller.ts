import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { assertObjectId, parse } from '../../lib/http';
import { createItem, createSupplier, listItems, listMovements, listSuppliers, recordMovement, updateItem } from './inventory.service';
import { itemSchema, itemUpdateSchema, movementSchema, supplierSchema } from './inventory.validation';

export async function listSuppliersController(_req: Request, res: Response) {
  res.json(await listSuppliers());
}

export async function createSupplierController(req: Request, res: Response) {
  const user = currentUser(req);
  res.status(201).json(await createSupplier(user, parse(supplierSchema, req.body)));
}

export async function listItemsController(req: Request, res: Response) {
  res.json(await listItems(req.query as Record<string, unknown>));
}

export async function createItemController(req: Request, res: Response) {
  const user = currentUser(req);
  const body = parse(itemSchema, req.body);
  res.status(201).json(await createItem(user, body));
}

export async function updateItemController(req: Request, res: Response) {
  const user = currentUser(req);
  const id = assertObjectId(req.params.id, 'Item');
  const body = parse(itemUpdateSchema, req.body);
  res.json(await updateItem(user, id, body));
}

export async function recordMovementController(req: Request, res: Response) {
  const user = currentUser(req);
  const id = assertObjectId(req.params.id, 'Item');
  const body = parse(movementSchema, req.body);
  res.status(201).json(await recordMovement(user, id, body));
}

export async function listMovementsController(req: Request, res: Response) {
  res.json(await listMovements(req.query as Record<string, unknown>));
}
