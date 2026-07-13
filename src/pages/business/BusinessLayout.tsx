import React, { useState } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { Search, Bell, Command, Bot } from 'lucide-react';
import CRMAIAssistant from '../../components/crm/CRMAIAssistant';
import BusinessOnboarding from './BusinessOnboarding';
import { useUnreadNotificationsCount } from '../../hooks/useUnreadNotificationsCount';

const ONBOARDING_KEY = 'stone-aio-business-onboarded';


export default function BusinessLayout() {
  const location = useLocation();
  const { count: unreadCount } = useUnreadNotificationsCount();
  const [isAIOpen, setIsAIOpen] = useState(false);

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

  if (!hasOnboarded) {
    return <BusinessOnboarding onComplete={completeOnboarding} />;
  }


  return (
    <div className="flex flex-col h-full w-full text-sm font-sans relative z-0 bg-bg">
      {/* Top Nav Bar */}
      <div 
        className="w-full flex items-center justify-between pr-8 pl-0 pt-3 pb-0 shrink-0 border-b z-10 sticky top-0 shadow-sm"
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
        {/* Left: AI Assistant Button + Bell + Tabs */}
        <div className="flex items-center gap-5 pl-4 pb-3">
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
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center border-2 border-[var(--sidebar-bg)]"
                style={{ background: 'var(--primary)', color: '#ffffff' }}
              >{unreadCount}</span>
            )}
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 pb-3">
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

      <main className="flex-1 overflow-hidden flex flex-col w-full relative z-0">
        <div className="flex-1 overflow-auto bg-bg">
          <Outlet />
        </div>
      </main>

      <CRMAIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  );
}
