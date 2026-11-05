'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { LocalFilePreview } from '@/components/LocalFilePreview';
import { ConfirmModal, Field, Notice, PageHeader, PasswordField, errorMessage } from '@/components/ui';
import { roleLabel } from '@/lib/format';
import { AVATAR_EXTENSIONS, MAX_AVATAR_BYTES, validateUploadFile } from '@/lib/uploads';
import { assetPath } from '@/lib/paths';

export default function ProfilePage() {
  const { user, meta, refreshUser, logout } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, username: user.username, phone: user.phone });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    const validationError = validateUploadFile(file, { maxBytes: MAX_AVATAR_BYTES, extensions: AVATAR_EXTENSIONS, label: 'Avatar image' });
    if (validationError) {
      setAvatarError(validationError);
      toast(validationError, 'error');
      return;
    }
    setAvatarFile(file);
    setAvatarBusy(true);
    setAvatarError('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api('/auth/avatar', { method: 'PATCH', form: formData });
      await refreshUser();
      setAvatarFile(null);
      toast('Profile avatar updated');
    } catch (err) {
      setAvatarError(errorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarError('');
    try {
      await api('/auth/avatar', { method: 'DELETE' });
      await refreshUser();
      toast('Profile avatar removed');
    } catch (err) {
      setAvatarError(errorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/profile', { method: 'PATCH', body: form });
      await refreshUser();
      toast('Profile updated');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="YOUR ACCOUNT" title="My profile" subtitle="Manage your personal information, password and account." />
      {error && <Notice tone="error" style={{ marginBottom: 16 }}>{error}</Notice>}
      <div className="two-col">
        <section className="card">
          <h2>Profile information</h2>
          <div className="card-sub" style={{ marginBottom: 16 }}>These details are shown to your team.</div>
          <div className="profile-avatar-editor">
            <div className="profile-avatar-preview">{user.avatarUrl ? <img src={assetPath(user.avatarUrl)} alt="Profile avatar" /> : user.name.slice(0, 2).toUpperCase()}</div>
            <div><strong>Profile avatar</strong><div className="card-sub">PNG, JPG, WEBP or GIF · up to 5 MB</div>{avatarFile && <LocalFilePreview file={avatarFile} />}<div className="form-actions" style={{ marginTop: 8 }}><label className="btn small" style={{ cursor: avatarBusy ? 'wait' : 'pointer' }}>{avatarBusy ? 'Uploading…' : 'Choose image'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={avatarBusy} onChange={(e) => { void uploadAvatar(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>{user.avatarUrl && <button type="button" className="btn small" onClick={removeAvatar} disabled={avatarBusy}>Remove</button>}</div>{avatarError && <div className="error-text">{avatarError}</div>}</div>
          </div>
          <form onSubmit={saveProfile} className="form-grid">
            <Field label="Full name *" full><input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Username *" full hint="Lowercase letters, numbers, dots, underscores or hyphens"><input required minLength={3} maxLength={40} pattern="[a-zA-Z0-9._-]+" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><input value={user.email} disabled /></Field>
            <Field label="Role"><input value={roleLabel(user.role, meta.roles)} disabled /></Field>
            {user.customer && <Field label="Customer account" full><input value={user.customer.name} disabled /></Field>}
            <div className="field full"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
          </form>
        </section>
        <div className="stack">
          <ChangePassword />
          <DeleteAccount logout={logout} />
        </div>
      </div>
    </>
  );
}

function ChangePassword() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { setError('New passwords do not match'); return; }
    setBusy(true);
    setError('');
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      toast('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return <section className="card">
    <h2>Change password</h2>
    {error && <Notice tone="error" style={{ margin: '12px 0' }}>{error}</Notice>}
    <form onSubmit={submit} className="form-grid" style={{ marginTop: 14 }}>
      <Field label="Current password" full><PasswordField required autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
      <Field label="New password" hint="At least 8 characters"><PasswordField required minLength={8} autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
      <Field label="Confirm new password"><PasswordField required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
      <div className="field full"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button></div>
    </form>
  </section>;
}

function DeleteAccount({ logout }: { logout: () => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDeleteConfirmOpen(true);
  }
  async function deleteAccount() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/account', { method: 'DELETE', body: { password } });
      setDeleteConfirmOpen(false);
      await logout();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return <>
  <section className="card">
    <h2 className="red">Delete account</h2>
    <div className="card-sub" style={{ marginBottom: 14 }}>This permanently removes your account and cannot be undone.</div>
    {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
    <form onSubmit={submit}>
      <Field label="Current password" hint="Required to confirm account deletion"><PasswordField required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <button className="btn danger" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Deleting…' : 'Delete my account'}</button>
    </form>
  </section>
  {deleteConfirmOpen && <ConfirmModal title="Delete account" message="Delete your account permanently? This cannot be undone." confirmLabel="Delete account" onClose={() => setDeleteConfirmOpen(false)} onConfirm={deleteAccount} />}
  </>;
}
