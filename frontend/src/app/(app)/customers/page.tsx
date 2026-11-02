'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, ConfirmModal, Empty, Field, Modal, Notice, PageHeader, Spinner, StatCard, errorMessage } from '@/components/ui';
import { fmtDate, fmtMoney } from '@/lib/format';
import type { Customer, Order } from '@/lib/types';

export default function CustomersPage() {
  const { meta } = useAuth();
  const canManage = meta.permissions.includes('customers.manage');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced]);
  const customerParams = new URLSearchParams({ page: String(page), limit: '50' });
  if (debounced) customerParams.set('search', debounced);
  const { data, error, reload } = useApi<{ customers: Customer[]; total: number; limit: number }>(`/customers?${customerParams}`);
  const customers = data?.customers ?? [];
  const totals = customers.reduce((a, c) => ({ value: a.value + c.orderValue, outstanding: a.outstanding + c.outstanding, active: a.active + c.activeOrders }), { value: 0, outstanding: 0, active: 0 });

  async function remove(c: Customer) {
    try {
      await api(`/customers/${c.id}`, { method: 'DELETE' });
      setCustomerToDelete(null);
      toast(`${c.name} deleted`);
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="CUSTOMER DIRECTORY"
        title="Customers"
        subtitle="Clubs, schools and teams with their order history and balances."
        actions={canManage && <button className="btn primary" onClick={() => setEditing('new')}>＋ Add customer</button>}
      />
      {customerToDelete && <ConfirmModal title="Delete customer" message={`Delete ${customerToDelete.name}?`} confirmLabel="Delete customer" onClose={() => setCustomerToDelete(null)} onConfirm={() => remove(customerToDelete)} />}
      <div className="stats">
        <StatCard label="Customers" value={data?.total ?? '—'} note={debounced ? 'Matching search' : 'In directory'} icon="♙" />
        <StatCard label="With active orders" value={customers.filter((c) => c.activeOrders).length} note={`${totals.active} orders in progress`} icon="▤" />
        <StatCard label="Lifetime order value" value={fmtMoney(totals.value)} icon="↗" />
        <StatCard label="Outstanding" value={fmtMoney(totals.outstanding)} icon="◷" tone={totals.outstanding ? 'amber' : 'green'} />
      </div>
      <div className="toolbar">
        <div className="search">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, contact, phone or email…" aria-label="Search customers" />
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data ? (
          <Spinner />
        ) : !customers.length ? (
          <Empty>No customers found.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Customer / club</th><th>Contact</th><th className="num">Orders</th><th className="num">Order value</th><th className="num">Paid</th><th className="num">Outstanding</th><th>Account</th><th /></tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setViewing(c)}>
                    <td><strong>{c.name}</strong><div className="muted small" style={{ marginTop: 3 }}>{c.address || '—'}</div></td>
                    <td>{c.contactPerson || '—'}<div className="muted small" style={{ marginTop: 3 }}>{c.phone}</div></td>
                    <td className="num">{c.orderCount}{c.activeOrders ? <span className="muted small"> ({c.activeOrders} active)</span> : ''}</td>
                    <td className="num">{fmtMoney(c.orderValue)}</td>
                    <td className="num">{fmtMoney(c.paid)}</td>
                    <td className="num">{fmtMoney(c.outstanding)}</td>
                    <td><Badge>{c.orderCount === 0 ? 'New' : c.outstanding ? 'Balance due' : 'Settled'}</Badge></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {canManage && <button className="btn small" onClick={() => setEditing(c)}>Edit</button>}{canManage && ' '}
                      {meta.permissions.includes('customers.delete') && c.orderCount === 0 && <button className="btn small danger" onClick={() => setCustomerToDelete(c)}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && data.total > data.limit && <div className="toolbar" style={{ marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
        <span className="small muted">Page {page} of {Math.ceil(data.total / data.limit)}</span>
        <button className="btn small" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => setPage(page + 1)}>Next →</button>
      </div>}
      {editing && (
        <CustomerForm
          customer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {viewing && <CustomerDetail customer={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    contactPerson: customer?.contactPerson ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    panNumber: customer?.panNumber ?? '',
    notes: customer?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(customer ? `/customers/${customer.id}` : '/customers', { method: customer ? 'PATCH' : 'POST', body: form });
      toast(customer ? 'Customer updated' : `${form.name} added`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={customer ? `Edit ${customer.name}` : 'Add customer'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <div className="form-grid">
          <Field label="Customer / club name *" full><input required value={form.name} onChange={set('name')} /></Field>
          <Field label="Contact person"><input value={form.contactPerson} onChange={set('contactPerson')} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="PAN / VAT number"><input value={form.panNumber} onChange={set('panNumber')} /></Field>
          <Field label="Address" full><input value={form.address} onChange={set('address')} /></Field>
          <Field label="Notes" full><textarea rows={2} value={form.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save customer'}</button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerDetail({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { data } = useApi<{ customer: Customer; orders: (Order & { balance: number })[] }>(`/customers/${customer.id}`);
  return (
    <Modal title={customer.name} onClose={onClose} wide>
      <div className="two-col" style={{ marginBottom: 16 }}>
        <div>
          <div className="kv"><span>Contact</span><strong>{customer.contactPerson || '—'}</strong></div>
          <div className="kv"><span>Phone</span><strong>{customer.phone || '—'}</strong></div>
          <div className="kv"><span>Email</span><strong>{customer.email || '—'}</strong></div>
          <div className="kv"><span>Address</span><strong>{customer.address || '—'}</strong></div>
        </div>
        <div>
          <div className="kv"><span>Orders</span><strong>{customer.orderCount}</strong></div>
          <div className="kv"><span>Order value</span><strong>{fmtMoney(customer.orderValue)}</strong></div>
          <div className="kv"><span>Paid</span><strong>{fmtMoney(customer.paid)}</strong></div>
          <div className="kv"><span>Outstanding</span><strong className={customer.outstanding ? 'amber' : 'green'}>{fmtMoney(customer.outstanding)}</strong></div>
        </div>
      </div>
      {customer.notes && <Notice style={{ marginBottom: 16 }}>{customer.notes}</Notice>}
      <h3>Order history</h3>
      {!data ? (
        <Spinner />
      ) : !data.orders.length ? (
        <Empty>No orders yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th className="num">Qty</th><th>Status</th><th>Due</th><th className="num">Total</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td><Link className="order-id" href={`/orders/${o.id}`}>{o.orderNo}</Link></td>
                  <td className="num">{o.quantity}</td>
                  <td><Badge>{o.status}</Badge></td>
                  <td>{fmtDate(o.dueDate)}</td>
                  <td className="num">{fmtMoney(o.totalAmount)}</td>
                  <td className="num">{fmtMoney(o.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="form-actions">
        <Link className="btn" href={`/billing?customer=${customer.id}`}>Payments</Link>
        <button className="btn primary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
