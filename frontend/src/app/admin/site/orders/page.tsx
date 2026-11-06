'use client';

import { useEffect, useState } from 'react';
import { AppLink as Link } from '@/components/AppLink';
import { useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Notice, OrderTable, PageHeader, Spinner } from '@/components/ui';
import { canSeeMoney } from '@/lib/format';
import type { Order } from '@/lib/types';

const PAGE_SIZE = 50;

export default function WebsiteOrdersPage() {
  const { user, meta } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [debounced, stage]);

  const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), source: 'website', sort: 'recent' });
  if (debounced) qs.set('search', debounced);
  if (stage) qs.set('stage', stage);
  const allowed = meta.permissions.includes('orders.view');
  const { data, error, loading } = useApi<{ orders: Order[]; total: number }>(allowed ? `/orders?${qs}` : null);
  if (!allowed) return <Notice tone="error">You need permission to view orders.</Notice>;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        eyebrow="WEBSITE"
        title="Website orders"
        subtitle="Orders placed through the online shop. Each one is a normal production order — open it to send the design mockup, record payments and dispatch."
      />
      <div className="toolbar">
        <div className="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order number, team or customer…" aria-label="Search website orders" /></div>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="">All stages</option>
          {meta.stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data && loading ? <Spinner /> : (
          <OrderTable
            orders={data?.orders ?? []}
            showMoney={canSeeMoney(user.role, meta.permissions)}
            actions={(order) => (
              <div className="table-actions">
                {order.checkoutRef && <span className="pill gray-bg" title="Website checkout reference">{order.checkoutRef}</span>}
                <Link className="btn small" href={`/orders/${order.id}`}>Open</Link>
              </div>
            )}
          />
        )}
      </div>
      {data && pages > 1 && (
        <div className="toolbar" style={{ marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="small muted">Page {page} of {pages}</span>
          <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </>
  );
}
