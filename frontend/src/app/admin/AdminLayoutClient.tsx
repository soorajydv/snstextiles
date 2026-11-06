'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';

const PUBLIC_AUTH_PATHS = ['/login', '/forgot-password', '/reset-password', '/register'];

export function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const isPublicAuthPage = PUBLIC_AUTH_PATHS.some((path) => normalizedPathname.endsWith(path));

  if (isPublicAuthPage) return <>{children}</>;
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
