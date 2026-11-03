'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Badge, DueDate, Empty, Notice, PageHeader, Spinner, StatCard } from '@/components/ui';
import { DeliverModal } from '@/components/OrderModals';
import { canSeeMoney, fmtDate, fmtMoney } from '@/lib/format';
import type { Order } from '@/lib/types';

type List = { orders: Order[]; total: number };

export default function DeliveryPage() {
  const { user, meta } = useAuth();
  const ready = useApi<List>('/orders?stage=ready&limit=200');
  const finishing = useApi<List>('/orders?stage=finishing&limit=200');
  const delivered = useApi<List>(user.role === 'finishing' ? null : '/orders?stage=delivered&limit=15');
  const [dispatching, setDispatching] = useState<Order | null>(null);
  const money = canSeeMoney(user.role, meta.permissions);

  const queue = [...(ready.data?.orders ?? []), ...(finishing.data?.orders ?? [])];

  return (
    <>
      <PageHeader eyebrow="DISPATCH" title="Delivery & dispatch" subtitle="Only the owner can confirm dispatch. Each delivery records packed quantity, recipient and method." />
      <div className="stats">
        <StatCard label="Ready to dispatch" value={ready.data?.total ?? '—'} note="Passed finishing & QC" icon="□" tone={ready.data?.total ? 'amber' : ''} />
        <StatCard label="In finishing" value={finishing.data?.total ?? '—'} note="Awaiting QC or packing" icon="◷" />
        <StatCard label="Delivered" value={delivered.data?.total ?? '—'} note="All time" icon="✓" tone="green" />
        <StatCard label="Overdue in queue" value={queue.filter((o) => new Date(o.dueDate) < new Date(new Date().toDateString())).length} note="Past requested date" icon="!" />
      </div>
      {(ready.error || finishing.error) && <Notice tone="error">{ready.error || finishing.error}</Notice>}
      <section className="card flush" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ padding: '18px 18px 0' }}><div><h2>Dispatch queue</h2><div className="card-sub">Finishing and ready orders, by due date</div></div></div>
        {!ready.data || !finishing.data ? <Spinner /> : !queue.length ? <Empty>No orders waiting for dispatch.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th className="num">Qty</th><th>Status</th><th>Due</th>{money && <th className="num">Balance</th>}<th>Action</th></tr></thead>
              <tbody>
                {queue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((o) => (
                  <tr key={o.id}>
                    <td><Link className="order-id" href={`/orders/${o.id}`}>{o.orderNo}</Link></td>
                    <td>{o.customer.name}</td>
                    <td className="num">{o.quantity}</td>
                    <td><Badge>{o.status}</Badge></td>
                    <td><DueDate order={o} /></td>
                    {money && <td className={`num ${o.balance ? 'amber' : ''}`}>{fmtMoney(o.balance)}</td>}
                    <td>
                      {o.stage === 'ready' && meta.permissions.includes('orders.deliver') ? (
                        <button className="btn small primary" onClick={() => setDispatching(o)}>Confirm dispatch</button>
                      ) : (
                        <span className="muted small">{o.stage === 'ready' ? 'Waiting for owner' : 'In QC / packing'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {delivered.data && (
        <section className="card flush">
          <div className="card-head" style={{ padding: '18px 18px 0' }}><div><h2>Recently delivered</h2></div></div>
          {!delivered.data.orders.length ? <Empty>No deliveries yet.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Order</th><th>Customer</th><th className="num">Packed</th><th>Delivered</th><th>Received by</th><th>Method</th><th>On time</th></tr></thead>
                <tbody>
                  {delivered.data.orders.map((o) => {
                    const due = new Date(o.dueDate);
                    due.setHours(23, 59, 59);
                    const onTime = o.delivery.deliveredAt && new Date(o.delivery.deliveredAt) <= due;
                    return (
                      <tr key={o.id}>
                        <td><Link className="order-id" href={`/orders/${o.id}`}>{o.orderNo}</Link></td>
                        <td>{o.customer.name}</td>
                        <td className="num">{o.delivery.packedQuantity ?? '—'} / {o.quantity}</td>
                        <td>{fmtDate(o.delivery.deliveredAt)}</td>
                        <td>{o.delivery.recipient || '—'}</td>
                        <td>{o.delivery.method || '—'}</td>
                        <td><Badge>{onTime ? 'On time' : 'Late'}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {dispatching && (
        <DeliverModal
          order={dispatching}
          onClose={() => setDispatching(null)}
          onSaved={() => {
            setDispatching(null);
            ready.reload();
            delivered.reload();
          }}
        />
      )}
    </>
  );
}
