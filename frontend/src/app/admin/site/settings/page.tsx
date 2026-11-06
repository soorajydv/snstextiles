'use client';

import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Field, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { ImageInput, ImageListInput } from '@/components/site/ImageInputs';
import type { SiteSettings } from '@/lib/types';

const SECTIONS = [
  ['brand', 'Brand & contact'],
  ['home', 'Homepage'],
  ['faq', 'FAQ & testimonials'],
  ['checkout', 'Checkout'],
  ['seo', 'SEO'],
] as const;
type Section = (typeof SECTIONS)[number][0];

export default function SiteSettingsPage() {
  const { meta } = useAuth();
  const toast = useToast();
  const allowed = meta.permissions.includes('site.view');
  const canManage = meta.permissions.includes('site.manage');
  const { data, error } = useApi<{ settings: SiteSettings }>(allowed ? '/site/settings' : null);
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [section, setSection] = useState<Section>('brand');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => { if (data) setForm(data.settings); }, [data]);
  if (!allowed) return <Notice tone="error">You do not have permission to manage the website.</Notice>;
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!form) return <Spinner />;

  const patch = <K extends keyof SiteSettings>(key: K, value: Partial<SiteSettings[K]> | SiteSettings[K]) =>
    setForm((f) => f && ({ ...f, [key]: Array.isArray(value) || typeof value !== 'object' ? value : { ...(f[key] as object), ...value } }));

  async function save() {
    if (!form) return;
    setBusy(true);
    setSaveError('');
    try {
      const { updatedAt: _updatedAt, ...body } = form; // eslint-disable-line @typescript-eslint/no-unused-vars
      const result = await api<{ settings: SiteSettings }>('/site/settings', { method: 'PUT', body });
      setForm(result.settings);
      toast('Website settings saved');
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const disabled = !canManage;
  return (
    <>
      <PageHeader
        eyebrow="WEBSITE"
        title="Website settings"
        subtitle="Contact details, homepage content, FAQs, checkout rules and search engine text."
        actions={canManage && <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>}
      />
      <div className="tabs">{SECTIONS.map(([key, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}>{label}</button>)}</div>
      {saveError && <Notice tone="error" style={{ marginBottom: 14 }}>{saveError}</Notice>}
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="card">
          {section === 'brand' && (
            <>
              <div className="form-section">
                <h3>Brand</h3>
                <div className="form-grid">
                  <Field label="Brand name *"><input value={form.brandName} onChange={(e) => patch('brandName', e.target.value)} /></Field>
                  <Field label="Tagline" hint="Shown in the footer."><input value={form.tagline} onChange={(e) => patch('tagline', e.target.value)} /></Field>
                  <Field label="Announcement bar (left)" hint="Use · to separate items."><input value={form.announcement} onChange={(e) => patch('announcement', e.target.value)} /></Field>
                  <Field label="Announcement bar (right)"><input value={form.announcementRight} onChange={(e) => patch('announcementRight', e.target.value)} /></Field>
                </div>
              </div>
              <div className="form-section">
                <h3>Contact details</h3>
                <div className="form-grid">
                  <Field label="Phone numbers" hint="One per line."><textarea rows={2} value={form.contact.phones.join('\n')} onChange={(e) => patch('contact', { phones: e.target.value.split('\n').map((p) => p.trim()).filter(Boolean).slice(0, 5) })} /></Field>
                  <Field label="Email" hint="Also receives order and enquiry notifications."><input type="email" value={form.contact.email} onChange={(e) => patch('contact', { email: e.target.value })} /></Field>
                  <Field label="WhatsApp number" hint="With country code, e.g. 9779827330740. Leave empty to hide."><input value={form.contact.whatsapp} onChange={(e) => patch('contact', { whatsapp: e.target.value })} /></Field>
                  <Field label="Opening hours"><input value={form.contact.openingHours} onChange={(e) => patch('contact', { openingHours: e.target.value })} placeholder="Sun–Fri, 9am – 6pm" /></Field>
                  <Field label="Address" full><input value={form.contact.address} onChange={(e) => patch('contact', { address: e.target.value })} /></Field>
                  <Field label="Google Maps embed link" full hint="Google Maps → Share → Embed a map → copy only the src link (https://www.google.com/maps/embed?pb=…)."><input value={form.contact.mapEmbedUrl} onChange={(e) => patch('contact', { mapEmbedUrl: e.target.value.replace(/^.*src="([^"]+)".*$/s, '$1') })} /></Field>
                </div>
              </div>
              <div className="form-section">
                <h3>Social media</h3>
                <div className="form-grid">
                  {(['facebook', 'instagram', 'tiktok', 'youtube'] as const).map((key) => (
                    <Field key={key} label={key[0].toUpperCase() + key.slice(1)}><input value={form.social[key]} onChange={(e) => patch('social', { [key]: e.target.value })} placeholder="https://…" /></Field>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === 'home' && (
            <>
              <div className="form-section">
                <h3>Hero</h3>
                <p className="muted">The large banner at the top of the homepage.</p>
                <div className="form-grid">
                  <Field label="Small heading"><input value={form.hero.kicker} onChange={(e) => patch('hero', { kicker: e.target.value })} /></Field>
                  <div />
                  <Field label="Headline line 1 (white)"><input value={form.hero.titleLine1} onChange={(e) => patch('hero', { titleLine1: e.target.value })} /></Field>
                  <Field label="Headline line 2 (green)"><input value={form.hero.titleLine2} onChange={(e) => patch('hero', { titleLine2: e.target.value })} /></Field>
                  <Field label="Text" full><textarea rows={2} value={form.hero.subtitle} onChange={(e) => patch('hero', { subtitle: e.target.value })} /></Field>
                  <Field label="Main button label"><input value={form.hero.primaryCta.label} onChange={(e) => patch('hero', { primaryCta: { ...form.hero.primaryCta, label: e.target.value } })} /></Field>
                  <Field label="Main button link"><input value={form.hero.primaryCta.href} onChange={(e) => patch('hero', { primaryCta: { ...form.hero.primaryCta, href: e.target.value } })} /></Field>
                  <Field label="Second button label"><input value={form.hero.secondaryCta.label} onChange={(e) => patch('hero', { secondaryCta: { ...form.hero.secondaryCta, label: e.target.value } })} /></Field>
                  <Field label="Second button link"><input value={form.hero.secondaryCta.href} onChange={(e) => patch('hero', { secondaryCta: { ...form.hero.secondaryCta, href: e.target.value } })} /></Field>
                  <Field label="Hero image" full hint="Wide photo, at least 1600px. Leave empty to use the default team photo."><ImageInput value={form.hero.image} onChange={(image) => patch('hero', { image })} disabled={disabled} /></Field>
                </div>
              </div>
              <div className="form-section">
                <h3>Custom design banner</h3>
                <div className="form-grid">
                  <Field label="Small heading"><input value={form.banner.kicker} onChange={(e) => patch('banner', { kicker: e.target.value })} /></Field>
                  <Field label="Text"><input value={form.banner.subtitle} onChange={(e) => patch('banner', { subtitle: e.target.value })} /></Field>
                  <Field label="Title (white)"><input value={form.banner.title} onChange={(e) => patch('banner', { title: e.target.value })} /></Field>
                  <Field label="Title (green)"><input value={form.banner.highlight} onChange={(e) => patch('banner', { highlight: e.target.value })} /></Field>
                  <Field label="Button label"><input value={form.banner.cta.label} onChange={(e) => patch('banner', { cta: { ...form.banner.cta, label: e.target.value } })} /></Field>
                  <Field label="Button link"><input value={form.banner.cta.href} onChange={(e) => patch('banner', { cta: { ...form.banner.cta, href: e.target.value } })} /></Field>
                  <Field label="Background image" full><ImageInput value={form.banner.image} onChange={(image) => patch('banner', { image })} disabled={disabled} /></Field>
                </div>
              </div>
              <div className="form-section">
                <h3>Our story</h3>
                <div className="form-grid">
                  <Field label="Small heading"><input value={form.story.kicker} onChange={(e) => patch('story', { kicker: e.target.value })} /></Field>
                  <Field label="Title"><input value={form.story.title} onChange={(e) => patch('story', { title: e.target.value })} /></Field>
                  <Field label="Text" full><textarea rows={4} value={form.story.body} onChange={(e) => patch('story', { body: e.target.value })} /></Field>
                </div>
              </div>
              <div className="form-section">
                <h3>Gallery</h3>
                <p className="muted">Photos of finished kits shown near the bottom of the homepage. Leave empty to hide the section.</p>
                <ImageListInput value={form.gallery} onChange={(gallery) => patch('gallery', gallery)} max={24} disabled={disabled} />
              </div>
            </>
          )}

          {section === 'faq' && (
            <>
              <div className="form-section">
                <h3>Frequently asked questions</h3>
                <p className="muted">Shown on the homepage and the FAQ page.</p>
                <div className="repeater">
                  {form.faqs.map((item, i) => (
                    <div className="repeater-row" key={i}>
                      <div className="form-grid">
                        <Field label="Question" full><input value={item.q} onChange={(e) => patch('faqs', form.faqs.map((f, j) => (j === i ? { ...f, q: e.target.value } : f)))} /></Field>
                        <Field label="Answer" full><textarea rows={2} value={item.a} onChange={(e) => patch('faqs', form.faqs.map((f, j) => (j === i ? { ...f, a: e.target.value } : f)))} /></Field>
                      </div>
                      <RowButtons index={i} length={form.faqs.length} onMove={(to) => patch('faqs', move(form.faqs, i, to))} onRemove={() => patch('faqs', form.faqs.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                  <button type="button" className="btn small" onClick={() => patch('faqs', [...form.faqs, { q: '', a: '' }])}>＋ Add question</button>
                </div>
              </div>
              <div className="form-section">
                <h3>Testimonials</h3>
                <p className="muted">Real quotes from customers. Leave empty to hide the section.</p>
                <div className="repeater">
                  {form.testimonials.map((item, i) => (
                    <div className="repeater-row" key={i}>
                      <div className="form-grid">
                        <Field label="Name"><input value={item.name} onChange={(e) => patch('testimonials', form.testimonials.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)))} /></Field>
                        <Field label="Team / role"><input value={item.role} onChange={(e) => patch('testimonials', form.testimonials.map((t, j) => (j === i ? { ...t, role: e.target.value } : t)))} /></Field>
                        <Field label="Quote" full><textarea rows={2} value={item.quote} onChange={(e) => patch('testimonials', form.testimonials.map((t, j) => (j === i ? { ...t, quote: e.target.value } : t)))} /></Field>
                      </div>
                      <RowButtons index={i} length={form.testimonials.length} onMove={(to) => patch('testimonials', move(form.testimonials, i, to))} onRemove={() => patch('testimonials', form.testimonials.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                  <button type="button" className="btn small" onClick={() => patch('testimonials', [...form.testimonials, { name: '', role: '', quote: '' }])}>＋ Add testimonial</button>
                </div>
              </div>
            </>
          )}

          {section === 'checkout' && (
            <div className="form-section">
              <h3>Checkout</h3>
              <p className="muted">Checkout creates production orders in the portal for the signed-in customer.</p>
              <div className="form-grid">
                <Field label="Minimum days before the needed-by date" hint="Customers cannot pick an earlier delivery date."><input type="number" min={0} max={120} value={form.checkout.minLeadDays} onChange={(e) => patch('checkout', { minLeadDays: Number(e.target.value) })} /></Field>
                <Field label="Delivery options" hint="One per line. Options containing “deliver” ask for an address."><textarea rows={3} value={form.checkout.deliveryMethods.join('\n')} onChange={(e) => patch('checkout', { deliveryMethods: e.target.value.split('\n').map((m) => m.trim()).filter(Boolean) })} /></Field>
                <Field label="Delivery note" full><textarea rows={2} value={form.checkout.deliveryNote} onChange={(e) => patch('checkout', { deliveryNote: e.target.value })} /></Field>
                <Field label="Payment instructions" full hint="Shown at checkout — add your eSewa / Khalti ID and bank account details. Markdown supported."><textarea rows={6} value={form.checkout.paymentInstructions} onChange={(e) => patch('checkout', { paymentInstructions: e.target.value })} /></Field>
              </div>
            </div>
          )}

          {section === 'seo' && (
            <div className="form-section">
              <h3>Search engines & sharing</h3>
              <div className="form-grid">
                <Field label="Default page title" full><input maxLength={160} value={form.seo.title} onChange={(e) => patch('seo', { title: e.target.value })} /></Field>
                <Field label="Default description" full hint="About 150 characters."><textarea rows={3} maxLength={320} value={form.seo.description} onChange={(e) => patch('seo', { description: e.target.value })} /></Field>
              </div>
            </div>
          )}
        </div>
      </fieldset>
      {canManage && <div className="form-actions"><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>}
    </>
  );
}

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function RowButtons({ index, length, onMove, onRemove }: { index: number; length: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button type="button" className="icon-btn" title="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}>↑</button>
      <button type="button" className="icon-btn" title="Move down" disabled={index === length - 1} onClick={() => onMove(index + 1)}>↓</button>
      <button type="button" className="icon-btn" title="Remove" onClick={onRemove}>×</button>
    </div>
  );
}
