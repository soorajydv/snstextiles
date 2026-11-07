'use client';

import type { ReactNode } from 'react';
import { Notice, PageHeader } from '@/components/ui';
import { WEBSITE_ENABLED } from '@/lib/features';

/** Website management is hidden unless NEXT_PUBLIC_WEBSITE_ENABLED=true. */
export default function SiteAdminLayout({ children }: { children: ReactNode }) {
  if (!WEBSITE_ENABLED) {
    return (
      <>
        <PageHeader eyebrow="WEBSITE" title="Website is switched off" />
        <Notice tone="warn">The website module is not enabled. Set <code>NEXT_PUBLIC_WEBSITE_ENABLED=true</code> in the frontend environment and rebuild to manage it here.</Notice>
      </>
    );
  }
  return <>{children}</>;
}
