'use client';

import Link, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { appPath } from '@/lib/paths';

type AppLinkProps = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & { children?: ReactNode };

export function AppLink({ href, ...props }: AppLinkProps) {
  return <Link href={typeof href === 'string' ? appPath(href) : href} {...props} />;
}
