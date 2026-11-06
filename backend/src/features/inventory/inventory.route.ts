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
router.post('/suppliers', requirePermission('inventory.suppliers.create'), createSupplierController);
router.get('/items', listItemsController);
router.post('/items', requirePermission('inventory.create'), createItemController);
router.patch('/items/:id', requirePermission('inventory.update'), updateItemController);
router.post('/items/:id/movements', requireAnyPermission('inventory.move', 'inventory.adjust'), recordMovementController);
router.get('/movements', listMovementsController);

export default router;
