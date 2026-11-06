'use client';

import { useState } from 'react';
import { appPath } from '@/lib/paths';
import { SiteRequestError, siteRequest, type SiteUser } from '@/lib/site-client';

type Props = { initialMode?: 'login' | 'register'; onSignedIn: (user: SiteUser) => void; compact?: boolean };

/** Website sign-in / sign-up using the same customer accounts as the order portal. */
export function AuthForms({ initialMode = 'login', onSignedIn, compact }: Props) {
  const [mode, setMode] = useState(initialMode);
  return (
    <div className={`auth-card${compact ? ' auth-card-compact' : ''}`}>
      <div className="auth-tabs" role="tablist">
        <button aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : undefined} onClick={() => setMode('login')} role="tab" type="button">Sign in</button>
        <button aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : undefined} onClick={() => setMode('register')} role="tab" type="button">Create account</button>
      </div>
      {mode === 'login' ? <LoginForm onSignedIn={onSignedIn} /> : <RegisterForm onSignedIn={onSignedIn} />}
    </div>
  );
}

function LoginForm({ onSignedIn }: { onSignedIn: (user: SiteUser) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await siteRequest<{ user: SiteUser }>('/auth/login', { body: { identifier, password } });
      onSignedIn(result.user);
    } catch (err) {
      setError(err instanceof SiteRequestError ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="buy-field"><span>Email, username or phone</span><input autoComplete="username" onChange={(e) => setIdentifier(e.target.value)} required value={identifier} /></label>
      <label className="buy-field"><span>Password</span><input autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} required type="password" value={password} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="site-btn site-btn-dark" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
      <a className="auth-link" href={appPath('/forgot-password')}>Forgot your password?</a>
    </form>
  );
}

function RegisterForm({ onSignedIn }: { onSignedIn: (user: SiteUser) => void }) {
  const [form, setForm] = useState({ contactPerson: '', businessName: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    // Usernames are required by the portal; derive a readable one from the email.
    const base = form.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30) || 'customer';
    const username = `${base.length >= 3 ? base : `${base}user`}${Math.floor(100 + Math.random() * 900)}`;
    try {
      await siteRequest('/auth/register', { body: { ...form, businessName: form.businessName.trim() || form.contactPerson, username } });
      const result = await siteRequest<{ user: SiteUser }>('/auth/login', { body: { identifier: form.email, password: form.password } });
      onSignedIn(result.user);
    } catch (err) {
      setError(err instanceof SiteRequestError ? err.message : 'Could not create your account.');
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="form-row">
        <label className="buy-field"><span>Your name *</span><input autoComplete="name" minLength={2} onChange={set('contactPerson')} required value={form.contactPerson} /></label>
        <label className="buy-field"><span>Team / organisation</span><input autoComplete="organization" onChange={set('businessName')} placeholder="Optional" value={form.businessName} /></label>
      </div>
      <div className="form-row">
        <label className="buy-field"><span>Email *</span><input autoComplete="email" onChange={set('email')} required type="email" value={form.email} /></label>
        <label className="buy-field"><span>Phone</span><input autoComplete="tel" inputMode="tel" onChange={set('phone')} value={form.phone} /></label>
      </div>
      <label className="buy-field"><span>Password * <em>at least 8 characters</em></span><input autoComplete="new-password" minLength={8} onChange={set('password')} required type="password" value={form.password} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="site-btn site-btn-dark" disabled={busy} type="submit">{busy ? 'Creating account…' : 'Create account'}</button>
      <p className="auth-note">Your account also gives you access to the order portal, where you approve designs and follow production.</p>
    </form>
  );
}
