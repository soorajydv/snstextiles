'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Field, Notice, PasswordField, errorMessage } from '@/components/ui';
import { appPath } from '@/lib/paths';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ businessName: '', contactPerson: '', phone: '', email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/register', { method: 'POST', body: form });
      router.replace(appPath('/login?registered=success'));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return <div className="login-wrap"><div className="login-art"><div className="brand"><div className="brand-mark">S&amp;S</div><div><div className="brand-name">S &amp; S TEXTILES</div><div className="brand-sub">CUSTOMER PORTAL</div></div></div><div><h1>Create your customer account.</h1><p>Register your club or business to place orders and track production.</p></div></div><div className="login-form"><form onSubmit={submit}><div className="eyebrow">CUSTOMER REGISTRATION</div><h1>Create account</h1>{error && <Notice tone="error">{error}</Notice>}<Field label="Club / business name *"><input required value={form.businessName} onChange={set('businessName')} /></Field><Field label="Contact person *"><input required value={form.contactPerson} onChange={set('contactPerson')} /></Field><Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field><Field label="Email *"><input type="email" required value={form.email} onChange={set('email')} /></Field><Field label="Username *"><input required minLength={3} value={form.username} onChange={set('username')} /></Field><Field label="Password *" hint="At least 8 characters"><PasswordField required minLength={8} value={form.password} onChange={set('password')} /></Field><button className="btn primary block" disabled={busy}>{busy ? 'Creating account…' : 'Create customer account'}</button><div style={{ textAlign: 'center', marginTop: 14 }}><a className="link-btn" href={appPath('/login')}>Back to sign in</a></div></form></div></div>;
}
