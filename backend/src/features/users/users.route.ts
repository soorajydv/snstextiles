import { Router } from 'express';
import { requirePermission } from '../../middleware/auth';
import {
  createUserController,
  deleteUserController,
  listUsersController,
  resetUserPasswordController,
  updateUserController,
} from './users.controller';

const router = Router();
router.use(requirePermission('users.manage'));

router.get('/', listUsersController);
router.post('/', createUserController);
router.patch('/:id', updateUserController);
router.post('/:id/reset-password', resetUserPasswordController);
router.delete('/:id', deleteUserController);

export default router;
