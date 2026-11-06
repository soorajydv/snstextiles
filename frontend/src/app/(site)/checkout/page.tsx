import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/website/CheckoutForm';
import { PageIntro } from '@/components/website/shop-ui';
import { renderMarkdown } from '@/lib/markdown';
import { getShell } from '@/lib/site-data';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const { settings } = await getShell();
  return (
    <>
      <PageIntro crumbs={[{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} title="Checkout" />
      <CheckoutForm
        checkout={settings.checkout}
        paymentHtml={settings.checkout.paymentInstructions ? renderMarkdown(settings.checkout.paymentInstructions) : ''}
      />
    </>
  );
}
