import type { Metadata } from 'next';
import { PageIntro } from '@/components/website/shop-ui';
import { ShopListing, type ShopParams } from '@/components/website/ShopListing';

export const metadata: Metadata = {
  title: 'Shop custom jerseys & sportswear',
  description: 'Football, cricket, basketball, volleyball and badminton jerseys, T-shirts, hoodies and tracksets — fully customisable with your team name, numbers and logo.',
  alternates: { canonical: '/shop' },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<ShopParams> }) {
  const params = await searchParams;
  return (
    <>
      <PageIntro crumbs={[{ label: 'Shop' }]} kicker="The collection" title={params.q ? `Search: ${params.q}` : 'Shop all'}>
        Every design can be personalised with your team name, player names, numbers and logo.
      </PageIntro>
      <ShopListing basePath="/shop" params={params} />
    </>
  );
}
