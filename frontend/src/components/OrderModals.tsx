'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';
import { Field, Modal, Notice, errorMessage } from './ui';
import { LocalFilePreview } from './LocalFilePreview';
import { fmtMoney, toInputDate } from '@/lib/format';
import { AVATAR_EXTENSIONS, MAX_UPLOAD_BYTES, validateUploadFile } from '@/lib/uploads';
import type { Order, Payment } from '@/lib/types';

type Done<T> = (result: T) => void;

export function RecordPaymentModal({ orders, initialOrderId, onClose, onSaved }: { orders: Order[]; initialOrderId?: string; onClose: () => void; onSaved: Done<Payment> }) {
  const { meta } = useAuth();
  const toast = useToast();
  const payable = orders.filter((o) => (o.balance ?? 0) > 0);
  const [orderId, setOrderId] = useState(initialOrderId ?? payable[0]?.id ?? '');
  const order = orders.find((o) => o.id === orderId);
  const [amount, setAmount] = useState(String(order?.balance ?? ''));
  const [method, setMethod] = useState(meta.paymentMethods[0]);
  const [reference, setReference] = useState('');
  const [receivedAt, setReceivedAt] = useState(toInputDate(new Date()));
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [proofError, setProofError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (proofError) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('orderId', orderId);
      form.append('amount', amount);
      form.append('method', method);
      form.append('reference', reference);
      form.append('note', note);
      form.append('receivedAt', receivedAt);
      if (proof) form.append('proof', proof);
      const { payment } = await api<{ payment: Payment }>('/payments', {
        method: 'POST',
        form,
      });
      toast(`Payment of ${fmtMoney(payment.amount)} recorded for ${payment.order.orderNo}`);
      onSaved(payment);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Record payment" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        {!payable.length ? (
          <Notice>No orders have an outstanding balance.</Notice>
        ) : (
          <div className="form-grid">
            <Field label="Order *" full>
              <select
                value={orderId}
                disabled={!!initialOrderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  setAmount(String(orders.find((o) => o.id === e.target.value)?.balance ?? ''));
                }}
              >
                {payable.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNo} · {o.customer.name} · balance {fmtMoney(o.balance)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (NPR) *" hint={order ? `Outstanding: ${fmtMoney(order.balance)}` : undefined}>
              <input type="number" min="1" step="any" max={order?.balance} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Method *">
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {meta.paymentMethods.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Received on">
              <input type="date" max={toInputDate(new Date())} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
            </Field>
            <Field label="Reference / transaction ID">
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque no., bank ref…" />
            </Field>
            <Field label="Note" full>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Field label="Proof image" hint={`Optional · PNG, JPG, WEBP or GIF · up to ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`} error={proofError} full>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = '';
                if (!file) { setProof(null); setProofError(''); return; }
                const message = validateUploadFile(file, { maxBytes: MAX_UPLOAD_BYTES, extensions: AVATAR_EXTENSIONS, label: 'Proof image' });
                setProofError(message);
                setProof(message ? null : file);
                if (message) toast(message, 'error');
              }} />
              {proof && <LocalFilePreview file={proof} />}
            </Field>
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !payable.length}>{busy ? 'Saving…' : 'Record payment'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function DeliverModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: Done<Order> }) {
  const { meta } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ packedQuantity: String(order.quantity), recipient: '', method: meta.deliveryMethods[0], trackingRef: '', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const diff = Number(form.packedQuantity) - order.quantity;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ order: Order }>(`/orders/${order.id}/deliver`, { method: 'POST', body: { ...form, packedQuantity: Number(form.packedQuantity) } });
      toast(`${order.orderNo} marked as delivered`);
      onSaved(res.order);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Confirm dispatch · ${order.orderNo}`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        {(order.balance ?? 0) > 0 && (
          <Notice tone="error" style={{ marginBottom: 14 }}>Dispatch is blocked until the outstanding balance of {fmtMoney(order.balance)} is paid.</Notice>
        )}
        <div className="form-grid">
          <Field label="Packed quantity *" hint={diff === 0 ? `Ordered: ${order.quantity}` : diff < 0 ? `Short by ${-diff}` : `Over by ${diff}`}>
            <input type="number" min="0" required value={form.packedQuantity} onChange={set('packedQuantity')} />
          </Field>
          <Field label="Received by *">
            <input required value={form.recipient} onChange={set('recipient')} placeholder="Name of person receiving" />
          </Field>
          <Field label="Dispatch method *">
            <select value={form.method} onChange={set('method')}>
              {meta.deliveryMethods.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Tracking / vehicle ref.">
            <input value={form.trackingRef} onChange={set('trackingRef')} />
          </Field>
          <Field label="Note" full>
            <input value={form.note} onChange={set('note')} />
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Confirm delivery'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function EditOrderModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: Done<Order> }) {
  const toast = useToast();
  const [form, setForm] = useState({
    teamName: order.teamName,
    dueDate: toInputDate(order.dueDate),
    unitRate: String(order.unitRate ?? 0),
    comments: order.comments,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ order: Order }>(`/orders/${order.id}`, { method: 'PATCH', body: { ...form, unitRate: Number(form.unitRate) } });
      toast('Order updated');
      onSaved(res.order);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit ${order.orderNo}`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <div className="form-grid">
          <Field label="Team name">
            <input required value={form.teamName} onChange={set('teamName')} />
          </Field>
          <Field label="Delivery date">
            <input type="date" required value={form.dueDate} onChange={set('dueDate')} />
          </Field>
          <Field label="Unit rate (NPR)" hint={`Total = ${fmtMoney(Number(form.unitRate) * order.quantity)}`}>
            <input type="number" min="0" step="any" value={form.unitRate} onChange={set('unitRate')} />
          </Field>
          <Field label="Comments / special instructions" full>
            <textarea rows={3} value={form.comments} onChange={set('comments')} />
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Small modal for actions that need one line of text (stage notes, rework reasons, feedback). */
export function TextPromptModal({
  title, label, placeholder, required, submitLabel, onClose, onSubmit, intro,
}: {
  title: string; label: string; placeholder?: string; required?: boolean; submitLabel: string; intro?: React.ReactNode;
  onClose: () => void; onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(text.trim());
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {intro && <div style={{ marginBottom: 14 }}>{intro}</div>}
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <Field label={label}>
          <textarea rows={3} required={required} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
