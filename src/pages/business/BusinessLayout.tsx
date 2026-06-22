import { useState, useEffect } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { Search, Bell, Command } from 'lucide-react';
import BusinessOnboarding from './BusinessOnboarding';
import { db, StorageKey } from '../../lib/storage';

const ONBOARDING_KEY = 'stone-aio-business-onboarded';

const MARKETING_TABS = [
  { to: '/marketing/sites',  label: 'Sites' },
  { to: '/marketing/email',  label: 'Email Campaigns' },
];

const BUSINESS_TABS = [
  { to: '/business',            label: 'Dashboard', end: true },
  { to: '/business/campaigns',  label: 'Campaigns' },
  { to: '/business/calendar',   label: 'Calendar' },
  { to: '/business/forms',      label: 'Forms' },
  { to: '/business/analytics',  label: 'Analytics' },
  { to: '/business/reputation', label: 'Reputation' },
];

export default function BusinessLayout() {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const completeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    setHasOnboarded(true);
  };

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

  if (!hasOnboarded) {
    return <BusinessOnboarding onComplete={completeOnboarding} />;
  }

  const isMarketing = location.pathname.startsWith('/marketing');
  const tabs = isMarketing ? MARKETING_TABS : BUSINESS_TABS;

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ background: 'var(--bg)', color: 'var(--text-main)' }}
    >
      {/* Top Nav Bar */}
      <div className="w-full flex items-center justify-between px-8 pt-6 pb-0 shrink-0 bg-surface border-b border-border z-10 sticky top-0 shadow-sm">
        {/* Left: tabs */}
        <nav className="flex items-center gap-6">
          {tabs.map((tab: any) => {
            const isActive = tab.end
              ? location.pathname === tab.to
              : location.pathname.startsWith(tab.to);
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={!!tab.end}
                className={`pb-3 text-[14px] font-medium transition-all duration-150 relative whitespace-nowrap ${
                  isActive ? 'text-text-main' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Right: Search + Bell */}
        <div className="flex items-center gap-3 pb-3">
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

      <main className="flex-1 overflow-hidden flex flex-col w-full">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
