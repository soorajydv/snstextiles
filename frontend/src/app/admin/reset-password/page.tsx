'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Field, Notice, errorMessage } from '@/components/ui';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    setError('');
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: password } });
      router.replace('/login?reset=success');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!token) return <><div className="eyebrow">S&amp;S TEXTILES</div><h1>Invalid reset link</h1><Notice tone="error">This password reset link is missing its security token.</Notice><div style={{ marginTop: 16 }}><Link className="link-btn" href="/forgot-password">Request a new link</Link></div></>;

  return <form onSubmit={submit}>
    <div className="eyebrow">S&amp;S TEXTILES</div>
    <h1>Set a new password</h1>
    <div className="subtitle">Choose a new password with at least 8 characters. This link expires after 30 minutes and can only be used once.</div>
    {error && <Notice tone="error">{error}</Notice>}
    <Field label="New password"><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
    <Field label="Confirm password"><input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
    <button className="btn primary block" disabled={busy}>{busy ? 'Updating password…' : 'Update password'}</button>
    <div style={{ textAlign: 'center', marginTop: 16 }}><Link className="link-btn" href="/login">Back to sign in</Link></div>
  </form>;
}

export default function ResetPasswordPage() {
  return <div className="login-wrap"><div className="login-art"><div className="brand"><div className="brand-mark">S&amp;S</div><div><div className="brand-name">S &amp; S TEXTILES</div><div className="brand-sub">FACTORY MANAGEMENT</div></div></div><div><h1>Back to a secure workspace.</h1><p>Choose a new password to continue managing your orders, production and billing.</p></div></div><div className="login-form"><Suspense><ResetPasswordForm /></Suspense></div></div>;
}
