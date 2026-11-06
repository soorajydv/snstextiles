import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageIntro } from '@/components/website/shop-ui';
import { ShopListing, type ShopParams } from '@/components/website/ShopListing';
import { getShell } from '@/lib/site-data';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<ShopParams> };

async function findCategory(slug: string) {
  const { categories } = await getShell();
  return { category: categories.find((c) => c.slug === slug.toLowerCase()), categories };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await findCategory(slug);
  if (!category) return { title: 'Category not found' };
  return {
    title: `${category.name} — custom ${category.name.toLowerCase()}`,
    description: category.description || `Custom ${category.name.toLowerCase()} made in Nepal — personalise with your team name, numbers and logo.`,
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { category, categories } = await findCategory(slug);
  if (!category) notFound();
  const parent = category.parent ? categories.find((c) => c.id === category.parent) : undefined;
  return (
    <>
      <PageIntro
        crumbs={[{ label: 'Shop', href: '/shop' }, ...(parent ? [{ label: parent.name, href: `/category/${parent.slug}` }] : []), { label: category.name }]}
        kicker={parent?.name ?? 'Shop by category'}
        title={category.name}
      >
        {category.description || `${category.productCount ?? 0} design${category.productCount === 1 ? '' : 's'} — all customisable with your team details.`}
      </PageIntro>
      <ShopListing basePath={`/category/${category.slug}`} category={category} params={await searchParams} />
    </>
  );
}
