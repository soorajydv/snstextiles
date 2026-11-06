'use client';

import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { ConfirmModal, Field, Modal, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import type { Permission, RoleDefinition } from '@/lib/types';

type RoleForm = { key: string; name: string; description: string; permissions: Permission[] };

const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Overview', permissions: ['dashboard.view', 'reports.view'] },
  { label: 'Orders & production', permissions: ['orders.view', 'orders.create', 'orders.update', 'orders.delete', 'orders.artwork.upload', 'orders.approve', 'orders.feedback', 'orders.stage.complete', 'orders.send_back', 'orders.deliver', 'orders.invoice'] },
  { label: 'Customers', permissions: ['customers.view', 'customers.manage', 'customers.delete'] },
  { label: 'Payments & billing', permissions: ['payments.view', 'payments.record', 'payments.verify', 'payments.delete'] },
  { label: 'Inventory', permissions: ['inventory.view', 'inventory.manage', 'inventory.move', 'inventory.adjust'] },
  { label: 'Attendance', permissions: ['attendance.view', 'attendance.checkin', 'attendance.checkout', 'attendance.approve'] },
  { label: 'Access control', permissions: ['users.manage', 'roles.manage', 'audit.view'] },
  { label: 'Platform', permissions: ['settings.view', 'settings.manage'] },
  { label: 'Account', permissions: ['profile.manage', 'account.delete'] },
];

const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'dashboard.view': 'View the factory overview dashboard.',
  'orders.view': 'View orders and order details.',
  'orders.create': 'Create new orders.',
  'orders.update': 'Edit order details and pricing.',
  'orders.delete': 'Delete eligible orders.',
  'orders.artwork.upload': 'Upload artwork versions.',
  'orders.approve': 'Approve customer artwork.',
  'orders.feedback': 'Add design feedback or request changes.',
  'orders.stage.complete': 'Move orders through production stages.',
  'orders.send_back': 'Send production work back to an earlier stage.',
  'orders.deliver': 'Confirm dispatch and delivery.',
  'orders.invoice': 'Issue invoices for orders.',
  'customers.view': 'View customer records and history.',
  'customers.manage': 'Create and edit customer records.',
  'customers.delete': 'Delete customers without orders.',
  'payments.view': 'View payment and billing information.',
  'payments.record': 'Record customer payments.',
  'payments.verify': 'Verify or reject customer-submitted payments.',
  'payments.delete': 'Delete payments that are eligible for removal.',
  'inventory.view': 'View inventory and stock levels.',
  'inventory.manage': 'Create, edit and deactivate materials.',
  'inventory.move': 'Record stock received or issued.',
  'inventory.adjust': 'Make stock count adjustments.',
  'reports.view': 'View business reports and exports.',
  'users.manage': 'Create, edit, reset and delete user accounts.',
  'roles.manage': 'Create roles and assign permissions.',
  'audit.view': 'View the audit log.',
  'settings.view': 'View platform settings.',
  'settings.manage': 'Edit business and platform settings.',
  'profile.manage': 'Edit personal profile details.',
  'account.delete': 'Delete the signed-in account.',
  'attendance.view': 'View attendance records.',
  'attendance.checkin': 'Submit check-in requests.',
  'attendance.checkout': 'Check out after an approved check-in.',
  'attendance.approve': 'Approve or reject employee check-ins.',
};

export default function RolesPage() {
  const { meta } = useAuth();
  const { data, error, reload } = useApi<{ roles: RoleDefinition[]; permissions: Permission[] }>('/roles');
  const [editing, setEditing] = useState<RoleDefinition | 'new' | null>(null);
  const toast = useToast();
  const [roleToDelete, setRoleToDelete] = useState<RoleDefinition | null>(null);

  if (!meta.permissions.includes('roles.manage')) return <Notice tone="error">You do not have permission to manage roles.</Notice>;
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <Spinner />;

  async function remove(role: RoleDefinition) {
    try {
      await api(`/roles/${role.key}`, { method: 'DELETE' });
      setRoleToDelete(null);
      toast('Role deleted');
      await reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <>
      {roleToDelete && <ConfirmModal title="Delete role" message={`Delete the ${roleToDelete.name} role?`} confirmLabel="Delete role" onClose={() => setRoleToDelete(null)} onConfirm={() => remove(roleToDelete)} />}
      <PageHeader eyebrow="ACCESS CONTROL" title="Roles & permissions" subtitle="Create roles that control which pages, UI actions and API operations a user can access." actions={<button className="btn primary" onClick={() => setEditing('new')}>＋ Create role</button>} />
      <section className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Role</th><th>Description</th><th>Permissions</th><th>Type</th><th>Actions</th></tr></thead>
            <tbody>{data.roles.map((role) => (
              <tr key={role.key}>
                <td><strong>{role.name}</strong><div className="muted small">{role.key}</div></td>
                <td className="wrap">{role.description || <span className="muted">—</span>}</td>
                <td>{role.permissions.length}</td>
                <td>{role.system ? 'Built-in' : 'Custom'}</td>
                <td><button className="btn small" onClick={() => setEditing(role)}>Edit</button>{' '}{!role.system && <button className="btn small danger" onClick={() => setRoleToDelete(role)}>Delete</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      {editing && <RoleModal role={editing === 'new' ? null : editing} permissions={data.permissions} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function RoleModal({ role, permissions, onClose, onSaved }: { role: RoleDefinition | null; permissions: Permission[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<RoleForm>({ key: role?.key ?? '', name: role?.name ?? '', description: role?.description ?? '', permissions: role?.permissions ?? [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (permission: Permission) => setForm((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(role ? `/roles/${role.key}` : '/roles', { method: role ? 'PATCH' : 'POST', body: form });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return <Modal title={role ? `Edit ${role.name}` : 'Create role'} onClose={onClose} wide>
    <form onSubmit={submit}>
      {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
      <div className="form-grid">
        <Field label="Role key *" hint="Lowercase letters, numbers and dashes only"><input required disabled={!!role} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /></Field>
        <Field label="Display name *"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Description" full><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label>Permissions</label>
        <div className="permission-groups">
          {PERMISSION_GROUPS.map((group) => {
            const available = group.permissions.filter((permission) => permissions.includes(permission));
            if (!available.length) return null;
            return <section className="permission-group" key={group.label}>
              <h3>{group.label}</h3>
              <div className="permission-grid">{available.map((permission) => <label className="permission-option" key={permission}><input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => toggle(permission)} /><span><strong>{permission}</strong><small>{PERMISSION_DESCRIPTIONS[permission]}</small></span></label>)}</div>
            </section>;
          })}
        </div>
      </div>
      <div className="form-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save role'}</button></div>
    </form>
  </Modal>;
}
