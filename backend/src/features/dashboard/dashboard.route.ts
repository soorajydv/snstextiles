import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import { dashboardController } from './dashboard.controller';

const router = Router();

router.get('/', requirePermission('dashboard.view'), dashboardController);

export default router;
