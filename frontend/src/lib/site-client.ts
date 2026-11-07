import { appPath } from './paths';

/** Resolves an image stored by the API (served through the /portal proxy) or a bundled/static/remote image. */
export function siteImage(src: string | undefined | null): string {
  if (!src) return '';
  if (src.startsWith('/api/')) return appPath(src);
  return src;
}

export class SiteRequestError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string>) { super(message); }
}

/** Browser-side call to the API through the same-origin /portal/api proxy. Never redirects on 401. */
export async function siteRequest<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(appPath(`/api${path}`), {
    method: init.method ?? (init.body || init.form ? 'POST' : 'GET'),
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SiteRequestError(res.status, (data as { error?: string }).error ?? 'Something went wrong. Please try again.', (data as { details?: Record<string, string> }).details);
  return data as T;
}

export const npr = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-IN')}`;

export type SiteUser = { id: string; name: string; email: string; username: string; role: string; phone?: string; customer?: { id: string; name: string } | null };

export async function fetchSiteUser(): Promise<SiteUser | null> {
  try {
    const data = await siteRequest<{ user: SiteUser } | SiteUser>('/auth/me');
    return 'user' in data ? data.user : data;
  } catch {
    return null;
  }
}
