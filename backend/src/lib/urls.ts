import { env } from '../config/env';

/** Builds a full public URL while preserving the frontend base path (for example /portal). */
export function publicUrl(pathname: string): string {
  return new URL(pathname.replace(/^\/+/, ''), `${env.appUrl}/`).toString();
}
