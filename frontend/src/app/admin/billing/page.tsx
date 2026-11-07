'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { AppLink as Link } from '@/components/AppLink';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, ConfirmModal, Empty, Notice, PageHeader, Spinner, StatCard, errorMessage } from '@/components/ui';
import { RecordPaymentModal } from '@/components/OrderModals';
import { fmtDate, fmtMoney } from '@/lib/format';
import type { Customer, Order, Payment, Permission } from '@/lib/types';
import { appPath, assetPath } from '@/lib/paths';

const PAGE_SIZE = 25;

type Tab = 'invoices' | 'payments';
type PaymentState = '' | 'quote' | 'unpaid' | 'part' | 'paid';
type PaymentStatus = '' | 'pending' | 'verified' | 'rejected';

type BillingSummary = {
  orders: number;
  sets: number;
  orderValue: number;
  collected: number;
  outstanding: number;
  invoicesIssued: number;
  awaitingPrice: number;
  payments: Record<'verified' | 'pending' | 'rejected', { amount: number; count: number }>;
  customer: { id: string; name: string; contactPerson: string; phone: string; email: string; address: string; panNumber: string } | null;
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Quick date ranges for statements and follow-ups. */
function presetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'month': return { from: ymd(new Date(y, m, 1)), to: ymd(now) };
    case 'last-month': return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case 'quarter': return { from: ymd(new Date(y, m - 2, 1)), to: ymd(now) };
    case 'year': return { from: ymd(new Date(y, 0, 1)), to: ymd(now) };
    default: return { from: '', to: '' };
  }
}

const payState = (o: Order) => (!o.totalAmount ? 'To quote' : o.balance === 0 ? 'Paid' : o.amountPaid ? 'Part paid' : 'Unpaid');
const paymentLabel = (p: Payment) => (p.status === 'pending' ? 'Pending verification' : p.status === 'rejected' ? 'Rejected' : p.status === 'reversed' ? 'Reversed' : 'Verified');

function Billing() {
  const { user, meta } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const isCustomer = user.role === 'customer';
  const can = (p: Permission) => meta.permissions.includes(p);
  const canPickCustomer = !isCustomer && can('customers.view');
  const canRecord = can('payments.record');
  const canExport = can('payments.export');

  const customer = params.get('customer') ?? '';
  const tab: Tab = params.get('tab') === 'payments' ? 'payments' : 'invoices';
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');
  const [state, setState] = useState<PaymentState>('');
  const [status, setStatus] = useState<PaymentStatus>('');
  const [page, setPage] = useState(1);
  const [recording, setRecording] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  useEffect(() => setPage(1), [customer, from, to, state, status, tab]);

  /** Filters shared by the summary, both tables and the CSV exports. */
  const shared = useMemo(() => {
    const qs = new URLSearchParams();
    if (customer) qs.set('customer', customer);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return qs;
  }, [customer, from, to]);

  const orderQs = new URLSearchParams(shared);
  if (state) orderQs.set('payment', state);
  const paymentQs = new URLSearchParams(shared);
  if (status) paymentQs.set('status', status);

  const customers = useApi<{ customers: Customer[] }>(canPickCustomer ? '/customers?limit=200' : null);
  const summary = useApi<BillingSummary>(`/payments/summary?${shared}`);
  const orders = useApi<{ orders: Order[]; total: number }>(tab === 'invoices' ? `/orders?${orderQs}&sort=recent&page=${page}&limit=${PAGE_SIZE}` : null);
  const payments = useApi<{ payments: Payment[]; total: number }>(tab === 'payments' ? `/payments?${paymentQs}&page=${page}&limit=${PAGE_SIZE}` : null);
  const payable = useApi<{ orders: Order[] }>(recording ? `/orders?${shared}&payment=due&sort=recent&limit=200` : null);

  function setUrl(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); }
    const qs = next.toString();
    router.replace(qs ? appPath(`/billing?${qs}`) : appPath('/billing'));
  }

  function applyPreset(preset: string) {
    const range = presetRange(preset);
    setFrom(range.from);
    setTo(range.to);
  }

  function clearFilters() {
    setFrom('');
    setTo('');
    setState('');
    setStatus('');
    if (customer) setUrl({ customer: '' });
  }

  function reloadAll() {
    summary.reload();
    if (tab === 'invoices') orders.reload(); else payments.reload();
  }

  async function deletePayment(p: Payment) {
    try {
      await api(`/payments/${p.id}`, { method: 'DELETE' });
      setPaymentToDelete(null);
      toast('Payment deleted');
      reloadAll();
    } catch (err) { toast(errorMessage(err), 'error'); }
  }

  async function verifyPayment(p: Payment) {
    try {
      await api(`/payments/${p.id}/verify`, { method: 'POST' });
      toast('Payment verified');
      reloadAll();
    } catch (err) { toast(errorMessage(err), 'error'); }
  }

  async function rejectPayment(p: Payment) {
    const reason = window.prompt('Reason for rejecting this payment:');
    if (!reason?.trim()) return;
    try {
      await api(`/payments/${p.id}/reject`, { method: 'POST', body: { reason } });
      toast('Payment rejected');
      reloadAll();
    } catch (err) { toast(errorMessage(err), 'error'); }
  }

  const s = summary.data;
  const selected = s?.customer ?? null;
  const filtersActive = Boolean(customer || from || to || state || status);
  const list = tab === 'invoices' ? orders : payments;
  const total = (tab === 'invoices' ? orders.data?.total : payments.data?.total) ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportHref = (kind: 'invoices' | 'payments' | 'statement') => appPath(`/api/payments/export/${kind}.csv?${kind === 'invoices' ? orderQs : kind === 'payments' ? paymentQs : shared}`);
  const showActions = can('payments.verify') || can('payments.delete');
  const periodLabel = from || to ? `${from ? fmtDate(from) : 'Start'} – ${to ? fmtDate(to) : 'today'}` : 'All time';

  return (
    <div className="billing-page">
      <PageHeader
        eyebrow={isCustomer ? 'CUSTOMER PORTAL' : 'ACCOUNTS'}
        title={isCustomer ? 'Invoices & payments' : 'Quotations & billing'}
        subtitle={isCustomer ? 'Your order totals, payments and balances.' : 'View any customer’s orders, invoices and payments, record payments and export statements.'}
        actions={(
          <div className="header-actions">
            {canExport && <a className="btn" href={exportHref(tab)} download>⇩ Export {tab === 'invoices' ? 'orders' : 'payments'}</a>}
            {canRecord && <button className="btn primary" onClick={() => setRecording(true)}>＋ Record payment</button>}
          </div>
        )}
      />
      {paymentToDelete && <ConfirmModal title="Delete payment" message={`Delete payment of ${fmtMoney(paymentToDelete.amount)} on ${paymentToDelete.order.orderNo}?`} confirmLabel="Delete payment" onClose={() => setPaymentToDelete(null)} onConfirm={() => deletePayment(paymentToDelete)} />}

      <section className="filter-bar card" aria-label="Billing filters">
        {canPickCustomer && (
          <label className="field filter-wide">
            <span>Customer</span>
            <select value={customer} onChange={(e) => setUrl({ customer: e.target.value })}>
              <option value="">All customers</option>
              {(customers.data?.customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="field"><span>From</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field"><span>To</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        {tab === 'invoices' ? (
          <label className="field"><span>Payment state</span>
            <select value={state} onChange={(e) => setState(e.target.value as PaymentState)}>
              <option value="">All orders</option>
              <option value="unpaid">Unpaid</option>
              <option value="part">Part paid</option>
              <option value="paid">Paid</option>
              <option value="quote">Awaiting price</option>
            </select>
          </label>
        ) : (
          <label className="field"><span>Payment status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
              <option value="">All payments</option>
              <option value="pending">Pending verification</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        )}
        <div className="filter-presets">
          <span>Period</span>
          <div>
            {[['month', 'This month'], ['last-month', 'Last month'], ['quarter', '3 months'], ['year', 'This year'], ['all', 'All time']].map(([key, label]) => (
              <button key={key} type="button" className="chip-btn" onClick={() => applyPreset(key)}>{label}</button>
            ))}
            {filtersActive && <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>}
          </div>
        </div>
      </section>

      {selected && (
        <section className="card customer-summary">
          <div>
            <div className="eyebrow">Customer</div>
            <h2>{selected.name}</h2>
            <div className="customer-summary-meta">
              {selected.contactPerson && <span>{selected.contactPerson}</span>}
              {selected.phone && <a href={`tel:${selected.phone}`}>{selected.phone}</a>}
              {selected.email && <a href={`mailto:${selected.email}`}>{selected.email}</a>}
              {selected.address && <span>{selected.address}</span>}
              {selected.panNumber && <span>PAN {selected.panNumber}</span>}
            </div>
          </div>
          <div className="customer-summary-actions">
            <span className="muted small">{periodLabel}</span>
            {canExport && <a className="btn primary" href={exportHref('statement')} download>⇩ Download statement</a>}
          </div>
        </section>
      )}

      <div className="stats">
        <StatCard label="Order value" value={s ? fmtMoney(s.orderValue) : '—'} note={s ? `${s.orders} order${s.orders === 1 ? '' : 's'} · ${s.sets} sets` : ' '} icon="▱" />
        <StatCard label="Collected" value={s ? fmtMoney(s.collected) : '—'} note={s?.payments.pending.count ? `${fmtMoney(s.payments.pending.amount)} awaiting verification` : 'Verified payments'} icon="↙" tone="green" />
        <StatCard label="Outstanding" value={s ? fmtMoney(s.outstanding) : '—'} note="Order value less payments" icon="◷" tone={s?.outstanding ? 'amber' : 'green'} />
        <StatCard label="Invoices issued" value={s?.invoicesIssued ?? '—'} note={s ? `${s.awaitingPrice} order${s.awaitingPrice === 1 ? '' : 's'} awaiting a price` : ' '} icon="▤" />
      </div>
      {summary.error && <Notice tone="error">{summary.error}</Notice>}

      <section className="card flush billing-results">
        <div className="billing-results-head">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'invoices'} className={tab === 'invoices' ? 'active' : ''} onClick={() => setUrl({ tab: '' })}>Orders & invoices</button>
            <button role="tab" aria-selected={tab === 'payments'} className={tab === 'payments' ? 'active' : ''} onClick={() => setUrl({ tab: 'payments' })}>
              Payment ledger{s?.payments.pending.count ? <span className="tab-count">{s.payments.pending.count}</span> : null}
            </button>
          </div>
          <span className="muted small">{list.data ? `${total} ${tab === 'invoices' ? 'order' : 'payment'}${total === 1 ? '' : 's'}` : ''}</span>
        </div>
        {list.error && <div style={{ padding: 14 }}><Notice tone="error">{list.error}</Notice></div>}
        {tab === 'invoices' ? (
          !orders.data ? <Spinner /> : !orders.data.orders.length ? <Empty>No orders match these filters.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Order</th><th>Invoice</th>{!customer && !isCustomer && <th>Customer</th>}<th>Ordered</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th><th>Payment</th><th /></tr></thead>
                <tbody>
                  {orders.data.orders.map((o) => (
                    <tr key={o.id}>
                      <td><Link className="order-id" href={`/orders/${o.id}`}>{o.orderNo}</Link><div className="muted small">{o.teamName}</div></td>
                      <td>{o.invoice?.number ? <strong>{o.invoice.number}</strong> : <span className="muted">Not issued</span>}</td>
                      {!customer && !isCustomer && <td>{canPickCustomer ? <button className="link-btn" onClick={() => setUrl({ customer: o.customer.id })} title="Show this customer only">{o.customer.name}</button> : o.customer.name}</td>}
                      <td>{fmtDate(o.createdAt)}</td>
                      <td className="num">{o.totalAmount ? fmtMoney(o.totalAmount) : '—'}</td>
                      <td className="num">{fmtMoney(o.amountPaid)}</td>
                      <td className="num"><strong>{fmtMoney(o.balance)}</strong></td>
                      <td><Badge>{payState(o)}</Badge></td>
                      <td><Link className="btn small" href={`/invoice/${o.id}`} target="_blank">{o.invoice?.number ? 'Invoice' : 'Quotation'}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          !payments.data ? <Spinner /> : !payments.data.payments.length ? <Empty>No payments match these filters.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Order</th>{!customer && !isCustomer && <th>Customer</th>}<th>Method</th><th>Reference</th><th>Proof</th><th className="num">Amount</th><th>Status</th><th>Recorded by</th>{showActions && <th />}</tr></thead>
                <tbody>
                  {payments.data.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.receivedAt)}</td>
                      <td>{p.order.id ? <Link className="order-id" href={`/orders/${p.order.id}`}>{p.order.orderNo || 'View order'}</Link> : <span className="muted">—</span>}</td>
                      {!customer && !isCustomer && <td>{canPickCustomer ? <button className="link-btn" onClick={() => setUrl({ customer: p.customer.id })} title="Show this customer only">{p.customer.name}</button> : p.customer.name}</td>}
                      <td>{p.method}</td>
                      <td>{p.reference || <span className="muted">—</span>}</td>
                      <td>{p.proof ? <a className="link-btn" href={assetPath(p.proof.url)} target="_blank" rel="noreferrer">View proof</a> : <span className="muted">—</span>}</td>
                      <td className="num"><strong>{fmtMoney(p.amount)}</strong></td>
                      <td className="wrap"><Badge>{paymentLabel(p)}</Badge>{p.rejectionReason && <div className="muted small">{p.rejectionReason}</div>}{p.reversalReason && <div className="muted small">{p.reversalReason}</div>}</td>
                      <td>{p.recordedBy || <span className="muted">—</span>}</td>
                      {showActions && (
                        <td>
                          <div className="table-actions">
                            {p.status === 'pending' && can('payments.verify') && <><button className="btn small primary" onClick={() => verifyPayment(p)}>Verify</button><button className="btn small danger" onClick={() => rejectPayment(p)}>Reject</button></>}
                            {['rejected', 'pending'].includes(p.status) && can('payments.delete') && <button className="btn small danger" onClick={() => setPaymentToDelete(p)}>Delete</button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {pages > 1 && (
          <div className="billing-pager">
            <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <span className="small muted">Page {page} of {pages}</span>
            <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        )}
      </section>

      {!isCustomer && <p className="billing-footnote">Invoice numbers are generated by the server in sequence and cannot be edited. Confirm VAT treatment and invoice format with your accountant.</p>}

      {recording && (
        payable.data ? (
          <RecordPaymentModal
            orders={payable.data.orders}
            onClose={() => setRecording(false)}
            onSaved={() => { setRecording(false); reloadAll(); }}
          />
        ) : <Spinner fullPage />
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Billing />
    </Suspense>
  );
}
