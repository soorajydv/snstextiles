'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import { AppShell } from '@/components/AppShell';

const PUBLIC_AUTH_PATHS = ['/login', '/forgot-password', '/reset-password'];

export function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicAuthPage = PUBLIC_AUTH_PATHS.some((path) => pathname.endsWith(path));

  if (isPublicAuthPage) return <>{children}</>;
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
