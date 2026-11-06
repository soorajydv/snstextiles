import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import {
  approveCheckInController,
  checkInController,
  checkOutController,
  listAttendanceController,
  exportAttendanceController,
  rejectCheckInController,
} from './attendance.controller';

const router = Router();
router.use(requirePermission('attendance.view'));
router.get('/', listAttendanceController);
router.get('/export.csv', exportAttendanceController);
router.post('/check-in', requirePermission('attendance.checkin'), checkInController);
router.post('/check-out', requirePermission('attendance.checkout'), checkOutController);
router.post('/:id/approve', requirePermission('attendance.approve'), approveCheckInController);
router.post('/:id/reject', requirePermission('attendance.approve'), rejectCheckInController);

export default router;
