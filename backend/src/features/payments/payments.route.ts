import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import { upload } from '../../lib/uploads';
import {
  createPaymentController,
  deletePaymentController,
  listPaymentsController,
  paymentProofController,
  rejectPaymentController,
  verifyPaymentController,
} from './payments.controller';

const router = Router();

router.get('/', requirePermission('payments.view'), listPaymentsController);
router.post('/', requirePermission('payments.record'), upload.single('proof'), createPaymentController);
router.post('/:id/verify', requirePermission('payments.verify'), verifyPaymentController);
router.post('/:id/reject', requirePermission('payments.verify'), rejectPaymentController);
router.get('/:id/proof', requirePermission('payments.view'), paymentProofController);
router.delete('/:id', requirePermission('payments.delete'), deletePaymentController);

export default router;
