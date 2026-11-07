import type { Metadata } from 'next';
import { AccountAuth } from '@/components/website/AccountView';
import { PageIntro } from '@/components/website/shop-ui';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default function RegisterPage() {
  return (
    <>
      <PageIntro crumbs={[{ label: 'Create an account' }]} title="Create your account">One account for ordering, design approvals, payments and tracking.</PageIntro>
      <section className="wrap section-sm auth-page"><AccountAuth mode="register" /></section>
    </>
  );
}
