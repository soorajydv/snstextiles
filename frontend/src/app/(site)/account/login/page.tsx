import type { Metadata } from 'next';
import { AccountAuth } from '@/components/website/AccountView';
import { PageIntro } from '@/components/website/shop-ui';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default function LoginPage() {
  return (
    <>
      <PageIntro crumbs={[{ label: 'Sign in' }]} title="Welcome back">Sign in to order, approve your design mockups and follow production.</PageIntro>
      <section className="wrap section-sm auth-page"><AccountAuth mode="login" /></section>
    </>
  );
}
