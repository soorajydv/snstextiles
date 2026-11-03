'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Me, Meta, Settings } from '@/lib/types';

interface AuthState {
  user: Me;
  meta: Meta;
  settings: Settings;
  refreshSettings: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Loads the signed-in user plus shared reference data; redirects to /login when there is no session. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<{ user: Me; meta: Meta; settings: Settings } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api<{ user: Me }>('/auth/me');
        const [meta, { settings }] = await Promise.all([api<Meta>('/meta'), api<{ settings: Settings }>('/settings')]);
        if (!cancelled) setState({ user, meta, settings });
      } catch {
        if (!cancelled) router.replace(`/portal/login?next=${encodeURIComponent(pathname)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only on first mount; pages handle their own data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSettings = useCallback(async () => {
    const { settings } = await api<{ settings: Settings }>('/settings');
    setState((s) => (s ? { ...s, settings } : s));
  }, []);

  const refreshUser = useCallback(async () => {
    const { user } = await api<{ user: Me }>('/auth/me');
    setState((s) => (s ? { ...s, user } : s));
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }, [router]);

  if (!state) return <div className="loading-screen"><div className="spinner" aria-label="Loading" /></div>;
  return <AuthContext.Provider value={{ ...state, refreshSettings, refreshUser, logout }}>{children}</AuthContext.Provider>;
}
