import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageIntro, Prose } from '@/components/website/shop-ui';
import { markdownToText, renderMarkdown } from '@/lib/markdown';
import { SITE_URL, getPost } from '@/lib/site-data';
import { siteImage } from '@/lib/site-client';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPost((await params).slug);
  if (!data) return { title: 'Post not found' };
  const { post } = data;
  const description = post.seoDescription || post.excerpt || markdownToText(post.content ?? '');
  return {
    title: post.seoTitle || post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description, publishedTime: post.publishedAt, images: post.coverImage ? [post.coverImage.startsWith('http') ? post.coverImage : `${SITE_URL}${siteImage(post.coverImage)}`] : undefined },
  };
}

export default async function PostPage({ params }: Props) {
  const data = await getPost((await params).slug);
  if (!data) notFound();
  const { post, more } = data;
  return (
    <>
      <PageIntro crumbs={[{ label: 'Blog', href: '/blog' }, { label: post.title }]} kicker={new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} title={post.title}>
        {post.excerpt}
      </PageIntro>
      <article className="wrap section-sm narrow">
        {post.coverImage && <img alt="" className="post-cover" src={siteImage(post.coverImage)} />}
        <Prose html={renderMarkdown(post.content ?? '', siteImage)} />
        <p className="muted post-author">By {post.authorName}{post.tags.length ? ` · ${post.tags.join(', ')}` : ''}</p>
      </article>
      {more.length > 0 && (
        <section className="wrap section-sm narrow">
          <h2 className="h-sm">More from the blog</h2>
          <ul className="more-posts">{more.map((p) => <li key={p.id}><Link href={`/blog/${p.slug}`}>{p.title}</Link></li>)}</ul>
        </section>
      )}
    </>
  );
}
