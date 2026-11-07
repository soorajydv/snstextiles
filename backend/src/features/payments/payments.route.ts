import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import { upload } from '../../lib/uploads';
import {
  billingSummaryController,
  createPaymentController,
  deletePaymentController,
  exportInvoicesController,
  exportPaymentsController,
  exportStatementController,
  listPaymentsController,
  paymentProofController,
  rejectPaymentController,
  verifyPaymentController,
} from './payments.controller';

const router = Router();

router.get('/', requirePermission('payments.view'), listPaymentsController);
router.get('/summary', requirePermission('payments.view'), billingSummaryController);
router.get('/export/invoices.csv', requirePermission('payments.export'), exportInvoicesController);
router.get('/export/payments.csv', requirePermission('payments.export'), exportPaymentsController);
router.get('/export/statement.csv', requirePermission('payments.export'), exportStatementController);
router.post('/', requirePermission('payments.record'), upload.single('proof'), createPaymentController);
router.post('/:id/verify', requirePermission('payments.verify'), verifyPaymentController);
router.post('/:id/reject', requirePermission('payments.verify'), rejectPaymentController);
router.get('/:id/proof', requirePermission('payments.view'), paymentProofController);
router.delete('/:id', requirePermission('payments.delete'), deletePaymentController);

export default router;
