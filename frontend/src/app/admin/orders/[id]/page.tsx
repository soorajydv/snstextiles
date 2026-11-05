'use client';

import { useState } from 'react';
import { AppLink as Link } from '@/components/AppLink';
import { useParams, useRouter } from 'next/navigation';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { LocalFilePreview } from '@/components/LocalFilePreview';
import { Badge, ConfirmModal, DueDate, Empty, Field, Modal, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { DeliverModal, EditOrderModal, RecordPaymentModal, TextPromptModal } from '@/components/OrderModals';
import { STAGE_ORDER, STAGE_SHORT, canCompleteStage, canSeeMoney, fileSize, fmtDate, fmtDateTime, fmtMoney } from '@/lib/format';
import type { Order, Payment, StoredFile } from '@/lib/types';
import { DESIGN_EXTENSIONS, validateUploadFile } from '@/lib/uploads';
import { assetPath, appPath } from '@/lib/paths';

type ModalKind = null | 'edit' | 'payment' | 'deliver' | 'advance' | 'sendBack' | 'feedback' | 'upload' | 'approve';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, meta } = useAuth();
  const { data, error, setData } = useApi<{ order: Order }>(`/orders/${id}`);
  const money = canSeeMoney(user.role, meta.permissions);
  const payments = useApi<{ payments: Payment[] }>(money ? `/payments?order=${id}` : null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [busy, setBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (error) {
    return (
      <>
        <Notice tone="error">{error}</Notice>
        <div style={{ marginTop: 12 }}><Link className="btn" href="/orders">← Back to orders</Link></div>
      </>
    );
  }
  if (!data) return <Spinner />;
  const order = data.order;
  const role = user.role;
  const update = (o: Order) => {
    setData({ order: o });
    setModal(null);
  };

  const stageIdx = STAGE_ORDER.indexOf(order.stage);
  const nextStage = STAGE_ORDER[stageIdx + 1];
  const isDesign = order.stage === 'design';
  const hasShorts = order.productConfig.toLowerCase().includes('shorts');
  const hasTrouser = order.productConfig.toLowerCase().includes('trouser');
  const canAdvance = order.stage !== 'ready' && order.stage !== 'delivered' && canCompleteStage(role, order.stage, meta.permissions);
  const cuttingBlocked = isDesign && order.cuttingStatus !== 'completed';
  const advanceBlocked = (isDesign && !order.approved) || cuttingBlocked;
  const paymentComplete = !!order.totalAmount && (order.balance ?? order.totalAmount - (order.amountPaid ?? 0)) <= 0;
  const canUpload = isDesign && meta.permissions.includes('orders.artwork.upload');
  const canApprove = isDesign && order.currentVersion > 0 && !order.approved && meta.permissions.includes('orders.approve');
  const canFeedback = isDesign && order.currentVersion > 0 && meta.permissions.includes('orders.feedback');
  const latestFeedback = order.feedback.filter((f) => f.version === order.currentVersion);

  async function issueInvoice() {
    setBusy(true);
    try {
      const res = await api<{ order: Order }>(`/orders/${order.id}/invoice`, { method: 'POST' });
      toast(`Invoice ${res.order.invoice?.number} issued`);
      update(res.order);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteOrder() {
    try {
      await api(`/orders/${order.id}`, { method: 'DELETE' });
      setDeleteConfirmOpen(false);
      toast(`${order.orderNo} deleted`);
      router.replace(appPath('/orders'));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <>
      <div style={{ marginBottom: 10 }}><Link className="link-btn" href="/orders" style={{ paddingLeft: 0 }}>← All orders</Link></div>
      <PageHeader
        eyebrow={`${order.orderNo} · ${order.customer.name}`}
        title={order.teamName}
        subtitle={`${order.quantity} sets · ${order.productConfig}`}
        actions={
          <>
            {meta.permissions.includes('orders.update') && order.stage !== 'delivered' && <button className="btn" onClick={() => setModal('edit')}>Edit</button>}
            {meta.permissions.includes('orders.send_back') && !['design', 'delivered'].includes(order.stage) && <button className="btn" onClick={() => setModal('sendBack')}>↩ Send back</button>}
            {meta.permissions.includes('orders.delete') && isDesign && <button className="btn danger" onClick={() => setDeleteConfirmOpen(true)}>Delete</button>}
            {canAdvance && (
              <button className="btn primary" disabled={advanceBlocked} title={advanceBlocked ? 'Waiting for customer artwork approval' : undefined} onClick={() => setModal('advance')}>
                Complete {STAGE_SHORT[order.stage]} → {nextStage && STAGE_SHORT[nextStage]}
              </button>
            )}
            {order.stage === 'ready' && meta.permissions.includes('orders.deliver') && <button className="btn primary" disabled={!paymentComplete} title={!paymentComplete ? 'Complete payment before dispatch' : undefined} onClick={() => setModal('deliver')}>Confirm dispatch</button>}
          </>
        }
      />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge>{order.status}</Badge>
            <span className="small muted">Due <DueDate order={order} /></span>
          </div>
          <span className="small muted">Created {fmtDate(order.createdAt)}</span>
        </div>
        <div className="stepper" aria-label="Production progress">
          {STAGE_ORDER.map((s, i) => (
            <div key={s} className={`step ${i < stageIdx || order.stage === 'delivered' ? 'done' : i === stageIdx ? 'current' : ''}`}>
              <div className="bar" />
              {STAGE_SHORT[s]}
            </div>
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 12 }}>
          Cutting: <strong>{order.cuttingStatus === 'completed' ? 'Complete' : 'Pending'}</strong>
        </div>
        {advanceBlocked && canAdvance && (
          <Notice tone="warn" style={{ marginTop: 14 }}>
            {order.currentVersion === 0
              ? 'Upload the first artwork version for the customer to review.'
              : !order.approved
                ? `Waiting for customer approval of artwork v${order.currentVersion}. Printing cannot begin until it is approved.`
                : 'Waiting for the Cutting team to complete this order before printing can begin.'}
          </Notice>
        )}
      </section>

      <div className="grid-main">
        <div className="stack">
          {/* -------- Artwork -------- */}
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Artwork & approval</h2>
                <div className="card-sub">
                  {order.currentVersion === 0
                    ? 'No artwork uploaded yet'
                    : order.approved
                      ? `v${order.currentVersion} approved by ${order.approval.byName}${order.approval.onBehalf ? ' (recorded by owner)' : ''} · ${fmtDateTime(order.approval.at)}`
                      : `Latest version v${order.currentVersion} awaiting approval`}
                </div>
              </div>
              <div className="header-actions">
                {canFeedback && <button className="btn small" onClick={() => setModal('feedback')}>{role === 'customer' ? 'Request changes' : 'Add note'}</button>}
                {canUpload && <button className="btn small" onClick={() => setModal('upload')}>⇪ Upload v{order.currentVersion + 1}</button>}
                {canApprove && <button className="btn small primary" onClick={() => setModal('approve')}>✓ Approve v{order.currentVersion}</button>}
              </div>
            </div>
            {role === 'customer' && canApprove && (
              <Notice tone="warn" style={{ marginBottom: 14 }}>Please check names, numbers, colours and logos carefully. Printing starts after you approve.</Notice>
            )}
            {order.artworks.length ? (
              <div className="artwork-grid">
                {[...order.artworks].reverse().map((a) => (
                  <div key={a.version} className={`artwork ${a.version === order.currentVersion ? 'current' : ''}`}>
                    <a className="thumb" href={assetPath(a.file.url)} target="_blank" rel="noreferrer">
                      {a.file.mimeType.startsWith('image/') && a.file.mimeType !== 'image/svg+xml' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={assetPath(a.file.url)} alt={`Artwork version ${a.version}`} />
                      ) : (
                        <span>{a.file.originalName}</span>
                      )}
                    </a>
                    <div className="meta">
                      <strong>v{a.version}</strong>{' '}
                      {a.version === order.approval.version ? <Badge>Approved</Badge> : a.version === order.currentVersion ? <Badge>{isDesign ? 'Awaiting approval' : 'Final'}</Badge> : <span className="muted small">superseded</span>}
                      <div className="muted">{a.uploadedByName} · {fmtDate(a.uploadedAt)}</div>
                      {a.note && <div>{a.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>{role === 'customer' ? 'Our design team is preparing your artwork.' : 'The design team has not uploaded artwork yet.'}</Empty>
            )}
            {order.feedback.length > 0 && (
              <>
                <h3 style={{ marginTop: 18 }}>Feedback</h3>
                <div className="activity">
                  {[...order.feedback].reverse().map((f, i) => (
                    <div className="activity-item" key={i}>
                      <div className="activity-dot">✎</div>
                      <div>
                        <div className="activity-title">{f.byName} on v{f.version}</div>
                        <div className="activity-desc">{f.message}</div>
                        <div className="activity-time">{fmtDateTime(f.at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {latestFeedback.length > 0 && !order.approved && role === 'design' && (
              <Notice tone="warn" style={{ marginTop: 10 }}>Changes requested on v{order.currentVersion}. Upload a revised version.</Notice>
            )}
          </section>

          {/* -------- Specification -------- */}
          <section className="card">
            <h2 style={{ marginBottom: 16 }}>Specification</h2>
            <div className="spec-grid">
              <div><div className="k">Product</div><div className="v">{order.productConfig}</div></div>
              <div><div className="k">Neck</div><div className="v">{order.neckType}</div></div>
              <div><div className="k">Quantity</div><div className="v">{order.quantity} sets</div></div>
              {order.shortsColor && <div><div className="k">Shorts colour</div><div className="v">{order.shortsColor}</div></div>}
              <div><div className="k">Delivery date</div><div className="v"><DueDate order={order} /></div></div>
              <div><div className="k">Customer</div><div className="v">{order.customer.name}{order.customer.phone ? ` · ${order.customer.phone}` : ''}</div></div>
            </div>
            {order.comments && (
              <Notice style={{ marginTop: 16 }}><strong>Instructions:</strong> {order.comments}</Notice>
            )}
            {order.files.length > 0 && (
              <>
                <h3 style={{ marginTop: 18 }}>Reference files</h3>
                <FileList files={order.files} />
              </>
            )}
          </section>

          {/* -------- Players -------- */}
          <section className="card flush">
            <div className="card-head" style={{ padding: '18px 18px 0' }}>
              <div>
                <h2>Player roster</h2>
                <div className="card-sub">{order.playerListMode === 'image' ? 'Player list attached as an image' : `${order.players.length} of ${order.quantity} rows filled`}</div>
              </div>
            </div>
            {order.players.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>No.</th><th>Sleeve</th><th>Jersey</th>{hasShorts && <th>Shorts</th>}{hasTrouser && <th>Trouser</th>}</tr></thead>
                  <tbody>
                    {order.players.map((p, i) => (
                      <tr key={i}>
                        <td className="muted">{i + 1}</td>
                        <td>{p.name || '—'}</td>
                        <td>{p.number || '—'}</td>
                        <td>{p.sleeve}</td>
                        <td>{p.jerseySize || '—'}</td>
                        {hasShorts && <td>{p.shortsSize || '—'}</td>}
                        {hasTrouser && <td>{p.trouserSize || '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No player details entered.</Empty>
            )}
            <SizeSummary order={order} />
          </section>
        </div>

        <div className="stack">
          {/* -------- Finance -------- */}
          {money && (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Billing</h2>
                  <div className="card-sub">{order.invoice?.number ? `Invoice ${order.invoice.number} · ${fmtDate(order.invoice.issuedAt)}` : 'No invoice issued yet'}</div>
                </div>
              </div>
              <div className="kv"><span>Unit rate</span><strong>{order.unitRate ? fmtMoney(order.unitRate) : 'To be quoted'}</strong></div>
              <div className="kv"><span>Order total</span><strong>{fmtMoney(order.totalAmount)}</strong></div>
              <div className="kv"><span>Paid</span><strong className="green">{fmtMoney(order.amountPaid)}</strong></div>
              <div className="kv"><span>Balance</span><strong className={order.balance ? 'amber' : 'green'}>{fmtMoney(order.balance)}</strong></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {meta.permissions.includes('payments.record') && (order.balance ?? 0) > 0 && <button className="btn small primary" onClick={() => setModal('payment')}>＋ Record payment</button>}
                {meta.permissions.includes('orders.invoice') && !order.invoice?.number && !!order.totalAmount && <button className="btn small" disabled={busy} onClick={issueInvoice}>Issue invoice</button>}
                {(order.invoice?.number || !!order.totalAmount) && <Link className="btn small" href={`/invoice/${order.id}`} target="_blank">{order.invoice?.number ? 'View invoice' : 'View quotation'}</Link>}
              </div>
              {payments.data && payments.data.payments.length > 0 && (
                <>
                  <h3 style={{ marginTop: 18 }}>Payments</h3>
                  {payments.data.payments.map((p) => (
                    <div className="kv" key={p.id}>
                      <span>{fmtDate(p.receivedAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}{p.proof ? <> · <a className="link-btn" href={assetPath(p.proof.url)} target="_blank" rel="noreferrer">Proof</a></> : ''}</span>
                      <strong>{fmtMoney(p.amount)}</strong>
                    </div>
                  ))}
                </>
              )}
            </section>
          )}

          {/* -------- Delivery -------- */}
          {order.stage === 'delivered' && order.delivery.deliveredAt && (
            <section className="card">
              <h2 style={{ marginBottom: 12 }}>Delivery</h2>
              <div className="kv"><span>Delivered</span><strong>{fmtDateTime(order.delivery.deliveredAt)}</strong></div>
              <div className="kv"><span>Received by</span><strong>{order.delivery.recipient}</strong></div>
              <div className="kv"><span>Method</span><strong>{order.delivery.method}</strong></div>
              <div className="kv"><span>Packed qty</span><strong>{order.delivery.packedQuantity} / {order.quantity}</strong></div>
              {order.delivery.trackingRef && <div className="kv"><span>Tracking</span><strong>{order.delivery.trackingRef}</strong></div>}
              {order.delivery.note && <div className="kv"><span>Note</span><span>{order.delivery.note}</span></div>}
            </section>
          )}

          {/* -------- History -------- */}
          <section className="card">
            <h2 style={{ marginBottom: 14 }}>Stage history</h2>
            <div className="timeline">
              {[...order.history].reverse().map((h, i) => (
                <div className="timeline-item" key={i}>
                  <div className="timeline-dot" />
                  <div>
                    <div className="activity-title">{h.from ? `${STAGE_SHORT[h.from]} → ${STAGE_SHORT[h.to]}` : `Created in ${STAGE_SHORT[h.to]}`}</div>
                    <div className="activity-desc">{h.byName}{h.note ? ` · ${h.note}` : ''}</div>
                    <div className="activity-time">{fmtDateTime(h.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {modal === 'edit' && <EditOrderModal order={order} onClose={() => setModal(null)} onSaved={update} />}
      {modal === 'deliver' && <DeliverModal order={order} onClose={() => setModal(null)} onSaved={update} />}
      {modal === 'payment' && (
        <RecordPaymentModal
          orders={[order]}
          initialOrderId={order.id}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            const res = await api<{ order: Order }>(`/orders/${order.id}`);
            setData(res);
            payments.reload();
          }}
        />
      )}
      {modal === 'advance' && (
        <TextPromptModal
          title={`Complete ${STAGE_SHORT[order.stage]}`}
          label="Handover note (optional)"
          placeholder="Anything the next team should know…"
          submitLabel={`Move to ${nextStage ? STAGE_SHORT[nextStage] : ''} →`}
          onClose={() => setModal(null)}
          onSubmit={async (note) => {
            const res = await api<{ order: Order }>(`/orders/${order.id}/advance`, { method: 'POST', body: { note } });
            toast(`${order.orderNo} moved to ${res.order.stageLabel}`);
            // Department users lose access once the job leaves their queue.
            if (role !== 'owner' && role !== 'accounts') router.push(appPath('/production'));
            else update(res.order);
          }}
        />
      )}
      {modal === 'sendBack' && (
        <TextPromptModal
          title="Send back for rework"
          label="Reason *"
          required
          placeholder="e.g. Print misaligned on 3 jerseys"
          submitLabel={`Send back to ${STAGE_SHORT[STAGE_ORDER[stageIdx - 1]]}`}
          onClose={() => setModal(null)}
          onSubmit={async (reason) => {
            const res = await api<{ order: Order }>(`/orders/${order.id}/send-back`, { method: 'POST', body: { reason } });
            toast(`${order.orderNo} sent back to ${res.order.stageLabel}`);
            update(res.order);
          }}
        />
      )}
      {modal === 'feedback' && (
        <TextPromptModal
          title={role === 'customer' ? `Request changes to v${order.currentVersion}` : `Note on v${order.currentVersion}`}
          label={role === 'customer' ? 'What should we change? *' : 'Note *'}
          required
          submitLabel={role === 'customer' ? 'Send request' : 'Add note'}
          onClose={() => setModal(null)}
          onSubmit={async (message) => {
            const res = await api<{ order: Order }>(`/orders/${order.id}/feedback`, { method: 'POST', body: { message } });
            toast('Feedback sent to the design team');
            update(res.order);
          }}
        />
      )}
      {modal === 'approve' && <ApproveModal order={order} onClose={() => setModal(null)} onSaved={update} />}
      {modal === 'upload' && <UploadArtworkModal order={order} onClose={() => setModal(null)} onSaved={update} />}
      {deleteConfirmOpen && <ConfirmModal title="Delete order" message={`Delete ${order.orderNo}? This cannot be undone.`} confirmLabel="Delete order" onClose={() => setDeleteConfirmOpen(false)} onConfirm={deleteOrder} />}
    </>
  );
}

function FileList({ files }: { files: StoredFile[] }) {
  return (
    <div className="file-list">
      {files.map((f) => (
        <a key={f.storedName} className="file-link" href={assetPath(f.url)} target="_blank" rel="noreferrer">
          {f.mimeType.startsWith('image/') && f.mimeType !== 'image/svg+xml'
            ? <img className="file-thumb" src={assetPath(f.url)} alt={f.originalName} />
            : <span aria-hidden>{f.kind === 'jersey' ? '👕' : '📎'}</span>}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.originalName}</span>
          <span className="muted small">{f.kind === 'jersey' ? 'Jersey image · ' : f.kind === 'player-list' ? 'Player list · ' : ''}{fileSize(f.size)}</span>
        </a>
      ))}
    </div>
  );
}

/** Size breakdown that cutting and stitching teams work from. */
function SizeSummary({ order }: { order: Order }) {
  const count = (key: 'jerseySize' | 'shortsSize' | 'trouserSize') => {
    const m = new Map<string, number>();
    order.players.forEach((p) => p[key] && m.set(p[key], (m.get(p[key]) ?? 0) + 1));
    return [...m.entries()];
  };
  const groups = [
    ['Jersey', count('jerseySize')],
    ['Shorts', count('shortsSize')],
    ['Trouser', count('trouserSize')],
  ] as const;
  const sleeves = new Map<string, number>();
  order.players.forEach((p) => sleeves.set(p.sleeve, (sleeves.get(p.sleeve) ?? 0) + 1));
  if (!order.players.length) return null;
  return (
    <div className="size-summary">
      {groups.filter(([, e]) => e.length).map(([label, entries]) => (
        <div key={label}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{label} sizes</div>
          {entries.map(([s, n]) => `${s} × ${n}`).join(' · ')}
        </div>
      ))}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Sleeves</div>
        {[...sleeves.entries()].map(([s, n]) => `${s} × ${n}`).join(' · ')}
      </div>
    </div>
  );
}

function ApproveModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: (o: Order) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const onBehalf = user.role !== 'customer';
  async function approve() {
    setBusy(true);
    try {
      const res = await api<{ order: Order }>(`/orders/${order.id}/approve`, { method: 'POST', body: { version: order.currentVersion } });
      toast(`Artwork v${order.currentVersion} approved`);
      onSaved(res.order);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Modal title={`Approve artwork v${order.currentVersion}`} onClose={onClose}>
      {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
      <Notice tone={onBehalf ? 'warn' : 'info'}>
        {onBehalf
          ? 'You are recording approval on behalf of the customer (e.g. confirmed by phone or WhatsApp). This is logged in the audit trail.'
          : 'By approving, you confirm the design, colours, names, numbers and sizes are correct. Printing will start after approval.'}
      </Notice>
      <label className="checkbox-line" style={{ marginTop: 14 }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        {onBehalf ? 'The customer has confirmed this exact version' : 'I have checked the artwork and roster'}
      </label>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!confirmed || busy} onClick={approve}>{busy ? 'Approving…' : 'Approve'}</button>
      </div>
    </Modal>
  );
}

function UploadArtworkModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: (o: Order) => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  function selectFile(selected: File | undefined) {
    if (!selected) { setFile(null); setFileError(''); return; }
    const message = validateUploadFile(selected, { extensions: DESIGN_EXTENSIONS, label: 'Artwork file' });
    setFileError(message);
    setFile(message ? null : selected);
    if (message) toast(message, 'error');
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setFileError('Please select an artwork file.');
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    form.append('note', note);
    try {
      const res = await api<{ order: Order }>(`/orders/${order.id}/artworks`, { method: 'POST', form });
      toast(`Artwork v${res.order.currentVersion} uploaded. Sent for customer approval`);
      onSaved(res.order);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Modal title={`Upload artwork v${order.currentVersion + 1}`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        {order.approved && <Notice tone="warn" style={{ marginBottom: 14 }}>v{order.currentVersion} is already approved. Uploading a new version will require approval again.</Notice>}
        <div className="form-grid">
          <Field label="Artwork file *" full hint="PNG/JPG previews best. PDF, AI, EPS, SVG, PSD and CDR are also accepted · up to 15 MB" error={fileError}>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.ai,.eps,.svg,.psd,.cdr" onChange={(e) => selectFile(e.target.files?.[0])} />
            {file && <LocalFilePreview file={file} />}
          </Field>
          <Field label="What changed?" full>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Logo enlarged, sponsor moved to back" />
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload'}</button>
        </div>
      </form>
    </Modal>
  );
}
