import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/website/EnquiryForm';
import { PageIntro } from '@/components/website/shop-ui';
import { SiteIcon } from '@/components/website/SiteIcon';
import { getShell } from '@/lib/site-data';

export const metadata: Metadata = { title: 'Contact us', description: 'Call, email or visit SNS Textiles in Kalanki, Kathmandu.', alternates: { canonical: '/contact' } };

export default async function ContactPage() {
  const { settings } = await getShell();
  const { contact, social } = settings;
  const whatsapp = contact.whatsapp.replace(/[^\d]/g, '');
  return (
    <>
      <PageIntro crumbs={[{ label: 'Contact' }]} kicker="Get in touch" title="Contact us">Questions about sizes, prices or a custom kit? We are happy to help.</PageIntro>
      <section className="wrap section-sm split">
        <div className="contact-cards">
          {contact.phones.length > 0 && <div className="side-card"><span className="side-icon"><SiteIcon name="phone" /></span><strong>Call us</strong>{contact.phones.map((p) => <a href={`tel:${p.replace(/[^+\d]/g, '')}`} key={p}>{p}</a>)}</div>}
          {contact.email && <div className="side-card"><span className="side-icon"><SiteIcon name="mail" /></span><strong>Email</strong><a href={`mailto:${contact.email}`}>{contact.email}</a></div>}
          {whatsapp && <div className="side-card"><span className="side-icon"><SiteIcon name="whatsapp" /></span><strong>WhatsApp</strong><a href={`https://wa.me/${whatsapp}`} rel="noreferrer" target="_blank">Chat with us</a></div>}
          {contact.address && <div className="side-card"><span className="side-icon"><SiteIcon name="pin" /></span><strong>Workshop</strong><span>{contact.address}</span>{contact.openingHours && <span className="muted">{contact.openingHours}</span>}</div>}
          {(social.facebook || social.instagram) && (
            <div className="side-card side-card-row">
              {social.facebook && <a href={social.facebook} rel="noreferrer" target="_blank"><SiteIcon name="facebook" /> Facebook</a>}
              {social.instagram && <a href={social.instagram} rel="noreferrer" target="_blank"><SiteIcon name="instagram" /> Instagram</a>}
            </div>
          )}
        </div>
        <div>
          <h2 className="h-sm">Send us a message</h2>
          <EnquiryForm type="contact" />
        </div>
      </section>
      {contact.mapEmbedUrl && (
        <section className="wrap section-sm">
          <iframe allowFullScreen className="map-embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={contact.mapEmbedUrl} title="Map to SNS Textiles" />
        </section>
      )}
    </>
  );
}
