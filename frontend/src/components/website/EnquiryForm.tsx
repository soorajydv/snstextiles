'use client';

import { useState } from 'react';
import { SiteRequestError, siteRequest } from '@/lib/site-client';
import { SiteIcon } from './SiteIcon';

const ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf,.ai,.eps,.svg,.psd,.cdr';

/** Custom-jersey request (with design uploads) or a plain contact message. */
export function EnquiryForm({ type, products = [] }: { type: 'custom' | 'contact'; products?: string[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');
  const [chars, setChars] = useState(0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.delete('files');
    files.forEach((file) => form.append('files', file));
    form.set('type', type);
    setState('busy');
    setError('');
    try {
      await siteRequest('/public/site/enquiries', { form });
      setState('done');
    } catch (err) {
      setState('idle');
      setError(err instanceof SiteRequestError ? err.message.replace(/^[\w.]+: /, '') : 'Could not send your message. Please call or email us instead.');
    }
  }

  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []).slice(0, 4);
    const tooBig = chosen.find((f) => f.size > 10 * 1024 * 1024);
    if (tooBig) { setError(`${tooBig.name} is larger than 10 MB.`); return; }
    setError('');
    setFiles(chosen);
  }

  if (state === 'done') {
    return (
      <div className="confirm-card confirm-card-inline">
        <span className="confirm-icon"><SiteIcon name="check" size={28} /></span>
        <h2>{type === 'custom' ? 'Request received!' : 'Message sent!'}</h2>
        <p>Thank you — our team will get back to you shortly{type === 'custom' ? ' with a quote and design ideas' : ''}.</p>
      </div>
    );
  }

  return (
    <form className="enquiry-form" onSubmit={submit}>
      <div className="form-row">
        <label className="buy-field"><span>Name *</span><input autoComplete="name" minLength={2} name="name" required /></label>
        <label className="buy-field"><span>Email address *</span><input autoComplete="email" name="email" required type="email" /></label>
      </div>
      <div className="form-row">
        <label className="buy-field"><span>Phone number</span><input autoComplete="tel" inputMode="tel" name="phone" /></label>
        {type === 'custom'
          ? <label className="buy-field"><span>Team / organisation</span><input autoComplete="organization" name="team" /></label>
          : <label className="buy-field"><span>Subject</span><input name="subject" /></label>}
      </div>
      {type === 'custom' && (
        <div className="form-row form-row-3">
          <label className="buy-field"><span>Product</span>
            <select defaultValue="" name="product">
              <option value="">Not sure yet</option>
              {products.map((p) => <option key={p}>{p}</option>)}
              <option>Other</option>
            </select>
          </label>
          <label className="buy-field"><span>Approx. quantity</span><input inputMode="numeric" min={1} name="quantity" type="number" /></label>
          <label className="buy-field"><span>Needed by</span><input name="neededBy" type="date" /></label>
        </div>
      )}
      {type === 'custom' && (
        <label className="dropzone">
          <SiteIcon name="upload" size={26} />
          <strong>Upload jersey image, logo or artwork</strong>
          <small>{files.length ? files.map((f) => f.name).join(', ') : 'PNG, JPG, PDF, AI, EPS, SVG, PSD or CDR · up to 4 files, 10 MB each'}</small>
          <input accept={ACCEPT} multiple onChange={(e) => pick(e.target.files)} type="file" />
        </label>
      )}
      <label className="buy-field">
        <span>Your message * <em>{chars}/4000</em></span>
        <textarea maxLength={4000} minLength={5} name="message" onChange={(e) => setChars(e.target.value.length)} placeholder={type === 'custom' ? 'Colours, sleeves, collar, player names & numbers, sponsor logos…' : 'How can we help?'} required rows={5} />
      </label>
      <input aria-hidden="true" autoComplete="off" className="hp" name="website" tabIndex={-1} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="site-btn site-btn-dark" disabled={state === 'busy'} type="submit">{state === 'busy' ? 'Sending…' : type === 'custom' ? 'Send request' : 'Send message'} <SiteIcon name="arrow" /></button>
    </form>
  );
}

export function TrackForm() {
  const [orderNo, setOrderNo] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<null | { orderNo: string; teamName: string; productName: string; quantity: number; stage: string; stageLabel: string; status: string; dueDate: string; createdAt: string; history: { stage: string; label: string; at: string }[] }>(null);
  const STAGES = [['design', 'Design'], ['printing', 'Printing'], ['stitching', 'Stitching'], ['finishing', 'Finishing'], ['ready', 'Ready'], ['delivered', 'Delivered']];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await siteRequest<{ order: NonNullable<typeof order> }>('/public/site/track', { body: { orderNo, email } });
      setOrder(result.order);
    } catch (err) {
      setOrder(null);
      setError(err instanceof SiteRequestError ? err.message : 'Could not look up the order.');
    } finally {
      setBusy(false);
    }
  }

  const current = order ? STAGES.findIndex(([key]) => key === order.stage) : -1;
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="track">
      <form className="enquiry-form" onSubmit={submit}>
        <p className="muted">Enter your order number (for example SS-26125) and the email you used when ordering.</p>
        <div className="form-row">
          <label className="buy-field"><span>Order number *</span><input onChange={(e) => setOrderNo(e.target.value)} placeholder="SS-26125" required value={orderNo} /></label>
          <label className="buy-field"><span>Email *</span><input autoComplete="email" onChange={(e) => setEmail(e.target.value)} required type="email" value={email} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="site-btn site-btn-dark" disabled={busy} type="submit">{busy ? 'Checking…' : 'Track order'}</button>
      </form>
      {order && (
        <div className="track-result" aria-live="polite">
          <div className="order-card-head">
            <div><strong>{order.orderNo}</strong><span>{order.productName} · {order.quantity} pcs · {order.teamName}</span></div>
            <span className={`order-status ${order.stage === 'delivered' ? 'is-done' : ''}`}>{order.status}</span>
          </div>
          <ol className="track-steps">
            {STAGES.map(([key, label], i) => {
              const reached = order.history.filter((h) => h.stage === key).pop();
              return (
                <li className={i < current ? 'done' : i === current ? 'current' : ''} key={key}>
                  <span className="dot">{i < current || order.stage === 'delivered' ? <SiteIcon name="check" size={14} /> : i + 1}</span>
                  <strong>{label}</strong>
                  {reached && <small>{fmt(reached.at)}</small>}
                </li>
              );
            })}
          </ol>
          <p className="muted">Ordered {fmt(order.createdAt)} · needed by {fmt(order.dueDate)}</p>
        </div>
      )}
    </div>
  );
}
