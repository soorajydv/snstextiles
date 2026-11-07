'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { appPath } from '@/lib/paths';
import { fetchSiteUser, npr, siteRequest, type SiteUser } from '@/lib/site-client';
import type { Order } from '@/lib/types';
import { AuthForms } from './AuthForms';
import { SiteIcon } from './SiteIcon';

/** Sends staff to the portal and customers to their account after signing in. */
function afterSignIn(user: SiteUser, router: ReturnType<typeof useRouter>, next?: string) {
  if (user.role !== 'customer') { window.location.href = appPath('/dashboard'); return; }
  router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/account');
  router.refresh();
}

export function AccountAuth({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    fetchSiteUser().then((user) => {
      if (user) afterSignIn(user, router);
      else setChecking(false);
    });
  }, [router]);
  if (checking) return <p className="muted">Checking your session…</p>;
  const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') ?? undefined : undefined;
  return <AuthForms initialMode={mode} onSignedIn={(user) => afterSignIn(user, router, next)} />;
}

const STAGE_STEPS = ['design', 'printing', 'stitching', 'finishing', 'ready', 'delivered'];

export function AccountView() {
  const router = useRouter();
  const [user, setUser] = useState<SiteUser | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    fetchSiteUser().then((u) => {
      if (!u) { router.replace('/account/login?next=/account'); return; }
      if (u.role !== 'customer') { window.location.href = appPath('/dashboard'); return; }
      setUser(u);
      siteRequest<{ orders: Order[] }>('/orders?sort=recent&limit=50').then((r) => setOrders(r.orders)).catch(() => setOrders([]));
    });
  }, [router]);

  async function logout() {
    await siteRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/');
    router.refresh();
  }

  if (!user) return <p className="muted">Loading your account…</p>;
  const open = orders?.filter((o) => o.stage !== 'delivered') ?? [];
  const balance = orders?.reduce((sum, o) => sum + (o.balance ?? 0), 0) ?? 0;

  return (
    <div className="account-grid">
      <aside className="account-card">
        <span className="account-avatar">{user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
        <h2>{user.name}</h2>
        <p className="muted">{user.customer?.name}<br />{user.email}</p>
        <nav className="account-links">
          <a href={appPath('/orders')}><SiteIcon name="file" size={18} /> Order portal</a>
          <a href={appPath('/billing')}><SiteIcon name="lock" size={18} /> Payments & invoices</a>
          <a href={appPath('/profile')}><SiteIcon name="user" size={18} /> Profile & password</a>
          <Link href="/account/favorites"><SiteIcon name="star" size={18} /> Favorites</Link>
          <Link href="/order-tracking"><SiteIcon name="truck" size={18} /> Track an order</Link>
          <button onClick={logout} type="button"><SiteIcon name="arrow" size={18} /> Sign out</button>
        </nav>
      </aside>
      <div>
        <div className="account-stats">
          <div><strong>{orders?.length ?? '—'}</strong><span>Orders</span></div>
          <div><strong>{orders ? open.length : '—'}</strong><span>In progress</span></div>
          <div><strong>{orders ? npr(balance) : '—'}</strong><span>Balance due</span></div>
        </div>
        <div className="account-section-head">
          <h2 className="h-sm">My orders</h2>
          <Link className="site-btn site-btn-sm" href="/shop">New order</Link>
        </div>
        {!orders ? <p className="muted">Loading orders…</p> : !orders.length ? (
          <div className="empty-state"><h2>No orders yet</h2><p>When you order from the shop, you can follow every step here.</p><Link className="site-btn site-btn-dark" href="/shop">Start shopping</Link></div>
        ) : (
          <ul className="order-cards">
            {orders.map((o) => {
              const step = Math.max(0, STAGE_STEPS.indexOf(o.stage));
              return (
                <li className="order-card" key={o.id}>
                  <div className="order-card-head">
                    <div><strong>{o.orderNo}</strong><span>{o.productName || o.productConfig} · {o.quantity} pcs</span></div>
                    <span className={`order-status ${o.stage === 'delivered' ? 'is-done' : ''}`}>{o.status}</span>
                  </div>
                  <div aria-label={`Stage ${step + 1} of ${STAGE_STEPS.length}`} className="order-progress"><span style={{ width: `${((step + 1) / STAGE_STEPS.length) * 100}%` }} /></div>
                  <div className="order-card-foot">
                    <span>{o.teamName} · placed {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {typeof o.totalAmount === 'number' && <span>{npr(o.totalAmount)}{o.balance ? ` · ${npr(o.balance)} due` : ' · paid'}</span>}
                    <a className="text-link" href={appPath(`/orders/${o.id}`)}>{o.status === 'Awaiting approval' ? 'Review design' : 'Details'} <SiteIcon name="arrow" size={16} /></a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
