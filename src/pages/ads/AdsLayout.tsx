import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Settings, Search, Bell, Command } from 'lucide-react';
import { db, StorageKey } from '../../lib/storage';

const workspaceNav = [
  { to: '/ads/overview',   label: 'Overview' },
  { to: '/ads/campaigns',  label: 'Campaigns' },
  { to: '/ads/reports',    label: 'Reports' },
];

export default function AdsLayout() {
  const location = useLocation();
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
    <div className="flex flex-col h-full w-full text-sm font-sans relative z-0 bg-bg">
      {/* Ads Nav Bar — identical structure to CrmLayout */}
      <div className="w-full flex items-center justify-between px-8 pt-6 pb-0 shrink-0 bg-surface border-b border-border z-10 sticky top-0 shadow-sm">
        {/* Left: workspace tabs + settings */}
        <div className="flex items-center">
          <nav className="flex items-center gap-6">
            {workspaceNav.map((link) => {
              const isActive =
                location.pathname === link.to ||
                location.pathname.startsWith(link.to + '/');
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={`pb-3 text-[14px] font-medium transition-all duration-150 relative whitespace-nowrap ${
                    isActive ? 'text-text-main' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="h-5 w-[1px] bg-border mx-6 relative bottom-1.5" />

          <NavLink
            to="/ads/settings"
            className="pb-3 text-text-muted hover:text-text-main transition-colors relative"
          >
            <Settings className="w-[18px] h-[18px]" strokeWidth={2} />
            {location.pathname.includes('/ads/settings') && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            )}
          </NavLink>
        </div>

        {/* Right: Search + Bell */}
        <div className="flex items-center gap-3 pb-3">
          {/* Search / Command Palette trigger */}
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

          {/* Bell / Notifications */}
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

      {/* Page Content */}
      <div className="flex-1 overflow-auto flex flex-col relative w-full bg-bg">
        <Outlet />
      </div>
    </div>
  );
}
