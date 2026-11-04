'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Field, Notice, PasswordField, errorMessage } from '@/components/ui';
import { useTheme } from '@/components/ThemeProvider';
import { appPath } from '@/lib/paths';

const DEMO = [
  ['Owner', 'owner@sstextiles.com'],
  ['Designer', 'design@sstextiles.com'],
  ['Cutting', 'cutting@sstextiles.com'],
  ['Printing', 'printing@sstextiles.com'],
  ['Stitching', 'stitching@sstextiles.com'],
  ['Finishing', 'finishing@sstextiles.com'],
  ['Accounts', 'accounts@sstextiles.com'],
  ['Customer', 'tigers@himalayantigers.com'],
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { theme, toggleTheme } = useTheme();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: { identifier, password } });
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : appPath('/dashboard'));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -4 }}>
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? '☀' : '☾'}</button>
      </div>
      <div>
        <div className="eyebrow">S&amp;S TEXTILES</div>
        <h1>Sign in</h1>
        <div className="subtitle">Staff and customer accounts use the same sign-in.</div>
      </div>
      {params.get('reset') === 'success' && <Notice>Password updated successfully. Sign in with your new password.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Username, phone or email">
        <input autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
      </Field>
      <Field label="Password">
        <PasswordField autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <div style={{ textAlign: 'right', marginTop: 10 }}><a className="link-btn" href={appPath('/forgot-password')}>Forgot password?</a></div>
      {process.env.NODE_ENV !== 'production' && (
        <div className="card" style={{ marginTop: 6 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Demo accounts · password Password@123</div>
          <div className="demo-accounts">
            {DEMO.map(([label, mail]) => (
              <button key={mail} type="button" className="btn small" onClick={() => { setIdentifier(mail); setPassword('Password@123'); }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

export default function LoginPage() {
  const [logoAvailable, setLogoAvailable] = useState(true);

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="brand" style={{ borderBottom: 0 }}>
          {logoAvailable ? <img className="brand-logo" src={appPath('/api/public/business-logo')} alt="Business logo" onError={() => setLogoAvailable(false)} /> : <div className="brand-mark">S&amp;S</div>}
          <div>
            <div className="brand-name">S &amp; S TEXTILES</div>
            <div className="brand-sub">FACTORY MANAGEMENT</div>
          </div>
        </div>
        <div>
          <h1>Every team kit, from artwork to delivery.</h1>
          <p>Register orders, get customer artwork approval, move jobs through printing, stitching and finishing, and keep billing in step.</p>
        </div>
        <div className="brand-sub">Design → Printing → Stitching → Finishing → Dispatch</div>
      </div>
      <div className="login-form">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
