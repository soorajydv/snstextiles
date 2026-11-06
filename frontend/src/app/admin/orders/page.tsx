'use client';

import { useEffect, useState } from 'react';
import { AppLink as Link } from '@/components/AppLink';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Notice, OrderTable, PageHeader, Spinner } from '@/components/ui';
import { ConfirmModal, errorMessage } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { canSeeMoney } from '@/lib/format';
import type { Order } from '@/lib/types';

const STATUSES = ['Design in progress', 'Awaiting approval', 'Changes requested', 'Design approved', 'In production', 'Quality check', 'Ready to dispatch', 'Delivered'];
const PAGE_SIZE = 50;

export default function OrdersPage() {
  const { user, meta } = useAuth();
  const toast = useToast();
  const isCustomer = user.role === 'customer';
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [due, setDue] = useState('');
  const [sort, setSort] = useState('deadline');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Order | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, stage, status, due, sort, source]);

  const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debounced) qs.set('search', debounced);
  if (stage) qs.set('stage', stage);
  if (status) qs.set('status', status);
  if (due) qs.set('due', due);
  qs.set('sort', sort);
  if (source) qs.set('source', source);
  const { data, error, loading, reload } = useApi<{ orders: Order[]; total: number }>(`/orders?${qs}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function deleteOrder() {
    if (!deleting) return;
    try {
      await api(`/orders/${deleting.id}`, { method: 'DELETE' });
      toast(`${deleting.orderNo} deleted`);
      setDeleting(null);
      await reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={isCustomer ? 'CUSTOMER PORTAL' : 'ORDER REGISTER'}
        title={isCustomer ? 'My orders' : 'Order management'}
        subtitle="Track every order from first request through delivery."
        actions={meta.permissions.includes('orders.create') && <Link href="/orders/new" className="btn primary">＋ {isCustomer ? 'Place an order' : 'Create order'}</Link>}
      />
      <div className="toolbar">
        <div className="search">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order number, team or customer…" aria-label="Search orders" />
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="">All stages</option>
          {meta.stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={due} onChange={(e) => setDue(e.target.value)} aria-label="Deadline filter">
          <option value="">All deadlines</option>
          <option value="soon">Due in next 7 days</option>
          <option value="overdue">Overdue only</option>
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Order source">
          <option value="">All sources</option>
          <option value="website">Website shop</option>
          <option value="portal">Portal / staff</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort orders">
          <option value="deadline">Nearest deadline</option>
          <option value="recent">Recently added</option>
          <option value="oldest">Oldest added</option>
        </select>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
  <div className="card flush">{!data && loading ? <Spinner /> : <OrderTable orders={data?.orders ?? []} showMoney={canSeeMoney(user.role, meta.permissions)} actions={(order) => <div className="table-actions"><Link className="btn small" href={`/orders/${order.id}`}>{meta.permissions.includes('orders.update') ? 'Edit' : 'View'}</Link>{meta.permissions.includes('orders.delete') && order.stage === 'design' && <button className="btn small danger" onClick={() => setDeleting(order)}>Delete</button>}</div>} />}</div>
      {data && (
        <div className="toolbar" style={{ marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="subtitle">{data.total} order{data.total === 1 ? '' : 's'}{user.role !== 'owner' && user.role !== 'accounts' && !isCustomer ? ' in your department queue' : ''}</div>
          {pages > 1 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span className="small muted">Page {page} of {pages}</span>
              <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}
      {deleting && <ConfirmModal title="Delete order" message={`Delete ${deleting.orderNo}? This cannot be undone.`} confirmLabel="Delete order" onClose={() => setDeleting(null)} onConfirm={deleteOrder} />}
    </>
  );
}
