import type { Metadata } from 'next';
import Link from 'next/link';
import { EnquiryForm } from '@/components/website/EnquiryForm';
import { PageIntro } from '@/components/website/shop-ui';
import { SiteIcon } from '@/components/website/SiteIcon';
import { getShell } from '@/lib/site-data';

export const metadata: Metadata = {
  title: 'Custom jersey design',
  description: 'Send us your idea, logo or jersey image and get a quote and design mockup for your custom team kit.',
  alternates: { canonical: '/custom-jersey' },
};

const STEPS = [
  ['Send your idea', 'Upload a jersey photo, your logo or a sketch and tell us colours and quantities.'],
  ['Get a quote & mockup', 'We reply with pricing and a design mockup, usually within one working day.'],
  ['Approve & we produce', 'Once you approve, we print, stitch and deliver your kit.'],
];

export default async function CustomJerseyPage() {
  const { categories, settings } = await getShell();
  const products = categories.filter((c) => c.parent || !categories.some((x) => x.parent === c.id)).map((c) => c.name);
  return (
    <>
      <PageIntro crumbs={[{ label: 'Custom design' }]} dark kicker="Create your own" title={<>Custom <em>jersey</em> design</>}>
        Your team. Your design. No limits. Tell us what you need and our designers will bring it to life.
      </PageIntro>
      <section className="wrap section-sm split">
        <div>
          <ol className="mini-steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}><span>{i + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>
            ))}
          </ol>
          <div className="side-card">
            <strong>Prefer to talk?</strong>
            {settings.contact.phones.map((p) => <a href={`tel:${p.replace(/[^+\d]/g, '')}`} key={p}><SiteIcon name="phone" size={16} /> {p}</a>)}
            {settings.contact.email && <a href={`mailto:${settings.contact.email}`}><SiteIcon name="mail" size={16} /> {settings.contact.email}</a>}
            <p className="muted">Already know what you want? <Link href="/shop">Order a ready design</Link> and personalise it.</p>
          </div>
        </div>
        <EnquiryForm products={products} type="custom" />
      </section>
    </>
  );
}
