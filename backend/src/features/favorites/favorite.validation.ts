import { z } from 'zod';

export const favoriteProductParamsSchema = z.object({
  productId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid product id'),
});
