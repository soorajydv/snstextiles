'use client';

import { useState } from 'react';
import { SiteIcon } from './SiteIcon';

type Props = { email: string; products: string[] };

/** Builds a pre-filled email so enquiries reach the team without needing a public API endpoint. */
export function QuoteForm({ email, products }: Props) {
  const [sent, setSent] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    const name = value('name');
    const lines = [
      `Name: ${name}`,
      `Team / organisation: ${value('team') || '-'}`,
      `Email: ${value('email')}`,
      `Phone: ${value('phone') || '-'}`,
      `Product: ${value('product')}`,
      `Approx. quantity: ${value('quantity') || '-'}`,
      `Needed by: ${value('date') || '-'}`,
      '',
      value('message'),
    ];
    const subject = `Quote request — ${value('product')}${value('team') ? ` for ${value('team')}` : ''}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    setSent(true);
  }

  return (
    <form className="quote-form" onSubmit={onSubmit}>
      <div className="quote-form-head">
        <strong>Request a quote</strong>
        <span>Tell us about your kit — we reply with pricing and a design mockup.</span>
      </div>
      <div className="quote-grid">
        <label className="quote-field">
          <span>Your name *</span>
          <input autoComplete="name" name="name" required type="text" />
        </label>
        <label className="quote-field">
          <span>Team / organisation</span>
          <input autoComplete="organization" name="team" type="text" />
        </label>
        <label className="quote-field">
          <span>Email *</span>
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label className="quote-field">
          <span>Phone</span>
          <input autoComplete="tel" inputMode="tel" name="phone" type="tel" />
        </label>
        <label className="quote-field">
          <span>Product *</span>
          <select defaultValue={products[0]} name="product" required>
            {products.map((product) => <option key={product}>{product}</option>)}
            <option>Something else</option>
          </select>
        </label>
        <label className="quote-field">
          <span>Approx. quantity</span>
          <input inputMode="numeric" min={1} name="quantity" placeholder="e.g. 20" type="number" />
        </label>
        <label className="quote-field quote-field-full">
          <span>Needed by</span>
          <input name="date" type="date" />
        </label>
        <label className="quote-field quote-field-full">
          <span>Design details *</span>
          <textarea name="message" placeholder="Colours, logo, player names & numbers, sizes…" required rows={4} />
        </label>
      </div>
      <button className="site-btn site-btn-dark quote-submit" type="submit">Send request <SiteIcon name="arrow" /></button>
      <p className="quote-note" role="status">
        {sent ? 'Your email app should open with the details filled in — just press send.' : 'Submitting opens your email app with everything filled in.'}
      </p>
    </form>
  );
}
