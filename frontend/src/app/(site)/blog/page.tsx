import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro, Pager } from '@/components/website/shop-ui';
import { getPosts } from '@/lib/site-data';
import { siteImage } from '@/lib/site-client';

export const metadata: Metadata = { title: 'Blog', description: 'Teamwear guides, jersey care and stories from the SNS Textiles workshop.', alternates: { canonical: '/blog' } };

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const data = await getPosts(page, 9);
  return (
    <>
      <PageIntro crumbs={[{ label: 'Blog' }]} kicker="Stories" title="From our journal">Guides, kit stories and news from the workshop.</PageIntro>
      <section className="wrap section-sm">
        {data.posts.length ? (
          <div className="post-grid">
            {data.posts.map((post) => (
              <article className="post-card" key={post.id}>
                <Link className="post-media" href={`/blog/${post.slug}`}>
                  <img alt="" loading="lazy" src={post.coverImage ? siteImage(post.coverImage) : '/website-assets/sns-hero-800.webp'} />
                </Link>
                <div className="post-body">
                  <small>{new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}{post.tags[0] ? ` · ${post.tags[0]}` : ''}</small>
                  <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
                  {post.excerpt && <p>{post.excerpt}</p>}
                  <Link className="text-link" href={`/blog/${post.slug}`}>Read more →</Link>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="empty-state"><h2>No posts yet</h2><p>Check back soon.</p></div>}
        <Pager href={(n) => (n === 1 ? '/blog' : `/blog?page=${n}`)} limit={data.limit} page={page} total={data.total} />
      </section>
    </>
  );
}
