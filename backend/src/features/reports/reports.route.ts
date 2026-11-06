import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import { attendanceReportController, ordersCsvController, paymentsReportController, summaryController } from './reports.controller';

const router = Router();
router.use(requirePermission('reports.view'));

router.get('/summary', summaryController);
router.get('/attendance', attendanceReportController);
router.get('/payments', paymentsReportController);
router.get('/orders.csv', ordersCsvController);

export default router;
