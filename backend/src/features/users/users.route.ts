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
router.get('/', requirePermission('users.view'), listUsersController);
router.post('/', requirePermission('users.create'), createUserController);
router.patch('/:id', requirePermission('users.update'), updateUserController);
router.post('/:id/reset-password', requirePermission('users.password_reset'), resetUserPasswordController);
router.delete('/:id', requirePermission('users.delete'), deleteUserController);

export default router;
