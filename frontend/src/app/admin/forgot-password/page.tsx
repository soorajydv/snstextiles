'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Field, Notice, errorMessage } from '@/components/ui';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setResetUrl('');
    try {
      const result = await api<{ message: string; resetUrl?: string }>('/auth/forgot-password', { method: 'POST', body: { email } });
      setMessage(result.message);
      if (result.resetUrl) setResetUrl(result.resetUrl);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    <div className="eyebrow">S&amp;S TEXTILES</div>
    <h1>Forgot password?</h1>
    <div className="subtitle">Enter your account email and we’ll prepare a secure password reset link.</div>
    {error && <Notice tone="error">{error}</Notice>}
    {message && <Notice tone="info">{message}</Notice>}
    <Field label="Email"><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
    <button className="btn primary block" disabled={busy}>{busy ? 'Preparing link…' : 'Send reset link'}</button>
    {resetUrl && <Notice style={{ marginTop: 12 }}><strong>Development reset link</strong><br /><a className="link-btn" href={resetUrl}>Open password reset</a></Notice>}
    <div style={{ textAlign: 'center', marginTop: 16 }}><Link className="link-btn" href="/login">← Back to sign in</Link></div>
  </form>;
}

export default function ForgotPasswordPage() {
  return <div className="login-wrap"><div className="login-art"><div className="brand"><div className="brand-mark">S&amp;S</div><div><div className="brand-name">S &amp; S TEXTILES</div><div className="brand-sub">FACTORY MANAGEMENT</div></div></div><div><h1>Secure access for every team.</h1><p>Password recovery links expire automatically and can only be used once.</p></div></div><div className="login-form"><Suspense><ForgotPasswordForm /></Suspense></div></div>;
}
