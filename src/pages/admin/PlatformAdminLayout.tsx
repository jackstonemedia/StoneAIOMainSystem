import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  Building2, Users, Shield, History, Package, Bot, 
  Network, Lock, PaintBucket, Key, ArrowLeft, Search, Bell, Command
} from 'lucide-react';
import { db, StorageKey } from '../../lib/storage';

const ADMIN_NAV = [
  { to: '/admin/projects',       label: 'Projects',       icon: Building2 },
  { to: '/admin/users',          label: 'Users',          icon: Users },
  { to: '/admin/roles',          label: 'Project Roles',  icon: Shield },
  { to: '/admin/audit',          label: 'Audit Logs',     icon: History },
  { to: '/admin/pieces',         label: 'Pieces',         icon: Package },
  { to: '/admin/ai',             label: 'AI',             icon: Bot },
  { to: '/admin/infrastructure', label: 'Infrastructure', icon: Network },
  { to: '/admin/security',       label: 'Security',       icon: Lock },
  { to: '/admin/branding',       label: 'Branding',       icon: PaintBucket },
  { to: '/admin/sso',            label: 'SSO / SCIM',     icon: Key },
];

export default function PlatformAdminLayout() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const notifs = await db.get<any>(StorageKey.NOTIFICATIONS);
        setUnreadCount(notifs.filter((n: any) => !n.isRead).length);
      } catch (_) {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg font-sans text-text-main">
      {/* Top bar with Search + Bell */}
      <div className="w-full flex items-center justify-between px-6 py-3 shrink-0 bg-surface border-b border-border z-10 sticky top-0 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-500" />
          <span className="text-sm font-bold tracking-wide uppercase text-text-main">Platform Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <Search className="w-4 h-4" />
            <span className="text-[13px]">Search</span>
            <div
              className="flex items-center gap-1 ml-3 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
              style={{ background: 'var(--surface-hover)' }}
            >
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </button>

          <button
            onClick={() => document.dispatchEvent(new CustomEvent('open-notifications'))}
            className="relative p-2 rounded-lg transition-colors hover:bg-surface-hover"
            style={{ color: 'var(--text-main)' }}
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-surface" />
            )}
          </button>
        </div>
      </div>

      {/* Content area with sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <NavLink to="/automations" className="text-xs font-medium text-text-muted hover:text-text-main flex items-center gap-1.5 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to App
            </NavLink>
          </div>
          
          <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
            {ADMIN_NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-red-500/10 text-red-400 font-medium'
                      : 'text-text-muted hover:text-text-main hover:bg-bg'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-bg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
