import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Search, Bell, Command, Bot } from 'lucide-react';
import CRMAIAssistant from '../../components/crm/CRMAIAssistant';
import { useUnreadNotificationsCount } from '../../hooks/useUnreadNotificationsCount';

export type AdsPlatform = 'ALL' | 'GOOGLE' | 'FACEBOOK';
export type AdsPreset = 'TODAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'LAST_MONTH';

export interface AdsOutletContext {
  platform: AdsPlatform;
  preset: AdsPreset;
  refetchRef: React.MutableRefObject<(() => void) | null>;
}

const DATE_RANGES: { label: string; value: AdsPreset }[] = [
  { label: 'Today',        value: 'TODAY' },
  { label: 'Last 7 Days',  value: 'LAST_7' },
  { label: 'Last 30 Days', value: 'LAST_30' },
  { label: 'This Month',   value: 'THIS_MONTH' },
  { label: 'Last Month',   value: 'LAST_MONTH' },
];

export default function AdsLayout() {
  const location = useLocation();
  const { count: unreadCount } = useUnreadNotificationsCount();
  const [isAIOpen, setIsAIOpen]   = useState(false);
  const [platform, setPlatform]   = useState<AdsPlatform>('ALL');
  const [preset, setPreset]       = useState<AdsPreset>('LAST_30');

  const isOverview = location.pathname === '/ads' || location.pathname === '/ads/overview' || location.pathname === '/ads/';

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans relative z-0 bg-bg">
      {/* Ads Nav Bar — standardized */}
      <div
        className="w-full flex items-center justify-between pr-4 pl-0 shrink-0 border-b z-10 sticky top-0 shadow-sm"
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
          '--text-main': '#ffffff',
          '--text-muted': '#94a3b8',
          '--border': 'rgba(255,255,255,0.15)',
          '--surface': 'rgba(255,255,255,0.1)',
          '--surface-hover': 'rgba(255,255,255,0.16)',
          '--bg': 'var(--sidebar-bg)',
          '--btn-bg': 'var(--primary)',
          '--btn-hover': 'var(--primary-hover)',
          '--btn-text': '#ffffff',
          '--btn-border': 'transparent'
        } as React.CSSProperties}
      >
        {/* Left — AI bot + Bell + Platform tabs */}
        <div className="flex items-center gap-4 pl-4 py-3">
          <button
            onClick={() => setIsAIOpen(true)}
            className="flex items-center text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-main)] transition-colors"
            title="AI Assistant"
          >
            <Bot className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>

          <div className="h-5 w-[1px] bg-border" />

          <button
            onClick={() => document.dispatchEvent(new CustomEvent('open-notifications'))}
            className="flex items-center text-[var(--sidebar-text-muted)] hover:text-[var(--text-main)] transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center border-2 border-[var(--sidebar-bg)]"
                style={{ background: 'var(--primary)', color: '#ffffff' }}
              >{unreadCount}</span>
            )}
          </button>

          {isOverview && (
            <>
              <div className="h-5 w-[1px] bg-border" />

              {/* Platform tabs matching dashboard pipeline pills */}
              <div className="flex items-center gap-0.5 bg-surface/40 border border-border/40 rounded-lg p-0.5">
                {(['ALL', 'GOOGLE', 'FACEBOOK'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                      platform === p
                        ? 'bg-surface text-text-main shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {p === 'ALL' ? 'All Platforms' : p === 'GOOGLE' ? 'Google' : 'Meta'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right — Date range + Search */}
        <div className="flex items-center gap-3 py-3">
          {isOverview && (
            <div className="flex items-center gap-0.5 bg-surface/40 border border-border/40 rounded-lg p-0.5">
              {DATE_RANGES.map(dr => (
                <button
                  key={dr.value}
                  onClick={() => setPreset(dr.value)}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                    preset === dr.value
                      ? 'bg-surface text-text-main shadow-xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {dr.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => document.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{ background: 'rgba(0,0,0,0.1)', borderColor: 'var(--border)', color: 'var(--sidebar-text-muted)' }}
          >
            <Search className="w-4 h-4" />
            <span className="text-[13px]">Search</span>
            <div
              className="flex items-center gap-1 ml-3 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
              style={{ background: 'var(--surface-hover)', color: 'var(--sidebar-text-main)' }}
            >
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </button>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-auto flex flex-col relative w-full bg-bg">
        <Outlet context={{ platform, preset } satisfies Omit<AdsOutletContext, 'refetchRef'>} />
      </div>
      <CRMAIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  );
}
