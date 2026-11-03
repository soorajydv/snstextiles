'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppLink as Link } from './AppLink';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { initials, roleLabel } from '@/lib/format';
import type { Permission } from '@/lib/types';
import { api } from '@/lib/api';
import { useTheme } from './ThemeProvider';
import { Icon, type IconName } from './Icon';
import { PwaInstallButton } from './PwaInstallButton';
import { ConfirmModal } from './ui';
import { appPath } from '@/lib/paths';

type NavItem = { href: string; label: string; icon: IconName; permission?: Permission };
type NotificationItem = { id: string; type?: string; title: string; body: string; href: string; read: boolean };

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Overview', icon: 'dashboard', permission: 'dashboard.view' },
      { href: '/orders', label: 'Orders', icon: 'orders', permission: 'orders.view' },
      { href: '/production', label: 'Production board', icon: 'production', permission: 'orders.stage.complete' },
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
    label: 'Administration',
    items: [
      { href: '/users', label: 'Users & access', icon: 'users', permission: 'users.manage' },
      { href: '/roles', label: 'Roles & permissions', icon: 'roles', permission: 'roles.manage' },
      { href: '/profile', label: 'My profile', icon: 'profile', permission: 'profile.manage' },
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
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, meta, settings, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const section = pathname.split('/')[1] || 'dashboard';

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 820px)').matches) setOpen(true);
    else setCollapsed((value) => !value);
  }

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setNotificationsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);

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

  useEffect(() => {
    let active = true;
    api<{ notifications: NotificationItem[] }>('/notifications')
      .then((data) => { if (active) setNotifications(data.notifications); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [pathname]);

  const visible = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || meta.permissions.includes(i.permission)) })).filter((g) => g.items.length);
  const title = user.role === 'customer' && section === 'orders' ? 'My orders' : TITLES[section] ?? 'SNS Textiles';
  const notificationIcon = (type?: string): IconName => type === 'stock' ? 'inventory' : type === 'attendance' ? 'attendance' : type === 'approval' ? 'orders' : type === 'overdue' ? 'alert' : 'bell';
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  async function markNotificationRead(id: string) {
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, read: true } : notification));
    try {
      await api(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
    } catch {
      setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, read: false } : notification));
    }
  }

  async function markAllNotificationsRead() {
    if (!unreadCount || notificationsBusy) return;
    setNotificationsBusy(true);
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    try {
      await api('/notifications/read-all', { method: 'POST' });
    } catch {
      setNotifications((current) => current.map((notification) => ({ ...notification, read: false })));
    } finally {
      setNotificationsBusy(false);
    }
  }

  async function performLogout() {
    setUserMenuOpen(false);
    setLogoutConfirmOpen(false);
    await logout();
  }

  return (
    <div className={`layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          {settings.logoUrl ? <img className="brand-logo" src={settings.logoUrl} alt="Business logo" /> : <div className="brand-mark">S&amp;S</div>}
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
                <Link key={item.href} href={item.href} className={`nav-btn ${pathname.startsWith(appPath(item.href)) ? 'active' : ''}`}>
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
            <div className="notification-wrap" ref={notificationRef}>
              <button className="icon-btn" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Open notifications" aria-expanded={notificationsOpen}><Icon name="bell" size={17} />{unreadCount > 0 && <span className="notification-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
              {notificationsOpen && <div className="notification-menu">
                <div className="notification-head"><div><h3>Notifications</h3><span>{unreadCount ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up'}</span></div><div className="notification-head-actions">{unreadCount > 0 && <button className="notification-mark-all" onClick={markAllNotificationsRead} disabled={notificationsBusy}>{notificationsBusy ? 'Saving…' : 'Mark all as read'}</button>}<button className="notification-close" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><Icon name="close" size={15} /></button></div></div>
                {notifications.length ? <div className="notification-list">{notifications.map((notification) => <Link key={notification.id} href={notification.href} className={`notification-item ${notification.read ? 'read' : ''}`} onClick={async (event) => { event.preventDefault(); await markNotificationRead(notification.id); setNotificationsOpen(false); router.push(appPath(notification.href)); }}><span className="notification-icon"><Icon name={notificationIcon(notification.type)} size={15} /></span><span className="notification-copy"><strong>{notification.title}</strong><span>{notification.body}</span></span>{!notification.read && <span className="notification-unread" aria-label="Unread notification" />}</Link>)}</div> : <div className="empty">No new notifications.</div>}
              </div>}
            </div>
            <div className="user-chip" ref={userMenuRef}>
              <div className="who">
                {user.name}
                <small>{roleLabel(user.role, meta.roles)}</small>
              </div>
              <button className="avatar" type="button" onClick={() => setUserMenuOpen((value) => !value)} aria-label="Open account menu" aria-expanded={userMenuOpen} title="Account menu">
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.name)}
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
