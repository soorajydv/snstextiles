import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import { createRoleController, deleteRoleController, listRolesController, updateRoleController } from './roles.controller';

const router = Router();
router.use(requirePermission('roles.manage'));

router.get('/', listRolesController);
router.post('/', createRoleController);
router.patch('/:key', updateRoleController);
router.delete('/:key', deleteRoleController);

export default router;
