'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { LocalFilePreview } from '@/components/LocalFilePreview';
import { Field, Notice, PageHeader, errorMessage } from '@/components/ui';
import { AVATAR_EXTENSIONS, MAX_AVATAR_BYTES, validateUploadFile } from '@/lib/uploads';
import { assetPath } from '@/lib/paths';

export default function SettingsPage() {
  const { meta, settings, refreshSettings } = useAuth();
  const toast = useToast();
  const canManage = meta.permissions.includes('settings.manage');
  const [form, setForm] = useState({ ...settings, dueSoonDays: String(settings.dueSoonDays) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    const validationError = validateUploadFile(file, { maxBytes: MAX_AVATAR_BYTES, extensions: AVATAR_EXTENSIONS, label: 'Business logo' });
    if (validationError) {
      setLogoError(validationError);
      toast(validationError, 'error');
      return;
    }
    setLogoFile(file);
    setLogoBusy(true);
    setLogoError('');
    try {
      const formData = new FormData();
      formData.append('logo', file);
      await api('/settings/business-logo', { method: 'PATCH', form: formData });
      await refreshSettings();
      setLogoFile(null);
      toast('Business logo updated');
    } catch (err) {
      setLogoError(errorMessage(err));
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    setLogoError('');
    try {
      await api('/settings/business-logo', { method: 'DELETE' });
      await refreshSettings();
      toast('Business logo removed');
    } catch (err) {
      setLogoError(errorMessage(err));
    } finally {
      setLogoBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/settings', {
        method: 'PUT',
        body: {
          businessName: form.businessName, address: form.address, phone: form.phone, email: form.email, panNumber: form.panNumber,
          orderPrefix: form.orderPrefix.toUpperCase(), invoicePrefix: form.invoicePrefix.toUpperCase(), dueSoonDays: Number(form.dueSoonDays), invoiceFooter: form.invoiceFooter,
        },
      });
      await refreshSettings();
      toast('Platform settings saved');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="PLATFORM SETTINGS" title="Business profile" subtitle="Configure the business identity, numbering and defaults used across the platform." />
      {!canManage ? <Notice tone="warn">Platform settings are managed by an administrator.</Notice> : (
        <form onSubmit={save} style={{ maxWidth: 900, display: 'grid', gap: 16 }}>
          <section className="card">
            {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
            <div className="profile-avatar-editor" style={{ marginBottom: 20 }}>
              <div className="profile-avatar-preview business-logo-preview">{settings.logoUrl ? <img src={assetPath(settings.logoUrl)} alt="Business logo" /> : 'SNS'}</div>
              <div><strong>Business logo</strong><div className="card-sub">Shown in the sidebar and business documents. PNG, JPG, WEBP or GIF · up to 5 MB</div>{logoFile && <LocalFilePreview file={logoFile} />}<div className="form-actions" style={{ marginTop: 8 }}><label className="btn small" style={{ cursor: logoBusy ? 'wait' : 'pointer' }}>{logoBusy ? 'Uploading…' : 'Choose image'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={logoBusy} onChange={(e) => { void uploadLogo(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>{settings.logoUrl && <button type="button" className="btn small" onClick={removeLogo} disabled={logoBusy}>Remove</button>}</div>{logoError && <div className="error-text">{logoError}</div>}</div>
            </div>
            <div className="form-grid">
              <Field label="Registered business name *" full><input required value={form.businessName} onChange={set('businessName')} /></Field>
              <Field label="Address" full><input value={form.address} onChange={set('address')} /></Field>
              <Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
              <Field label="Email"><input value={form.email} onChange={set('email')} /></Field>
              <Field label="PAN / VAT number"><input value={form.panNumber} onChange={set('panNumber')} /></Field>
              <Field label="Currency / timezone"><input value={`${form.currency} · ${form.timezone}`} disabled /></Field>
              <Field label="Order number prefix" hint={`Next orders: ${form.orderPrefix.toUpperCase()}-#####`}><input required value={form.orderPrefix} onChange={set('orderPrefix')} /></Field>
              <Field label="Invoice prefix" hint={`e.g. ${form.invoicePrefix.toUpperCase()}-${new Date().getFullYear()}-0001`}><input required value={form.invoicePrefix} onChange={set('invoicePrefix')} /></Field>
              <Field label="Show orders due within (days)" hint="Example: If you enter 3, orders with a delivery date of today, tomorrow, or within the next 3 days will show as Due soon."><input type="number" min={1} max={30} value={form.dueSoonDays} onChange={set('dueSoonDays')} /></Field>
              <Field label="Invoice footer" full><input value={form.invoiceFooter} onChange={set('invoiceFooter')} /></Field>
            </div>
          </section>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save platform settings'}</button>
        </form>
      )}
    </>
  );
}
