import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { addFavoriteController, listFavoritesController, removeFavoriteController } from './favorite.controller';

const router = Router();

router.get('/', requireAuth, listFavoritesController);
router.post('/:productId', requireAuth, addFavoriteController);
router.delete('/:productId', requireAuth, removeFavoriteController);

export default router;
