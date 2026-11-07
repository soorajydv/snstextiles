'use client';

import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { ConfirmModal, Field, Modal, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import type { Permission, RoleDefinition } from '@/lib/types';
import { WEBSITE_ENABLED } from '@/lib/features';

type RoleForm = { key: string; name: string; description: string; permissions: Permission[] };

const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Overview', permissions: ['dashboard.view', 'reports.view'] },
  { label: 'Orders & production', permissions: ['orders.view', 'orders.create', 'orders.update', 'orders.delete', 'orders.artwork.upload', 'orders.approve', 'orders.feedback', 'orders.stage.complete', 'orders.send_back', 'orders.deliver', 'orders.invoice'] },
  { label: 'Customers', permissions: ['customers.view', 'customers.create', 'customers.update', 'customers.delete'] },
  { label: 'Payments & billing', permissions: ['payments.view', 'payments.record', 'payments.verify', 'payments.delete', 'payments.export'] },
  { label: 'Inventory', permissions: ['inventory.view', 'inventory.create', 'inventory.update', 'inventory.move', 'inventory.adjust', 'inventory.suppliers.create'] },
  { label: 'Attendance', permissions: ['attendance.view', 'attendance.checkin', 'attendance.checkout', 'attendance.approve'] },
  { label: 'Website: overview, settings & images', permissions: ['site.overview', 'site.settings.view', 'site.settings.update', 'site.media.view', 'site.media.upload', 'site.media.delete'] },
  { label: 'Website: catalogue', permissions: ['site.categories.view', 'site.categories.create', 'site.categories.update', 'site.categories.delete', 'site.products.view', 'site.products.create', 'site.products.update', 'site.products.delete', 'site.products.import'] },
  { label: 'Website: pages & blog', permissions: ['site.pages.view', 'site.pages.create', 'site.pages.update', 'site.pages.delete', 'site.posts.view', 'site.posts.create', 'site.posts.update', 'site.posts.delete'] },
  { label: 'Website: enquiries, reviews & subscribers', permissions: ['site.enquiries.view', 'site.enquiries.update', 'site.enquiries.delete', 'site.reviews.view', 'site.reviews.moderate', 'site.reviews.delete', 'site.subscribers.view', 'site.subscribers.export', 'site.subscribers.delete'] },
  { label: 'Users', permissions: ['users.view', 'users.create', 'users.update', 'users.password_reset', 'users.delete'] },
  { label: 'Roles', permissions: ['roles.view', 'roles.create', 'roles.update', 'roles.delete'] },
  { label: 'Platform & audit', permissions: ['settings.view', 'settings.update', 'audit.view', 'audit.retention.update'] },
  { label: 'Account', permissions: ['profile.update', 'account.delete'] },
];

const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'dashboard.view': 'View the factory overview dashboard.',
  'orders.view': 'View orders, order details and order files.',
  'orders.create': 'Create new orders (and place website shop orders).',
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
  'customers.create': 'Add customers and their portal logins.',
  'customers.update': 'Edit customer records.',
  'customers.delete': 'Delete customers without orders.',
  'payments.view': 'View payment and billing information.',
  'payments.record': 'Record customer payments.',
  'payments.verify': 'Verify or reject customer-submitted payments.',
  'payments.delete': 'Delete payments that are eligible for removal.',
  'payments.export': 'Download billing CSVs: orders & invoices, the payment ledger and customer statements.',
  'inventory.view': 'View materials, stock levels, movements and suppliers.',
  'inventory.create': 'Add new materials.',
  'inventory.update': 'Edit and deactivate materials.',
  'inventory.move': 'Record stock received or issued.',
  'inventory.adjust': 'Make stock count adjustments.',
  'inventory.suppliers.create': 'Add suppliers.',
  'reports.view': 'View business reports and exports.',
  'users.view': 'View user accounts.',
  'users.create': 'Create user accounts.',
  'users.update': 'Edit user details, roles and active status.',
  'users.password_reset': 'Set a new password for another user.',
  'users.delete': 'Delete user accounts.',
  'roles.view': 'View roles and their permissions.',
  'roles.create': 'Create custom roles.',
  'roles.update': 'Rename roles and change their permissions.',
  'roles.delete': 'Delete custom roles.',
  'audit.view': 'View the audit log.',
  'audit.retention.update': 'Change how long audit log entries are kept.',
  'settings.view': 'View platform settings.',
  'settings.update': 'Edit business settings and the business logo.',
  'profile.update': 'Edit own profile, avatar and password.',
  'account.delete': 'Delete the signed-in account.',
  'attendance.view': 'View attendance records.',
  'attendance.checkin': 'Submit check-in requests.',
  'attendance.checkout': 'Check out after an approved check-in.',
  'attendance.approve': 'Approve or reject employee check-ins.',
  'site.overview': 'View the website overview dashboard.',
  'site.settings.view': 'View website settings.',
  'site.settings.update': 'Edit website contact details, homepage, FAQs, checkout rules and SEO.',
  'site.media.view': 'View the website image library.',
  'site.media.upload': 'Upload website images.',
  'site.media.delete': 'Delete website images.',
  'site.categories.view': 'View shop categories.',
  'site.categories.create': 'Create shop categories.',
  'site.categories.update': 'Edit shop categories.',
  'site.categories.delete': 'Delete shop categories.',
  'site.products.view': 'View shop products.',
  'site.products.create': 'Create shop products.',
  'site.products.update': 'Edit, publish, feature and restock shop products.',
  'site.products.delete': 'Delete shop products.',
  'site.products.import': 'Import products from WooCommerce and download their images.',
  'site.pages.view': 'View website pages.',
  'site.pages.create': 'Create website pages.',
  'site.pages.update': 'Edit website pages.',
  'site.pages.delete': 'Delete website pages.',
  'site.posts.view': 'View blog posts.',
  'site.posts.create': 'Write blog posts.',
  'site.posts.update': 'Edit blog posts.',
  'site.posts.delete': 'Delete blog posts.',
  'site.enquiries.view': 'Read custom design requests and contact messages, and their attachments.',
  'site.enquiries.update': 'Change enquiry status and notes.',
  'site.enquiries.delete': 'Delete enquiries.',
  'site.reviews.view': 'View product reviews.',
  'site.reviews.moderate': 'Approve or hide product reviews.',
  'site.reviews.delete': 'Delete product reviews.',
  'site.subscribers.view': 'View newsletter subscribers.',
  'site.subscribers.export': 'Export the newsletter subscriber list.',
  'site.subscribers.delete': 'Remove newsletter subscribers.',
};

export default function RolesPage() {
  const { meta } = useAuth();
  const can = (p: Permission) => meta.permissions.includes(p);
  const { data, error, reload } = useApi<{ roles: RoleDefinition[]; permissions: Permission[] }>(can('roles.view') ? '/roles' : null);
  const [editing, setEditing] = useState<RoleDefinition | 'new' | null>(null);
  const toast = useToast();
  const [roleToDelete, setRoleToDelete] = useState<RoleDefinition | null>(null);

  if (!can('roles.view')) return <Notice tone="error">You do not have permission to view roles.</Notice>;
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
      <PageHeader eyebrow="ACCESS CONTROL" title="Roles & permissions" subtitle="Create roles that control which pages, UI actions and API operations a user can access." actions={can('roles.create') && <button className="btn primary" onClick={() => setEditing('new')}>＋ Create role</button>} />
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
                <td>{can('roles.update') && <button className="btn small" onClick={() => setEditing(role)}>Edit</button>}{' '}{!role.system && can('roles.delete') && <button className="btn small danger" onClick={() => setRoleToDelete(role)}>Delete</button>}</td>
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
          {PERMISSION_GROUPS.filter((group) => WEBSITE_ENABLED || !group.label.startsWith('Website')).map((group) => {
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
