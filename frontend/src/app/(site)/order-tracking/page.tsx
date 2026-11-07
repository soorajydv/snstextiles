import type { Metadata } from 'next';
import Link from 'next/link';
import { TrackForm } from '@/components/website/EnquiryForm';
import { PageIntro } from '@/components/website/shop-ui';

export const metadata: Metadata = { title: 'Track your order', description: 'Follow your SNS Textiles order from design through production and delivery.' };

export default function OrderTrackingPage() {
  return (
    <>
      <PageIntro crumbs={[{ label: 'Order tracking' }]} kicker="Where is my kit?" title="Track your order">
        Signed-in customers can see every order in <Link href="/account">My account</Link>.
      </PageIntro>
      <section className="wrap section-sm narrow"><TrackForm /></section>
    </>
  );
}
