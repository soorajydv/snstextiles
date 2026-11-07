'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppLink as Link } from './AppLink';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { initials, roleLabel } from '@/lib/format';
import type { Permission } from '@/lib/types';
import { useTheme } from './ThemeProvider';
import { Icon, type IconName } from './Icon';
import { PwaInstallButton } from './PwaInstallButton';
import { ConfirmModal } from './ui';
import { appPath, assetPath } from '@/lib/paths';
import { WEBSITE_ENABLED } from '@/lib/features';

/** `permission` must all be held; `anyPermission` needs at least one. */
type NavItem = { href: string; label: string; icon: IconName; permission?: Permission | Permission[]; anyPermission?: Permission[]; exact?: boolean };
const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Overview', icon: 'dashboard', permission: 'dashboard.view' },
      { href: '/orders', label: 'Orders', icon: 'orders', permission: 'orders.view' },
      { href: '/production', label: 'Production board', icon: 'production', permission: 'orders.view' },
      { href: '/customers', label: 'Customers', icon: 'customers', permission: 'customers.view' },
      { href: '/inventory', label: 'Inventory', icon: 'inventory', permission: 'inventory.view' },
    ],
  },
  {
    label: 'Finance & insights',
    items: [
      { href: '/billing', label: 'Quotations & billing', icon: 'receipt', permission: 'payments.view' },
      { href: '/delivery', label: 'Delivery', icon: 'delivery', permission: 'orders.view' },
      { href: '/attendance', label: 'Attendance', icon: 'attendance', permission: 'attendance.view' },
      { href: '/reports', label: 'Reports', icon: 'chart', permission: 'reports.view' },
    ],
  },
  {
    label: 'Website',
    items: [
      { href: '/site', label: 'Website overview', icon: 'globe', permission: 'site.overview', exact: true },
      { href: '/site/orders', label: 'Website orders', icon: 'orders', permission: ['site.overview', 'orders.view'] },
      { href: '/site/products', label: 'Products', icon: 'tag', permission: 'site.products.view' },
      { href: '/site/categories', label: 'Categories', icon: 'box', permission: 'site.categories.view' },
      { href: '/site/enquiries', label: 'Enquiries', icon: 'mail', permission: 'site.enquiries.view' },
      { href: '/site/pages', label: 'Pages & blog', icon: 'file', anyPermission: ['site.pages.view', 'site.posts.view'] },
      { href: '/site/reviews', label: 'Reviews', icon: 'star', permission: 'site.reviews.view' },
      { href: '/site/subscribers', label: 'Subscribers', icon: 'users', permission: 'site.subscribers.view' },
      { href: '/site/settings', label: 'Website settings', icon: 'settings', permission: 'site.settings.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/users', label: 'Users & access', icon: 'users', permission: 'users.view' },
      { href: '/roles', label: 'Roles & permissions', icon: 'roles', permission: 'roles.view' },
      { href: '/profile', label: 'My profile', icon: 'profile', permission: 'profile.update' },
      { href: '/activity', label: 'Audit log', icon: 'activity', permission: 'audit.view' },
      { href: '/settings', label: 'Settings', icon: 'settings', permission: 'settings.view' },
    ],
  },
];

const TITLES: Record<string, string> = {
  dashboard: 'Factory overview',
  orders: 'Order management',
  production: 'Production board',
  customers: 'Customer directory',
  inventory: 'Inventory & materials',
  billing: 'Quotations & billing',
  delivery: 'Delivery & dispatch',
  attendance: 'Attendance & check-in',
  reports: 'Business reports',
  users: 'Users & access',
  roles: 'Roles & permissions',
  profile: 'My profile',
  activity: 'Audit log',
  settings: 'Settings',
  site: 'Website management',
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, meta, settings, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const section = pathname.split('/')[1] || 'dashboard';

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 820px)').matches) setOpen(true);
    else setCollapsed((value) => !value);
  }

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [userMenuOpen]);

  const allowed = (i: NavItem) =>
    (!i.permission || (Array.isArray(i.permission) ? i.permission : [i.permission]).every((p) => meta.permissions.includes(p)))
    && (!i.anyPermission || i.anyPermission.some((p) => meta.permissions.includes(p)));
  const visible = NAV.filter((g) => WEBSITE_ENABLED || g.label !== 'Website').map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length);
  const title = user.role === 'customer' && section === 'orders' ? 'My orders' : TITLES[section] ?? 'SNS Textiles';
  async function performLogout() {
    setUserMenuOpen(false);
    setLogoutConfirmOpen(false);
    await logout();
  }

  return (
    <div className={`layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          {settings.logoUrl ? <img className="brand-logo" src={assetPath(settings.logoUrl)} alt="Business logo" /> : <div className="brand-mark">S&amp;S</div>}
          <div className="brand-copy">
            <div className="brand-name">{settings.businessName.replace(/ PVT LTD$/i, '')}</div>
            <div className="brand-sub">{user.role === 'customer' ? 'CUSTOMER PORTAL' : 'FACTORY MANAGEMENT'}</div>
          </div>
        </div>
        {visible.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{user.role === 'customer' && group.label === 'Administration' ? 'Account' : group.label}</div>
            <nav className="nav-group">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={`nav-btn ${(item.exact ? pathname === appPath(item.href) : pathname.startsWith(appPath(item.href))) ? 'active' : ''}`}>
                  <span className="nav-icon"><Icon name={item.icon} size={17} /></span>
                  <span className="nav-text">{user.role === 'customer' && item.href === '/orders' ? 'My orders' : item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        ))}
        <div className="side-bottom">
          <div className="side-user-copy"><strong>{user.customer?.name ?? roleLabel(user.role, meta.roles)}</strong>
          Signed in as {user.email}</div>
          <button className="btn small block side-signout" onClick={() => setLogoutConfirmOpen(true)} title="Sign out">
            <Icon name="logout" size={14} /><span className="side-signout-label">Sign out</span>
          </button>
        </div>
      </aside>
      {open && <div className="modal-backdrop" style={{ zIndex: 45, background: '#0006' }} onClick={() => setOpen(false)} />}
      <main>
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="icon-btn sidebar-toggle" aria-label="Toggle sidebar" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleSidebar}><Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={19} className="sidebar-desktop-icon" /><Icon name="menu" size={19} className="sidebar-mobile-icon" /></button>
            <div>
              <div className="page-title">{title}</div>
            </div>
          </div>
          <div className="top-actions">
            <PwaInstallButton />
            <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /></button>
            <div className="user-chip" ref={userMenuRef}>
              <div className="who">
                {user.name}
                <small>{roleLabel(user.role, meta.roles)}</small>
              </div>
              <button className="avatar" type="button" onClick={() => setUserMenuOpen((value) => !value)} aria-label="Open account menu" aria-expanded={userMenuOpen} title="Account menu">
                {user.avatarUrl ? <img src={assetPath(user.avatarUrl)} alt="" /> : initials(user.name)}
              </button>
              {userMenuOpen && (
                <div className="user-menu" role="menu">
                  <Link className="user-menu-link" href="/profile" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <Icon name="profile" size={15} /> My profile
                  </Link>
                  <button className="user-menu-logout" type="button" role="menuitem" onClick={() => setLogoutConfirmOpen(true)}>
                    <Icon name="logout" size={15} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
        {logoutConfirmOpen && <ConfirmModal title="Sign out" message="Are you sure you want to sign out?" confirmLabel="Sign out" onClose={() => setLogoutConfirmOpen(false)} onConfirm={performLogout} />}
      </main>
    </div>
  );
}
