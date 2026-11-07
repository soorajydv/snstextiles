import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { PageIntro, Prose } from '@/components/website/shop-ui';
import { markdownToText, renderMarkdown } from '@/lib/markdown';
import { getPage, getPost } from '@/lib/site-data';
import { siteImage } from '@/lib/site-client';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPage((await params).slug);
  if (!data) return {};
  const { page } = data;
  return { title: page.seoTitle || page.title, description: page.seoDescription || page.excerpt || markdownToText(page.content), alternates: { canonical: `/${page.slug}` } };
}

/** CMS pages (about, policies…) and old WordPress blog-post URLs that lived at the site root. */
export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const data = await getPage(slug);
  if (!data) {
    if (await getPost(slug)) permanentRedirect(`/blog/${slug}`);
    notFound();
  }
  const { page } = data;
  return (
    <>
      <PageIntro crumbs={[{ label: page.title }]} title={page.title}>{page.excerpt}</PageIntro>
      <section className="wrap section-sm narrow"><Prose html={renderMarkdown(page.content, siteImage)} /></section>
    </>
  );
}
