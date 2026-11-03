'use client';

import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, ConfirmModal, Field, Modal, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { roleLabel, fmtDateTime } from '@/lib/format';
import type { Customer, Role, UserRow } from '@/lib/types';

const ROLE_SCOPE: Record<Role, string> = {
  owner: 'Full access, dispatch, users and settings',
  design: 'Design queue, artwork versions',
  cutting: 'Cutting queue',
  printing: 'Printing queue (approved jobs only)',
  stitching: 'Stitching queue',
  finishing: 'Finishing, QC and ready queue',
  accounts: 'Orders, customers, billing, reports',
  customer: 'Own orders, approvals and invoices',
};

export default function UsersPage() {
  const { user: me, meta } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => setPage(1), [debouncedSearch, role]);
  const userParams = new URLSearchParams({ page: String(page), limit: '50' });
  if (debouncedSearch) userParams.set('search', debouncedSearch);
  if (role) userParams.set('role', role);
  const { data, error, reload } = useApi<{ users: UserRow[]; total: number; limit: number }>(`/users?${userParams}`);
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);

  async function remove(user: UserRow) {
    try {
      await api(`/users/${user.id}`, { method: 'DELETE' });
      setUserToDelete(null);
      toast(`${user.name}'s account deleted`);
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  if (!meta.permissions.includes('users.manage')) return <Notice tone="error">You do not have permission to manage users.</Notice>;

  return (
    <>
      {userToDelete && <ConfirmModal title="Delete user account" message={`Delete ${userToDelete.name}'s account? This cannot be undone.`} confirmLabel="Delete account" onClose={() => setUserToDelete(null)} onConfirm={() => remove(userToDelete)} />}
      <PageHeader
        eyebrow="ACCESS CONTROL"
        title="Users & permissions"
        subtitle="Individual accounts with least-privilege roles. Permissions are enforced by the server, not just hidden in the UI."
        actions={<button className="btn primary" onClick={() => setEditing('new')}>＋ Add user</button>}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="toolbar">
        <div className="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone…" aria-label="Search users" /></div>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter users by role">
          <option value="">All roles</option>
          {meta.roles.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select>
      </div>
      <div className="card flush">
        {!data ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Role</th><th>Access scope</th><th>Last sign-in</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                    <td><strong>{u.name}</strong><div className="muted small" style={{ marginTop: 3 }}>{u.email}</div></td>
                    <td>{roleLabel(u.role, meta.roles)}{u.customer && <div className="muted small" style={{ marginTop: 3 }}>{u.customer.name}</div>}</td>
                    <td className="wrap muted">{ROLE_SCOPE[u.role] ?? 'Custom role permissions'}</td>
                    <td>{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : <span className="muted">Never</span>}</td>
                    <td><Badge>{u.active ? 'Active' : 'Inactive'}</Badge></td>
                    <td>
                      <button className="btn small" onClick={() => setEditing(u)}>Edit</button>{' '}
                      <button className="btn small" onClick={() => setResetting(u)}>Reset password</button>{' '}
                      {u.id !== me.id && <button className="btn small danger" onClick={() => setUserToDelete(u)}>Delete</button>}
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
      <div className="two-col" style={{ marginTop: 15 }}>
        <div className="card">
          <h2>Security baseline</h2>
          <div className="activity-desc" style={{ lineHeight: 2 }}>
            ✓ Unique staff accounts with hashed passwords<br />
            ✓ Customer row-level isolation on every query<br />
            ✓ Server-side role checks on every action<br />
            ✓ Audit log for critical actions<br />
            ✓ Deactivation takes effect immediately
          </div>
        </div>
        <div className="card">
          <h2>Workflow gates</h2>
          <div className="activity-desc" style={{ lineHeight: 2 }}>
            Design → printing requires customer artwork approval<br />
            Each department completes only its own stage<br />
            Only the owner confirms dispatch & delivery<br />
            Prices are hidden from production roles<br />
            Payments cannot exceed the outstanding balance
          </div>
        </div>
      </div>
      {editing && <UserModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {resetting && <ResetModal user={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}

function UserModal({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const { meta, user: me } = useAuth();
  const toast = useToast();
  const customers = useApi<{ customers: Customer[] }>('/customers');
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    role: (user?.role ?? 'design') as Role,
    customer: user?.customer?.id ?? '',
    password: '',
    active: user?.active ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const self = user?.id === me.id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const customer = form.role === 'customer' ? form.customer || null : null;
    try {
      if (user) {
        await api(`/users/${user.id}`, { method: 'PATCH', body: { name: form.name, phone: form.phone, role: form.role, customer, active: form.active } });
      } else {
        const result = await api<{ emailSent: boolean }>('/users', { method: 'POST', body: { name: form.name, email: form.email, phone: form.phone, role: form.role, customer, password: form.password } });
        toast(result.emailSent ? `Account created and login details emailed to ${form.email}` : 'Account created, but the welcome email could not be sent', result.emailSent ? 'ok' : 'error');
        onSaved();
        return;
      }
      toast('User updated');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={user ? `Edit ${user.name}` : 'Add user'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <div className="form-grid">
          <Field label="Full name *"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email (sign-in) *"><input type="email" required disabled={!!user} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role *" hint={ROLE_SCOPE[form.role] ?? 'Custom role permissions'}>
            <select value={form.role} disabled={self} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {meta.roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          {form.role === 'customer' && (
            <Field label="Linked customer account *" full hint="The customer can only see this account's orders">
              <select required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}>
                <option value="">Select customer…</option>
                {customers.data?.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {!user && (
            <Field label="Temporary password *" full hint="At least 8 characters. Share it securely; the user can change it in Settings.">
              <input type="text" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          )}
          {user && !self && (
            <label className="checkbox-line">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Account active
            </label>
          )}
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/users/${user.id}/reset-password`, { method: 'POST', body: { password } });
      toast(`Password reset for ${user.name}`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Modal title={`Reset password · ${user.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <Field label="New temporary password *" hint="At least 8 characters">
          <input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>Reset password</button>
        </div>
      </form>
    </Modal>
  );
}
