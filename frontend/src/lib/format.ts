import type { Permission, Role, RoleDefinition, Stage } from './types';

export const fmtMoney = (n: number | undefined | null, currency = 'NPR') =>
  `${currency} ${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const toInputDate = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

/** Whole days from today to `d` (negative when overdue). */
export function daysUntil(d: string | Date): number {
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function dueLabel(d: string, stage: Stage): { text: string; tone: '' | 'amber' | 'red' } {
  if (stage === 'delivered') return { text: fmtDate(d), tone: '' };
  const n = daysUntil(d);
  if (n < 0) return { text: `${fmtDate(d)} · ${-n}d late`, tone: 'red' };
  if (n === 0) return { text: `${fmtDate(d)} · today`, tone: 'amber' };
  if (n <= 3) return { text: `${fmtDate(d)} · ${n}d`, tone: 'amber' };
  return { text: fmtDate(d), tone: '' };
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner / Admin',
  design: 'Design team',
  cutting: 'Cutting team',
  printing: 'Printing team',
  stitching: 'Stitching team',
  finishing: 'Finishing team',
  accounts: 'Accounts',
  customer: 'Customer',
};

export const roleLabel = (role: Role, definitions?: RoleDefinition[]) =>
  definitions?.find((definition) => definition.key === role)?.name ?? ROLE_LABELS[role] ?? role.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const STAGE_SHORT: Record<Stage, string> = {
  design: 'Design',
  printing: 'Printing',
  stitching: 'Stitching',
  finishing: 'Finishing',
  ready: 'Ready',
  delivered: 'Delivered',
};

export const STAGE_ORDER: Stage[] = ['design', 'printing', 'stitching', 'finishing', 'ready', 'delivered'];

export const FINANCE_ROLES: Role[] = ['owner', 'accounts', 'customer'];
export const canSeeMoney = (role: Role, permissions: Permission[] = []) => FINANCE_ROLES.includes(role) || permissions.includes('payments.view');

/** Mirrors the server rule: who may complete each stage. */
export function canCompleteStage(role: Role, stage: Stage, permissions: Permission[] = []) {
  if (stage === 'ready' || stage === 'delivered') return role === 'owner';
  return role === 'owner' || role === stage || permissions.includes('orders.stage.complete');
}

export const initials = (name: string) =>
  name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const fileSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
