import { Outlet, useLocation, NavLink } from 'react-router-dom';
import React, { useState } from 'react';
import { Bot, Bell, Mail, Zap, Users, FileText, BarChart2 } from 'lucide-react';
import { useUnreadNotificationsCount } from '../../hooks/useUnreadNotificationsCount';
import CRMAIAssistant from '../../components/crm/CRMAIAssistant';
import { TourLauncher } from '../../components/tour/TourLauncher';
import { useAutoLaunchTour } from '../../hooks/useAutoLaunchTour';

const NAV_TABS = [
  { name: 'Campaigns',   path: '/email-marketing/campaigns',   icon: Mail },
  { name: 'Automations', path: '/email-marketing/automations', icon: Zap },
  { name: 'Audience',    path: '/email-marketing/audience',    icon: Users },
  { name: 'Templates',   path: '/email-marketing/templates',   icon: FileText },
  { name: 'Analytics',   path: '/email-marketing/analytics',   icon: BarChart2 },
];

export default function EmailMarketingLayout() {
  useAutoLaunchTour('email-marketing');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const { count: unreadCount } = useUnreadNotificationsCount();
  const location = useLocation();
  const isBuilder =
    location.pathname.startsWith('/email-marketing/campaigns/new') ||
    (location.pathname.startsWith('/email-marketing/campaigns/') &&
      !location.pathname.includes('/analytics') &&
      location.pathname !== '/email-marketing/campaigns') ||
    location.pathname.startsWith('/email-marketing/automations/new') ||
    (location.pathname.startsWith('/email-marketing/automations/') &&
      location.pathname !== '/email-marketing/automations');

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans relative z-0 bg-bg text-text-main">
      {/* Top Nav Bar — Rendered for list/analytics views, hidden for full-screen composer */}
      {!isBuilder && (
        <div 
          className="w-full flex items-center justify-between pr-8 pl-0 pt-2.5 pb-0 shrink-0 border-b z-10 sticky top-0 shadow-sm backdrop-blur-md"
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
          {/* Left: AI Assistant, Notifications & Sub-Navigation Tabs */}
          <div className="flex items-center gap-4 pl-4 pb-2.5">
            <button 
              onClick={() => setIsAIOpen(true)} 
              className="flex items-center text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-main)] transition-colors p-1.5 rounded-lg hover:bg-white/5"
              title="AI Assistant"
            >
              <Bot className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
            
            <button
              onClick={() => document.dispatchEvent(new CustomEvent('open-notifications'))}
              className="flex items-center text-[var(--sidebar-text-muted)] hover:text-[var(--text-main)] transition-colors relative p-1.5 rounded-lg hover:bg-white/5"
              title="Notifications"
            >
              <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
              {unreadCount > 0 && (
                <span
                  className="absolute 0 top-0.5 right-0.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center border-2 border-[var(--sidebar-bg)]"
                  style={{ background: 'var(--primary)', color: '#ffffff' }}
                >{unreadCount}</span>
              )}
            </button>

            <div className="h-5 w-[1px] bg-white/15 mx-1" />

            {/* Sub-Navigation Tabs */}
            <nav className="flex items-center gap-1">
              {NAV_TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = location.pathname.startsWith(tab.path);
                return (
                  <NavLink
                    key={tab.path}
                    to={tab.path}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-interactive font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5 font-medium'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Right: Portal Target for Page-Specific Header Actions (Search bar, Action buttons) */}
          <div className="flex items-center gap-3 pb-2.5 min-h-[40px]">
            <div id="crm-header-actions" className="flex items-center gap-3"></div>
            <TourLauncher />
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className="flex-1 overflow-auto flex flex-col relative w-full bg-bg">
        <Outlet />
      </div>

      {/* Movable AI Assistant */}
      <CRMAIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  );
}
