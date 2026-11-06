'use client';

import { useState } from 'react';
import { SiteRequestError, siteRequest } from '@/lib/site-client';
import { SiteIcon } from './SiteIcon';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('busy');
    try {
      await siteRequest('/public/site/subscribe', { body: { email } });
      setState('done');
      setMessage('Thanks — you are on the list.');
      setEmail('');
    } catch (error) {
      setState('error');
      setMessage(error instanceof SiteRequestError ? error.message : 'Could not subscribe right now.');
    }
  }

  return (
    <form className="newsletter" onSubmit={submit}>
      <div className="newsletter-row">
        <input aria-label="Email address" autoComplete="email" onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" required type="email" value={email} />
        <button aria-label="Subscribe" disabled={state === 'busy'} type="submit"><SiteIcon name="arrow" size={20} /></button>
      </div>
      <p aria-live="polite" className={`newsletter-msg ${state === 'error' ? 'is-error' : ''}`}>{message || 'New designs, team stories and offers. No spam.'}</p>
    </form>
  );
}
