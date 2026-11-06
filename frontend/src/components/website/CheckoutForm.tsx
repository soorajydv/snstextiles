'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { appPath } from '@/lib/paths';
import { SiteRequestError, fetchSiteUser, npr, siteImage, siteRequest, type SiteUser } from '@/lib/site-client';
import type { SiteSettings } from '@/lib/types';
import { AuthForms } from './AuthForms';
import { itemQuantity, useCart } from './cart';
import { itemSummary, useLivePrices } from './CartView';
import { SiteIcon } from './SiteIcon';

const ADVANCE_METHODS = ['eSewa', 'Khalti', 'Fonepay', 'Bank transfer', 'Other'] as const;
const DESIGN_ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf,.ai,.eps,.svg,.psd,.cdr';
const MAX_FILE_BYTES = 15 * 1024 * 1024;

type Result = { checkoutRef: string; total: number; advance: number; orders: { id: string; orderNo: string; productName: string; quantity: number; totalAmount: number }[] };

/** Today + lead days as YYYY-MM-DD in Kathmandu time, matching the server's check. */
function earliestDate(leadDays: number) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + leadDays);
  return d.toISOString().slice(0, 10);
}

export function CheckoutForm({ checkout, paymentHtml }: { checkout: SiteSettings['checkout']; paymentHtml: string }) {
  const { items, ready, subtotal, count, clear } = useCart();
  const { live, problems } = useLivePrices();
  const [user, setUser] = useState<SiteUser | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const minDate = useMemo(() => earliestDate(checkout.minLeadDays), [checkout.minLeadDays]);
  const [shipping, setShipping] = useState({ method: checkout.deliveryMethods[0] ?? '', recipient: '', phone: '', address: '', city: '' });
  const [dueDate, setDueDate] = useState(minDate);
  const [notes, setNotes] = useState('');
  const [designs, setDesigns] = useState<Record<string, File[]>>({});
  const [payNow, setPayNow] = useState(false);
  const [advance, setAdvance] = useState({ amount: '', method: 'eSewa' as (typeof ADVANCE_METHODS)[number], reference: '' });
  const [proof, setProof] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => { fetchSiteUser().then((u) => { setUser(u); setUserLoaded(true); }); }, []);
  useEffect(() => {
    if (user) setShipping((s) => ({ ...s, recipient: s.recipient || user.name, phone: s.phone || user.phone || '' }));
  }, [user]);

  const needsAddress = /deliver/i.test(shipping.method);
  const isCustomer = user?.role === 'customer';

  function pickDesigns(key: string, files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, 3);
    const tooBig = list.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) { setError(`${tooBig.name} is larger than 15 MB.`); return; }
    setError('');
    setDesigns((d) => ({ ...d, [key]: list }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (problems.some(Boolean)) { setError('Please fix the items in your cart first.'); return; }
    if (!agree) { setError('Please confirm the order details.'); return; }
    const amount = payNow ? Number(advance.amount) || 0 : 0;
    if (payNow && amount <= 0) { setError('Enter the advance amount you paid, or choose “Pay later”.'); return; }
    if (payNow && !proof) { setError('Upload a screenshot of your payment.'); return; }
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('data', JSON.stringify({
      items: items.map((item) => ({
        productId: item.productId, sizes: item.sizes, sleeve: item.sleeve || undefined, neckType: item.neckType || undefined,
        color: item.color, teamName: item.teamName, players: item.players, notes: item.notes,
      })),
      dueDate,
      shipping,
      notes,
      advance: { amount, method: advance.method, reference: advance.reference },
    }));
    items.forEach((item, index) => (designs[item.key] ?? []).forEach((file) => form.append(`design_${index}`, file)));
    if (payNow && proof) form.append('advanceProof', proof);
    try {
      const response = await siteRequest<Result>('/public/site/checkout', { form });
      setResult(response);
      clear();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof SiteRequestError ? err.message.replace(/^[\w.]+: /, '') : 'Could not place your order. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="wrap section-sm">
        <div className="confirm-card">
          <span className="confirm-icon"><SiteIcon name="check" size={32} /></span>
          <p className="site-kicker">Order received · {result.checkoutRef}</p>
          <h2>Thank you{user ? `, ${user.name.split(' ')[0]}` : ''}!</h2>
          <p>We have created {result.orders.length === 1 ? 'your order' : `${result.orders.length} orders`}. Our design team will prepare a mockup for your approval before production starts — we will email you when it is ready.</p>
          <table className="confirm-table">
            <thead><tr><th>Order</th><th>Product</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>
              {result.orders.map((o) => (
                <tr key={o.id}>
                  <td><a href={appPath(`/orders/${o.id}`)}>{o.orderNo}</a></td>
                  <td>{o.productName}</td>
                  <td>{o.quantity}</td>
                  <td>{npr(o.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="confirm-total">Total {npr(result.total)}{result.advance > 0 && <> · Advance submitted {npr(result.advance)} (awaiting verification)</>}</p>
          <div className="hero-actions">
            <Link className="site-btn site-btn-dark" href="/account">View my orders</Link>
            <Link className="site-btn" href="/shop">Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!ready || !userLoaded) return <div className="wrap section-sm"><p className="muted">Loading checkout…</p></div>;
  if (!items.length) {
    return (
      <div className="wrap section-sm"><div className="empty-state"><h2>Your cart is empty</h2><p>Add something to your cart before checking out.</p><Link className="site-btn site-btn-dark" href="/shop">Go to the shop</Link></div></div>
    );
  }

  return (
    <div className="wrap cart-layout section-sm">
      <div className="checkout-steps">
        {/* ---- 1. account ---- */}
        <section className="checkout-step">
          <h2><span>1</span> Account</h2>
          {!user ? (
            <>
              <p className="muted">Please sign in or create an account to place your order. You will use it to approve your design and follow production.</p>
              <AuthForms compact onSignedIn={(u) => setUser(u)} />
            </>
          ) : !isCustomer ? (
            <p className="form-error">You are signed in as staff ({user.email}). Shop orders must be placed from a customer account — use the <a href={appPath('/orders/new')}>portal order form</a> to order on behalf of a customer.</p>
          ) : (
            <p className="checkout-user"><SiteIcon name="user" size={18} /> Signed in as <strong>{user.name}</strong>{user.customer ? ` (${user.customer.name})` : ''} · {user.email}</p>
          )}
        </section>

        {isCustomer && (
          <form className="checkout-form" onSubmit={submit}>
            {/* ---- 2. delivery ---- */}
            <section className="checkout-step">
              <h2><span>2</span> Delivery</h2>
              <div className="chips">
                {checkout.deliveryMethods.map((m) => <label className="chip" key={m}><input checked={shipping.method === m} name="method" onChange={() => setShipping({ ...shipping, method: m })} type="radio" />{m}</label>)}
              </div>
              <div className="form-row">
                <label className="buy-field"><span>Recipient name *</span><input autoComplete="name" onChange={(e) => setShipping({ ...shipping, recipient: e.target.value })} required value={shipping.recipient} /></label>
                <label className="buy-field"><span>Phone *</span><input autoComplete="tel" inputMode="tel" minLength={6} onChange={(e) => setShipping({ ...shipping, phone: e.target.value })} required value={shipping.phone} /></label>
              </div>
              {needsAddress && (
                <div className="form-row">
                  <label className="buy-field"><span>Address *</span><input autoComplete="street-address" onChange={(e) => setShipping({ ...shipping, address: e.target.value })} required value={shipping.address} /></label>
                  <label className="buy-field"><span>City</span><input autoComplete="address-level2" onChange={(e) => setShipping({ ...shipping, city: e.target.value })} value={shipping.city} /></label>
                </div>
              )}
              <label className="buy-field buy-field-narrow"><span>Needed by *</span><input min={minDate} onChange={(e) => setDueDate(e.target.value)} required type="date" value={dueDate} /></label>
              {checkout.deliveryNote && <p className="buy-hint"><SiteIcon name="truck" size={16} /> {checkout.deliveryNote}</p>}
            </section>

            {/* ---- 3. designs ---- */}
            <section className="checkout-step">
              <h2><span>3</span> Your designs <em>optional</em></h2>
              <p className="muted">Upload a logo, artwork or reference photo for each item (PNG, JPG, PDF, AI, EPS, SVG, PSD or CDR, up to 3 files, 15 MB each).</p>
              {items.map((item) => (live[item.productId]?.allowDesignUpload ?? true) && (
                <label className="upload-row" key={item.key}>
                  <span><strong>{item.name}</strong>{(designs[item.key] ?? []).length > 0 && <small>{designs[item.key].map((f) => f.name).join(', ')}</small>}</span>
                  <input accept={DESIGN_ACCEPT} multiple onChange={(e) => pickDesigns(item.key, e.target.files)} type="file" />
                </label>
              ))}
              <label className="buy-field"><span>Order notes</span><textarea maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else we should know?" rows={3} value={notes} /></label>
            </section>

            {/* ---- 4. payment ---- */}
            <section className="checkout-step">
              <h2><span>4</span> Payment</h2>
              <div className="chips">
                <label className="chip"><input checked={!payNow} name="pay" onChange={() => setPayNow(false)} type="radio" />Pay later</label>
                <label className="chip"><input checked={payNow} name="pay" onChange={() => setPayNow(true)} type="radio" />I have paid an advance</label>
              </div>
              {paymentHtml && <div className="prose prose-sm payment-box" dangerouslySetInnerHTML={{ __html: paymentHtml }} />}
              {payNow && (
                <>
                  <div className="form-row">
                    <label className="buy-field"><span>Paid via *</span><select onChange={(e) => setAdvance({ ...advance, method: e.target.value as (typeof ADVANCE_METHODS)[number] })} value={advance.method}>{ADVANCE_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
                    <label className="buy-field"><span>Amount paid (NPR) *</span><input inputMode="decimal" max={subtotal} min={1} onChange={(e) => setAdvance({ ...advance, amount: e.target.value })} required type="number" value={advance.amount} /></label>
                  </div>
                  <div className="form-row">
                    <label className="buy-field"><span>Transaction ID</span><input onChange={(e) => setAdvance({ ...advance, reference: e.target.value })} value={advance.reference} /></label>
                    <label className="buy-field"><span>Payment screenshot *</span><input accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setProof(e.target.files?.[0] ?? null)} required type="file" /></label>
                  </div>
                </>
              )}
            </section>

            <label className="agree"><input checked={agree} onChange={(e) => setAgree(e.target.checked)} type="checkbox" /> I confirm the sizes, names and numbers are correct. I understand production starts after I approve the design mockup.</label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="site-btn site-btn-dark checkout-submit" disabled={busy} type="submit">{busy ? 'Placing order…' : `Place order · ${npr(subtotal)}`}</button>
          </form>
        )}
      </div>

      <aside className="cart-summary">
        <h2>Your order</h2>
        <ul className="summary-items">
          {items.map((item, i) => (
            <li key={item.key}>
              <span className="summary-thumb">{item.image ? <img alt="" src={siteImage(item.image)} /> : <SiteIcon name="shirt" size={22} />}<b>{itemQuantity(item)}</b></span>
              <span><strong>{item.name}</strong><small>{Object.entries(item.sizes).filter(([, q]) => q).map(([s, q]) => `${s}×${q}`).join(', ')}{itemSummary(item) ? ` · ${itemSummary(item)}` : ''}</small>{problems[i] && <small className="form-error">{problems[i]}</small>}</span>
              <span>{npr(itemQuantity(item) * item.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <dl>
          <div><dt>Pieces</dt><dd>{count}</dd></div>
          <div><dt>Subtotal</dt><dd>{npr(subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd>Confirmed after order</dd></div>
          <div className="cart-total"><dt>Total</dt><dd>{npr(subtotal)}</dd></div>
        </dl>
        <Link className="text-link" href="/cart">← Edit cart</Link>
      </aside>
    </div>
  );
}
