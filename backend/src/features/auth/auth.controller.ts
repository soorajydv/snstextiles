import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { AUTH_COOKIE, currentUser } from '../../middleware/auth';
import { badRequest, HttpError, parse } from '../../lib/http';
import { storedFilePath } from '../../lib/uploads';
import { User } from '../../models/user.model';
import { changePasswordSchema, customerRegistrationSchema, deleteAccountSchema, forgotPasswordSchema, loginSchema, profileSchema, resetPasswordSchema } from './auth.validation';
import { changePassword, deleteAccount, getProfile, login, registerCustomer, removeAvatar, requestPasswordReset, resetPassword, updateAvatar, updateProfile } from './auth.service';
import { sendPasswordResetEmail } from '../../lib/mail';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProd,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function loginController(req: Request, res: Response) {
  const { identifier, password } = parse(loginSchema, req.body);
  const result = await login(identifier, password);
  res.cookie(AUTH_COOKIE, result.token, cookieOptions);
  res.json(result);
}

export async function registerCustomerController(req: Request, res: Response) {
  const body = parse(customerRegistrationSchema, req.body);
  res.status(201).json(await registerCustomer(body));
}

export async function forgotPasswordController(req: Request, res: Response) {
  const { email } = parse(forgotPasswordSchema, req.body);
  const result = await requestPasswordReset(email);
  const response: { message: string; resetUrl?: string } = { message: 'If an account exists for that email, password-reset instructions have been prepared.' };
  if (result) {
    try {
      await sendPasswordResetEmail(email, result.name, result.token);
      if (!env.isProd) response.resetUrl = `${env.appUrl}/reset-password?token=${encodeURIComponent(result.token)}`;
    } catch (error) {
      console.error('Password reset email failed', error);
      if (env.isProd) throw new HttpError(503, 'Password reset email could not be sent. Please try again later.');
      response.resetUrl = `${env.appUrl}/reset-password?token=${encodeURIComponent(result.token)}`;
    }
  }
  res.json(response);
}

export async function resetPasswordController(req: Request, res: Response) {
  const { token, newPassword } = parse(resetPasswordSchema, req.body);
  await resetPassword(token, newPassword);
  res.json({ ok: true, message: 'Password reset successfully. You can now sign in.' });
}

export function logoutController(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
}

export async function meController(req: Request, res: Response) {
  res.json({ user: await getProfile(currentUser(req).id) });
}

export async function uploadAvatarController(req: Request, res: Response) {
  const me = currentUser(req);
  if (!req.file) throw badRequest('avatar: Select an image to upload');
  res.json({ user: await updateAvatar(me.id, me, req.file) });
}

export async function deleteAvatarController(req: Request, res: Response) {
  const me = currentUser(req);
  res.json({ user: await removeAvatar(me.id, me) });
}

export async function avatarController(req: Request, res: Response) {
  const me = currentUser(req);
  const user = await User.findById(me.id).lean();
  if (!user?.avatarUrl) { res.status(404).end(); return; }
  let storedName: string;
  try {
    storedName = decodeURIComponent(new URL(user.avatarUrl).pathname.split('/').pop() ?? '');
  } catch {
    res.status(404).end();
    return;
  }
  if (!storedName || (req.params.storedName && storedName !== req.params.storedName)) { res.status(404).end(); return; }
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.sendFile(storedFilePath(storedName), (err) => { if (err && !res.headersSent) res.status(404).end(); });
}

export async function changePasswordController(req: Request, res: Response) {
  const me = currentUser(req);
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  await changePassword(me.id, me, currentPassword, newPassword);
  res.json({ ok: true });
}

export async function updateProfileController(req: Request, res: Response) {
  const me = currentUser(req);
  const { name, username, phone } = parse(profileSchema, req.body);
  res.json({ user: await updateProfile(me.id, me, name, username, phone) });
}

export async function deleteAccountController(req: Request, res: Response) {
  const me = currentUser(req);
  const { password } = parse(deleteAccountSchema, req.body);
  await deleteAccount(me.id, me, password);
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
}
