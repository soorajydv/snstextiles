'use client';

import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { AppLink as Link } from './AppLink';
import type { Order } from '@/lib/types';
import { daysUntil, dueLabel, fmtMoney } from '@/lib/format';
import { Icon, type IconName } from './Icon';

const STAT_ICONS: Record<string, IconName> = {
  '◈': 'dashboard', '▤': 'orders', '▧': 'inventory', '↗': 'arrowUp', '◷': 'attendance',
  '▥': 'chart', '!': 'alert', '✓': 'check', '□': 'box', '↔': 'activity',
};

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="header-row">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, note, icon = '◈', tone = '' }: { label: string; value: ReactNode; note?: string; icon?: string; tone?: '' | 'green' | 'amber' | 'red' }) {
  return (
    <div className="card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{STAT_ICONS[icon] ? <Icon name={STAT_ICONS[icon]} size={16} /> : icon}</span>
      </div>
      <div className={`stat-num ${tone}`}>{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

/** Status pill; tone is derived from the wording so every page colours states consistently. */
export function Badge({ children }: { children: string }) {
  const s = children;
  let cls = 'gray-bg';
  if (/changes|late|overdue|reorder|unpaid|inactive/i.test(s)) cls = 'red-bg';
  else if (/approval|progress|check|draft|part|balance/i.test(s)) cls = 'amber-bg';
  else if (/ready|delivered|paid|approved|settled|active|in stock/i.test(s)) cls = '';
  else if (/production|print/i.test(s)) cls = 'blue-bg';
  return <span className={`pill ${cls}`}>{s}</span>;
}

export function Notice({ tone = 'info', children, style }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode; style?: React.CSSProperties }) {
  return <div className={`notice ${tone === 'info' ? '' : tone}`} style={style}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Spinner({ fullPage = false }: { fullPage?: boolean }) {
  return <div className={fullPage ? 'loading-screen' : 'loading-panel'}><div className="spinner" aria-label="Loading" /></div>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">S&amp;S TEXTILES</div>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', onClose, onConfirm, danger = true }: { title: string; message: string; confirmLabel?: string; onClose: () => void; onConfirm: () => void | Promise<void>; danger?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={busy ? () => undefined : onClose}>
      <p style={{ lineHeight: 1.6, marginBottom: 18 }}>{message}</p>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={`btn ${danger ? 'danger' : 'primary'}`} onClick={confirm} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Field({ label, children, hint, error, full }: { label: string; children: ReactNode; hint?: string; error?: string; full?: boolean }) {
  const required = label.endsWith(' *');
  const visibleLabel = required ? label.slice(0, -2) : label;
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>{visibleLabel}{required && <span className="required-mark" aria-hidden="true"> *</span>}</label>
      {children}
      {error ? <span className="error-text">{error}</span> : hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function PasswordField(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'}>
        <Icon name={visible ? 'eyeOff' : 'eye'} size={16} />
      </button>
    </div>
  );
}

export function DueDate({ order }: { order: Pick<Order, 'dueDate' | 'stage'> }) {
  const d = dueLabel(order.dueDate, order.stage);
  return <span className={d.tone}>{d.text}</span>;
}

function remainingText(order: Pick<Order, 'dueDate' | 'stage'>) {
  if (order.stage === 'delivered') return 'Delivered';
  const days = daysUntil(order.dueDate);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} left`;
  const months = Math.max(1, Math.floor(days / 30));
  return `${months} month${months === 1 ? '' : 's'} left`;
}

export function OrderTable({ orders, showMoney, compact, showRemaining = false, actions }: { orders: Order[]; showMoney: boolean; compact?: boolean; showRemaining?: boolean; actions?: (order: Order) => ReactNode }) {
  if (!orders.length) return <Empty>No orders match this view.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th className="num">Qty</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Due date</th>
            {showMoney && !compact && <th className="num">Total</th>}
            {showMoney && !compact && <th className="num">Balance</th>}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link className="order-id" href={`/orders/${o.id}`}>{o.orderNo}</Link>
                {!compact && <div className="muted small" style={{ marginTop: 3 }}>{o.teamName}</div>}
              </td>
              <td>{o.customer.name}</td>
              <td className="num">{o.quantity}</td>
              <td>{o.stageLabel}</td>
              <td><Badge>{o.status}</Badge></td>
              <td><DueDate order={o} />{showRemaining && <span className="deadline-remaining">{remainingText(o)}</span>}</td>
              {showMoney && !compact && <td className="num">{o.totalAmount ? fmtMoney(o.totalAmount) : <span className="muted">To quote</span>}</td>}
              {showMoney && !compact && <td className="num">{fmtMoney(o.balance)}</td>}
              {actions && <td>{actions(o)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong';
}
