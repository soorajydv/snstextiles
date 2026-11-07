import { SiteProduct } from '../site/site.model';
import { productDto } from '../site/site.service';
import { SiteFavorite } from './favorite.model';
import { notFound, assertObjectId } from '../../lib/http';

export async function listFavorites(userId: string) {
  const favorites = await SiteFavorite.find({ user: userId }).sort({ createdAt: -1 }).select('product').lean();
  const ids = favorites.map((favorite) => String(favorite.product));
  const products = await SiteProduct.find({ _id: { $in: ids }, published: true }).populate('categories', 'name slug').lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  return ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [productDto(product)] : [];
  });
}

export async function addFavorite(userId: string, rawProductId: string) {
  const productId = assertObjectId(rawProductId, 'Product');
  if (!(await SiteProduct.exists({ _id: productId, published: true }))) throw notFound('Product not found');
  const exists = await SiteFavorite.exists({ user: userId, product: productId });
  if (!exists) await SiteFavorite.create({ user: userId, product: productId });
  return { ok: true };
}

export async function removeFavorite(userId: string, rawProductId: string) {
  const productId = assertObjectId(rawProductId, 'Product');
  await SiteFavorite.deleteOne({ user: userId, product: productId });
  return { ok: true };
}
