'use client';

import { useState } from 'react';
import { AppLink as Link } from '@/components/AppLink';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, ConfirmModal, DueDate, Empty, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { STAGE_ORDER, STAGE_SHORT, canCompleteStage, initials } from '@/lib/format';
import type { Order, Role, Stage } from '@/lib/types';

const COLUMNS: Record<string, Stage[]> = {
  design: ['design'],
  printing: ['printing'],
  stitching: ['stitching'],
  finishing: ['finishing', 'ready'],
};
const ALL: Stage[] = ['design', 'printing', 'stitching', 'finishing', 'ready'];

export default function ProductionPage() {
  const { user, meta } = useAuth();
  const toast = useToast();
  const { data, error, reload, setData } = useApi<{ orders: Order[] }>('/orders?limit=200');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [orderToAdvance, setOrderToAdvance] = useState<Order | null>(null);
  const columns = COLUMNS[user.role as Role] ?? ALL;
  const label = (s: Stage) => meta.stages.find((x) => x.key === s)?.label ?? s;

  async function advance(o: Order) {
    const next = STAGE_ORDER[STAGE_ORDER.indexOf(o.stage) + 1];
    setBusyId(o.id);
    try {
      const res = await api<{ order: Order }>(`/orders/${o.id}/advance`, { method: 'POST', body: {} });
      toast(`${o.orderNo} → ${res.order.stageLabel}`);
      setData((d) => d && { orders: d.orders.map((x) => (x.id === o.id ? res.order : x)) });
    } catch (err) {
      toast(errorMessage(err), 'error');
      reload();
    } finally {
      setOrderToAdvance(null);
      setBusyId(null);
    }
  }

  return (
    <>
      {orderToAdvance && <ConfirmModal title="Advance order" message={`Mark ${STAGE_SHORT[orderToAdvance.stage]} complete for ${orderToAdvance.orderNo} and move it to ${STAGE_SHORT[STAGE_ORDER[STAGE_ORDER.indexOf(orderToAdvance.stage) + 1]]}?`} confirmLabel="Advance order" danger={false} onClose={() => setOrderToAdvance(null)} onConfirm={() => advance(orderToAdvance)} />}
      <PageHeader
        eyebrow="SHOP FLOOR"
        title="Production board"
        subtitle="Each department works its own queue. A job moves forward only when its stage is complete and its gates are met."
        actions={<button className="btn" onClick={reload}>↻ Refresh</button>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {!data ? (
        <Spinner />
      ) : (
        <div className="production-grid" style={{ ['--cols' as string]: columns.length }}>
          {columns.map((stage) => {
            const jobs = data.orders.filter((o) => o.stage === stage).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            return (
              <div className="kanban-col" key={stage}>
                <div className="kanban-head">
                  <span>{label(stage)}</span>
                  <span className="kanban-count">{jobs.length}</span>
                </div>
                {jobs.map((o) => {
                  const gated = stage === 'design' && !o.approved;
                  const canMove = stage !== 'ready' && canCompleteStage(user.role, stage, meta.permissions);
                  return (
                    <div className="job-card" key={o.id}>
                      <div className="job-top">
                        <Link href={`/orders/${o.id}`} className="order-id">{o.orderNo}</Link>
                        <Badge>{o.status}</Badge>
                      </div>
                      <div className="job-name">{o.customer.name}</div>
                      <div className="job-meta">
                        {o.quantity} sets · {o.productConfig}
                        <br />
                        {o.neckType}
                        {o.shortsColor ? ` · ${o.shortsColor} shorts` : ''}
                        <br />
                        Due <DueDate order={o} />
                      </div>
                      <div className="bar-label">
                        <span>{o.currentVersion ? `Artwork v${o.currentVersion}` : 'No artwork yet'}</span>
                        <span>{o.approved ? 'Approved' : 'Approval pending'}</span>
                      </div>
                      <div className="progress"><span style={{ width: o.approved ? '100%' : o.currentVersion ? '50%' : '10%' }} /></div>
                      <div className="job-foot" style={{ marginTop: 11 }}>
                        <div className="avatar" style={{ width: 24, height: 24, fontSize: 9 }} title={o.customer.name}>{initials(o.teamName)}</div>
                        <Link className="btn small" href={`/orders/${o.id}`}>Open job →</Link>
                      </div>
                      {canMove && !gated && (
                        <button className="btn small primary block" style={{ marginTop: 10 }} disabled={busyId === o.id} onClick={() => setOrderToAdvance(o)}>
                          {busyId === o.id ? 'Moving…' : 'Mark stage complete →'}
                        </button>
                      )}
                      {canMove && gated && (
                        <Link className="btn small block" style={{ marginTop: 10 }} href={`/orders/${o.id}`}>
                          {o.currentVersion ? 'Awaiting customer approval' : 'Upload artwork →'}
                        </Link>
                      )}
                      {stage === 'ready' && meta.permissions.includes('orders.deliver') && (
                        <Link className="btn small primary block" style={{ marginTop: 10 }} href="/delivery">Dispatch →</Link>
                      )}
                    </div>
                  );
                })}
                {!jobs.length && <Empty>No jobs in this queue.</Empty>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
