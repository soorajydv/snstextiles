import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import { upload } from '../../lib/uploads';
import {
  advanceStageController, approveArtworkController, completeCuttingController, createOrderController, deleteOrderController,
  deliverOrderController, feedbackController, getOrderController, issueInvoiceController, listOrdersController,
  orderFileController, sendBackController, updateOrderController, uploadArtworkController,
} from './orders.controller';

const router = Router();

// ---------- list & read ----------
router.get('/', requirePermission('orders.view'), listOrdersController);
router.get('/:id', requirePermission('orders.view'), getOrderController);

// ---------- create / update / delete ----------
router.post(
  '/',
  requirePermission('orders.create'),
  upload.fields([{ name: 'jerseyImage', maxCount: 1 }, { name: 'files', maxCount: 10 }, { name: 'advanceProof', maxCount: 1 }, { name: 'playerListImage', maxCount: 1 }]),
  createOrderController,
);
router.patch('/:id', requirePermission('orders.update'), updateOrderController);
router.delete('/:id', requirePermission('orders.delete'), deleteOrderController);

// ---------- artwork & approval ----------
router.post('/:id/artworks', requirePermission('orders.artwork.upload'), upload.single('file'), uploadArtworkController);
router.post('/:id/approve', requirePermission('orders.approve'), approveArtworkController);
router.post('/:id/feedback', requirePermission('orders.feedback'), feedbackController);

// ---------- production workflow ----------
router.post('/:id/advance', requirePermission('orders.stage.complete'), advanceStageController);
router.post('/:id/cutting/complete', requirePermission('orders.stage.complete'), completeCuttingController);
router.post('/:id/send-back', requirePermission('orders.send_back'), sendBackController);
router.post('/:id/deliver', requirePermission('orders.deliver'), deliverOrderController);

// ---------- invoice ----------
router.post('/:id/invoice', requirePermission('orders.invoice'), issueInvoiceController);

// ---------- private files ----------
router.get('/:id/files/:storedName', requirePermission('orders.view'), orderFileController);

export default router;
