import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import {
  createCustomerController,
  deleteCustomerController,
  getCustomerController,
  listCustomersController,
  updateCustomerController,
} from './customers.controller';

const router = Router();
router.use(requirePermission('customers.view'));

router.get('/', listCustomersController);
router.get('/:id', getCustomerController);
router.post('/', requirePermission('customers.manage'), createCustomerController);
router.patch('/:id', requirePermission('customers.manage'), updateCustomerController);
router.delete('/:id', requirePermission('customers.delete'), deleteCustomerController);

export default router;
