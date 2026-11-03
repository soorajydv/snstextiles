'use client';

import { useParams } from 'next/navigation';
import { useApi } from '@/lib/api';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { Notice, Spinner } from '@/components/ui';
import { fmtDate, fmtMoney } from '@/lib/format';
import type { Order, Payment } from '@/lib/types';

function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useAuth();
  const { data, error } = useApi<{ order: Order }>(`/orders/${id}`);
  const payments = useApi<{ payments: Payment[] }>(`/payments?order=${id}`);

  if (error) return <div style={{ padding: 30 }}><Notice tone="error">{error}</Notice></div>;
  if (!data) return <Spinner />;
  const o = data.order;
  const isInvoice = !!o.invoice?.number;

  // Group the roster into size lines for the document.
  const sizeLines = new Map<string, number>();
  o.players.forEach((p) => p.jerseySize && sizeLines.set(p.jerseySize, (sizeLines.get(p.jerseySize) ?? 0) + 1));

  return (
    <>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
        <button className="btn primary" onClick={() => window.print()}>Print / save as PDF</button>
        <button className="btn" onClick={() => window.close()}>Close</button>
      </div>
      <div className="print-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 30 }}>
          <div>
            {settings.logoUrl && <img src={settings.logoUrl} alt="Business logo" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />}
            <div style={{ fontSize: 20, fontWeight: 800 }}>{settings.businessName}</div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: '#56645b' }}>
              {settings.address && <>{settings.address}<br /></>}
              {settings.phone && <>{settings.phone}<br /></>}
              {settings.email && <>{settings.email}<br /></>}
              {settings.panNumber && <>PAN/VAT: {settings.panNumber}</>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em' }}>{isInvoice ? 'INVOICE' : 'QUOTATION'}</div>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              {isInvoice && <><strong>{o.invoice!.number}</strong><br />Date: {fmtDate(o.invoice!.issuedAt)}<br /></>}
              {!isInvoice && <>Date: {fmtDate(new Date())}<br /></>}
              Order: {o.orderNo}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 24, fontSize: 12, lineHeight: 1.7 }}>
          <div>
            <div className="eyebrow">Bill to</div>
            <strong style={{ fontSize: 14 }}>{o.customer.name}</strong>
            {o.customer.phone && <><br />{o.customer.phone}</>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow">Delivery</div>
            Requested: {fmtDate(o.dueDate)}
            {o.delivery.deliveredAt && <><br />Delivered: {fmtDate(o.delivery.deliveredAt)}</>}
          </div>
        </div>

        <table>
          <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
          <tbody>
            <tr>
              <td className="wrap">
                <strong>{o.productConfig}</strong>
                <div style={{ fontSize: 11, color: '#6c7a71', marginTop: 4 }}>
                  {o.teamName} · {o.neckType}{o.shortsColor ? ` · ${o.shortsColor} shorts` : ''}
                  {sizeLines.size > 0 && <><br />Sizes: {[...sizeLines.entries()].map(([s, n]) => `${s}×${n}`).join(', ')}</>}
                </div>
              </td>
              <td className="num">{o.quantity}</td>
              <td className="num">{fmtMoney(o.unitRate)}</td>
              <td className="num">{fmtMoney(o.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <div style={{ width: 280 }}>
            <div className="kv"><span>Total</span><strong>{fmtMoney(o.totalAmount)}</strong></div>
            <div className="kv"><span>Paid</span><strong>{fmtMoney(o.amountPaid)}</strong></div>
            <div className="kv" style={{ fontSize: 14 }}><span>Balance due</span><strong>{fmtMoney(o.balance)}</strong></div>
          </div>
        </div>

        {payments.data && payments.data.payments.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginTop: 24, marginBottom: 6 }}>Payments received</div>
            <table>
              <tbody>
                {payments.data.payments.map((p) => (
                  <tr key={p.id}><td>{fmtDate(p.receivedAt)}</td><td>{p.method}{p.reference ? ` · ${p.reference}` : ''}</td><td className="num">{fmtMoney(p.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div style={{ marginTop: 36, paddingTop: 14, borderTop: '1px solid #e0e6df', fontSize: 11, color: '#6c7a71', textAlign: 'center' }}>
          {settings.invoiceFooter}
          {!isInvoice && <><br />This quotation is valid for 15 days. Production begins after artwork approval.</>}
        </div>
      </div>
    </>
  );
}

export default function InvoicePage() {
  return (
    <AuthProvider>
      <InvoiceView />
    </AuthProvider>
  );
}
