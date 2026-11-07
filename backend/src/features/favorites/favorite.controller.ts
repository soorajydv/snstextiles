import type { Request, Response } from 'express';
import { parse } from '../../lib/http';
import { currentUser } from '../../middleware/auth';
import { addFavorite, listFavorites, removeFavorite } from './favorite.service';
import { favoriteProductParamsSchema } from './favorite.validation';

export async function listFavoritesController(req: Request, res: Response) {
  res.json({ products: await listFavorites(currentUser(req).id) });
}

export async function addFavoriteController(req: Request, res: Response) {
  const { productId } = parse(favoriteProductParamsSchema, { productId: String(req.params.productId) });
  res.status(201).json(await addFavorite(currentUser(req).id, productId));
}

export async function removeFavoriteController(req: Request, res: Response) {
  const { productId } = parse(favoriteProductParamsSchema, { productId: String(req.params.productId) });
  res.json(await removeFavorite(currentUser(req).id, productId));
}
