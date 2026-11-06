import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth';
import { avatarUpload } from '../../lib/uploads';
import {
  avatarController,
  changePasswordController,
  deleteAvatarController,
  deleteAccountController,
  forgotPasswordController,
  loginController,
  logoutController,
  meController,
  registerCustomerController,
  resetPasswordController,
  uploadAvatarController,
  updateProfileController,
} from './auth.controller';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in a few minutes.' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please try again later.' },
});

router.post('/login', loginLimiter, loginController);
router.post('/register', loginLimiter, registerCustomerController);
router.get('/register', (_req, res) => {
  res.json({ ok: true, method: 'POST', message: 'Customer registration is public. Submit registration details with POST.' });
});
router.post('/forgot-password', passwordResetLimiter, forgotPasswordController);
router.post('/reset-password', passwordResetLimiter, resetPasswordController);
router.post('/logout', logoutController);
router.get('/me', requireAuth, meController);
router.get('/avatar', requireAuth, avatarController);
router.get('/avatar/:storedName', requireAuth, avatarController);
router.patch('/profile', requireAuth, updateProfileController);
router.patch('/avatar', requireAuth, avatarUpload.single('avatar'), uploadAvatarController);
router.delete('/avatar', requireAuth, deleteAvatarController);
router.delete('/account', requireAuth, deleteAccountController);
router.post('/change-password', requireAuth, changePasswordController);

export default router;
