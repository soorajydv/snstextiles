'use client';

import { useState } from 'react';
import { SiteRequestError, siteRequest } from '@/lib/site-client';

export function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('busy');
    setMessage('');
    try {
      const result = await siteRequest<{ message: string }>('/public/site/reviews', { body: { productId, rating, name, email, body } });
      setState('done');
      setMessage(result.message);
    } catch (error) {
      setState('idle');
      setMessage(error instanceof SiteRequestError ? error.message : 'Could not send your review.');
    }
  }

  if (state === 'done') return <p className="form-success" role="status">{message}</p>;
  return (
    <form className="review-form" onSubmit={submit}>
      <h3>Write a review</h3>
      <fieldset className="rating-input">
        <legend>Your rating</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} title={`${n} star${n === 1 ? '' : 's'}`}>
            <input checked={rating === n} name="rating" onChange={() => setRating(n)} type="radio" value={n} />
            <span className={n <= rating ? 'on' : undefined}>★</span>
          </label>
        ))}
      </fieldset>
      <div className="form-row">
        <label className="buy-field"><span>Name *</span><input maxLength={80} onChange={(e) => setName(e.target.value)} required value={name} /></label>
        <label className="buy-field"><span>Email <em>not published</em></span><input onChange={(e) => setEmail(e.target.value)} type="email" value={email} /></label>
      </div>
      <label className="buy-field"><span>Your review *</span><textarea maxLength={2000} minLength={5} onChange={(e) => setBody(e.target.value)} required rows={4} value={body} /></label>
      {message && <p className="form-error" role="alert">{message}</p>}
      <button className="site-btn site-btn-dark site-btn-sm" disabled={state === 'busy'} type="submit">{state === 'busy' ? 'Sending…' : 'Submit review'}</button>
    </form>
  );
}
