import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import { createRoleController, deleteRoleController, listRolesController, updateRoleController } from './roles.controller';

const router = Router();
router.get('/', requirePermission('roles.view'), listRolesController);
router.post('/', requirePermission('roles.create'), createRoleController);
router.patch('/:key', requirePermission('roles.update'), updateRoleController);
router.delete('/:key', requirePermission('roles.delete'), deleteRoleController);

export default router;
