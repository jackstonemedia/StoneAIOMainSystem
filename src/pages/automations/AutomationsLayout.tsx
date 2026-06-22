import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Zap, Play, Link2, Table2, GitMerge, Settings, ShieldAlert, Search, Bell, Command } from 'lucide-react';
import { db, StorageKey } from '../../lib/storage';

const NAV_ITEMS = [
  { to: '/automations',              label: 'Workflows',   icon: Zap,      end: true },
  { to: '/automations/runs',         label: 'Runs',        icon: Play,     end: false },
  { to: '/automations/connections',  label: 'Connections', icon: Link2,    end: false },
  { to: '/automations/tables',       label: 'Tables',      icon: Table2,   end: false },
  { to: '/automations/releases',     label: 'Releases',    icon: GitMerge, end: false },
  { to: '/automations/settings',     label: 'Settings',    icon: Settings, end: false },
];

export default function AutomationsLayout() {
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
    <div className="flex flex-col h-full bg-bg">
      {/* Top bar with Search + Bell */}
      <div className="w-full flex items-center justify-between px-6 py-3 shrink-0 bg-surface border-b border-border z-10 sticky top-0 shadow-sm">
        <span className="text-[13px] font-semibold text-text-muted uppercase tracking-widest">Automations</span>
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
      <div className="flex flex-1 min-h-0 bg-bg">
        {/* Left sidebar — sub-navigation */}
        <aside className="w-48 shrink-0 border-r border-border bg-surface flex flex-col py-3">
          <nav className="flex-1 space-y-0.5">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-text-muted hover:text-text-main hover:bg-bg'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          
          {/* Platform Admin link at bottom */}
          <div className="mt-auto pt-4 px-2 border-t border-border">
            <NavLink
              to="/admin"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Platform Admin
            </NavLink>
          </div>
        </aside>

        {/* Page content */}
        <div className="flex-1 min-w-0 overflow-auto flex flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
