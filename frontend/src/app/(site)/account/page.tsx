import type { Metadata } from 'next';
import { AccountView } from '@/components/website/AccountView';
import { PageIntro } from '@/components/website/shop-ui';

export const metadata: Metadata = { title: 'My account', robots: { index: false } };

export default function AccountPage() {
  return (
    <>
      <PageIntro crumbs={[{ label: 'My account' }]} title="My account" />
      <section className="wrap section-sm"><AccountView /></section>
    </>
  );
}
