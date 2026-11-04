import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Customer } from '../../models/Customer';
import { User } from '../../models/user.model';
import { audit } from '../../lib/audit';
import { badRequest, HttpError } from '../../lib/http';
import { signToken } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { permissionsForUserRole } from '../../lib/roles';
import { removeStoredFile } from '../../lib/uploads';

export async function login(identifier: string, password: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ username: normalizedIdentifier }, { email: normalizedIdentifier }, { phone: identifier.trim() }],
  }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  if (!user.active) throw new HttpError(403, 'This account has been deactivated');

  user.lastLoginAt = new Date();
  await user.save();
  const token = signToken(String(user._id));
  await audit(
    { id: String(user._id), name: user.name, username: user.username ?? '', email: user.email, role: user.role as never, customerId: null, permissions: await permissionsForUserRole(user.role) },
    'auth.login', 'User', String(user._id), `${user.name} signed in`,
  );

  return { token, user: await getProfile(String(user._id)) };
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpiresAt');
  if (!user || !user.active) return null;

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  await audit(null, 'auth.password_reset_requested', 'User', String(user._id), `Password reset requested for ${user.email}`);
  return { token, expiresAt: user.passwordResetExpiresAt, name: user.name };
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() }, active: true }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');
  if (!user) throw badRequest('This password reset link is invalid or has expired');

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();
  await audit(null, 'auth.password_reset_completed', 'User', String(user._id), `${user.name} completed a password reset`);
}

export async function getProfile(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw new HttpError(401, 'Account not found');
  const customer = user.customer ? await Customer.findById(user.customer).select('name').lean() : null;
  return {
    id: String(user._id),
    name: user.name,
    username: user.username ?? '',
    email: user.email,
    role: user.role,
    phone: user.phone,
    avatarUrl: user.avatarStoredName ? '/api/auth/avatar' : '',
    customer: customer ? { id: String(customer._id), name: customer.name } : null,
  };
}

export async function updateAvatar(userId: string, actor: AuthUser, file: Express.Multer.File) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'Account not found');
  const previous = user.avatarStoredName;
  user.avatarStoredName = file.filename;
  user.avatarMimeType = file.mimetype;
  await user.save();
  removeStoredFile(previous);
  await audit(actor, 'user.avatar_updated', 'User', userId, `${actor.name} updated their profile avatar`);
  return getProfile(userId);
}

export async function removeAvatar(userId: string, actor: AuthUser) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'Account not found');
  const previous = user.avatarStoredName;
  user.avatarStoredName = null;
  user.avatarMimeType = null;
  await user.save();
  removeStoredFile(previous);
  await audit(actor, 'user.avatar_removed', 'User', userId, `${actor.name} removed their profile avatar`);
  return getProfile(userId);
}

export async function changePassword(
  userId: string,
  actor: AuthUser,
  currentPassword: string,
  newPassword: string,
) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('Current password is incorrect');
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  await audit(actor, 'auth.password_changed', 'User', userId, `${actor.name} changed their password`);
}

export async function updateProfile(userId: string, actor: AuthUser, name: string, phone: string) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'Account not found');
  user.name = name;
  user.phone = phone;
  await user.save();
  await audit({ ...actor, name }, 'user.profile_updated', 'User', userId, `${name} updated their profile`);
  return getProfile(userId);
}

export async function deleteAccount(userId: string, actor: AuthUser, password: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw badRequest('Current password is incorrect');
  }
  await audit(actor, 'user.account_deleted', 'User', userId, `${user.name} deleted their account`);
  await user.deleteOne();
}
