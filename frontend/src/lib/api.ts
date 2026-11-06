'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { appPath } from './paths';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string>,
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

/** Calls the Express API through the Next.js /api proxy. The session lives in an httpOnly cookie. */
export async function api<T = unknown>(path: string, { method = 'GET', body, form, signal }: Options = {}): Promise<T> {
  const res = await fetch(appPath(`/api${path}`), {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    signal,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
      window.location.href = appPath(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    const developmentStack = process.env.NODE_ENV !== 'production' && data?.stack ? `\n\n${data.stack}` : '';
    const message = data?.error
      ? `${data.error}${developmentStack}`
      : (res.status === 413 ? 'Upload is too large. Each file must be no more than 15 MB.' : `Request failed (${res.status})`);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-api-error', { detail: message }));
    throw new ApiError(res.status, message, data?.details);
  }
  return data as T;
}

/** Loads `path` on mount and whenever it changes. Pass null to skip. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async () => {
    if (!pathRef.current) return;
    const controller = new AbortController();
    setLoading(true);
    try {
      const result = await api<T>(pathRef.current, { signal: controller.signal });
      setData(result);
      setError(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (path === null) return;
    load();
  }, [path, load]);

  return { data, error, loading, reload: load, setData };
}
