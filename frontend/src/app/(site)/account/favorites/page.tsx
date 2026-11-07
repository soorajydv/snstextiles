import type { Metadata } from 'next';
import { FavoritesView } from '@/components/website/FavoritesView';
import { PageIntro } from '@/components/website/shop-ui';

export const metadata: Metadata = { title: 'Favorites', robots: { index: false } };

export default function FavoritesPage() {
  return (
    <>
      <PageIntro crumbs={[{ label: 'My account', href: '/account' }, { label: 'Favorites' }]} title="Favorites">
        Your saved products, ready whenever your team is.
      </PageIntro>
      <section className="wrap section-sm"><FavoritesView /></section>
    </>
  );
}
