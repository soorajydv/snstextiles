import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/website/shop-ui';
import { SiteIcon } from '@/components/website/SiteIcon';
import { getShell } from '@/lib/site-data';

export const metadata: Metadata = { title: 'Frequently asked questions', alternates: { canonical: '/faq' } };

export default async function FaqPage() {
  const { settings } = await getShell();
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: settings.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <PageIntro crumbs={[{ label: 'FAQ' }]} kicker="Good to know" title="Frequently asked questions">
        Can&apos;t find your answer? <Link href="/contact">Contact us</Link>.
      </PageIntro>
      <section className="wrap section-sm narrow faq">
        <div className="faq-list">
          {settings.faqs.map((item, index) => (
            <details key={item.q} open={index === 0}>
              <summary>{item.q}<span aria-hidden="true"><SiteIcon name="plus" size={20} /></span></summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
