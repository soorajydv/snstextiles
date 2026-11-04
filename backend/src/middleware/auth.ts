import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/user.model';
import { HttpError, forbidden } from '../lib/http';
import { type Permission, type Role } from '../lib/constants';
import { permissionsForUserRole } from '../lib/roles';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  permissions: Permission[];
  customerId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const AUTH_COOKIE = 'ss_token';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

function readToken(req: Request): string | null {
  const cookie = req.cookies?.[AUTH_COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Verifies the session and re-loads the user so deactivation and role changes apply immediately. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) throw new HttpError(401, 'Please sign in');
  let sub: string;
  try {
    sub = String((jwt.verify(token, env.jwtSecret) as jwt.JwtPayload).sub);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again');
  }
  const user = await User.findById(sub).lean();
  if (!user || !user.active) throw new HttpError(401, 'Account is not active');
  req.user = {
    id: String(user._id),
    name: user.name,
    username: user.username ?? '',
    email: user.email,
    role: user.role as Role,
    permissions: await permissionsForUserRole(user.role),
    customerId: user.customer ? String(user.customer) : null,
  };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      throw forbidden(`You do not have permission to ${permission.replace('.', ' ')}`);
    }
    next();
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !permissions.some((permission) => req.user!.permissions.includes(permission))) {
      throw forbidden('You do not have permission to perform this action');
    }
    next();
  };
}

export const currentUser = (req: Request): AuthUser => {
  if (!req.user) throw new HttpError(401, 'Please sign in');
  return req.user;
};
