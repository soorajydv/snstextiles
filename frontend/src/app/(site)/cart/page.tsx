import type { Metadata } from 'next';
import { CartView } from '@/components/website/CartView';
import { PageIntro } from '@/components/website/shop-ui';

export const metadata: Metadata = { title: 'Your cart', robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <PageIntro crumbs={[{ label: 'Cart' }]} title="Your cart" />
      <CartView />
    </>
  );
}
