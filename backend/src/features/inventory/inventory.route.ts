import { Router } from 'express';
import { requireAnyPermission, requirePermission } from '../../middleware/auth';
import {
  createItemController,
  createSupplierController,
  listItemsController,
  listMovementsController,
  listSuppliersController,
  recordMovementController,
  updateItemController,
} from './inventory.controller';

const router = Router();
router.use(requirePermission('inventory.view'));

router.get('/suppliers', listSuppliersController);
router.post('/suppliers', requirePermission('inventory.manage'), createSupplierController);
router.get('/items', listItemsController);
router.post('/items', requirePermission('inventory.manage'), createItemController);
router.patch('/items/:id', requirePermission('inventory.manage'), updateItemController);
router.post('/items/:id/movements', requireAnyPermission('inventory.move', 'inventory.adjust'), recordMovementController);
router.get('/movements', listMovementsController);

export default router;
