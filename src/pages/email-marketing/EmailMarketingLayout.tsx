import { Outlet, useLocation, NavLink, matchPath } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import { Bot, Bell, Mail, Zap, Users, FileText, BarChart2, Sparkles, Shield, Building2 } from 'lucide-react';
import { useUnreadNotificationsCount } from '../../hooks/useUnreadNotificationsCount';
import CRMAIAssistant from '../../components/crm/CRMAIAssistant';

// Every page in the section, in one nav — no dead ends. Mailboxes is NOT here:
// it lives in Settings (Outreach) and the overview's health section links to
// it; a section nav tab that jumps to Settings was a flow break (fixed 2026-11-07).
const NAV_TABS = [
  { name: 'Campaigns',        path: '/email-marketing/campaigns',    icon: Mail },
  { name: 'Create with AI',   path: '/email-marketing/create-with-ai', icon: Sparkles },
  { name: 'Automations',      path: '/email-marketing/automations',  icon: Zap },
  { name: 'Audience',         path: '/email-marketing/audience',     icon: Users },
  { name: 'Templates',        path: '/email-marketing/templates',    icon: FileText },
  { name: 'Analytics',        path: '/email-marketing/analytics',    icon: BarChart2 },
  { name: 'Suppression',      path: '/email-marketing/suppression',  icon: Shield },
  { name: 'Profile',          path: '/email-marketing/profile',       icon: Building2 },
];

// Full-screen routes (composer / canvas / studio) hide the section top nav.
// Route config, not string matching on location.pathname — the old isBuilder
// check was fragile (any campaign id containing '/analytics' flipped it).
const FULLSCREEN_PATTERNS = [
  '/email-marketing/campaigns/new',
  '/email-marketing/campaigns/:campaignId',
  '/email-marketing/automations/new',
  '/email-marketing/automations/:automationId',
  '/email-marketing/create-with-ai',
];

export default function EmailMarketingLayout() {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const { count: unreadCount } = useUnreadNotificationsCount();
  const location = useLocation();
  const isBuilder = FULLSCREEN_PATTERNS.some(
    (pattern) => matchPath({ path: pattern, end: true }, location.pathname) !== null,
  );
  const navRef = useRef<HTMLElement | null>(null);
  // The tab bar scrolls on narrower widths — keep the active tab visible.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans relative z-0 bg-bg text-text-main">
      {/* Top Nav Bar — Rendered for list/analytics views, hidden for full-screen composer */}
      {!isBuilder && (
        <div
          className="w-full flex items-center justify-between pr-4 pl-0 pt-2.5 pb-0 shrink-0 border-b z-10 sticky top-0 shadow-sm backdrop-blur-md"
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
          <div className="flex items-center gap-3 pl-4 pb-2.5 min-w-0 flex-1">
            <button
              onClick={() => setIsAIOpen(true)}
              className="flex items-center text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-main)] transition-colors p-1.5 rounded-lg hover:bg-white/5 shrink-0"
              title="AI Assistant"
            >
              <Bot className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>

            <button
              onClick={() => document.dispatchEvent(new CustomEvent('open-notifications'))}
              className="flex items-center text-[var(--sidebar-text-muted)] hover:text-[var(--text-main)] transition-colors relative p-1.5 rounded-lg hover:bg-white/5 shrink-0"
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

            <div className="h-5 w-[1px] bg-white/15 mx-1 shrink-0" />

            {/* Sub-Navigation Tabs — icons hide below 1600px so all 8 tabs fit
                at 1440px; the bar still scrolls on narrower widths rather than
                clipping the page actions (fixed 2026-11-07). */}
            <nav ref={navRef} className="flex items-center gap-0.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV_TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = location.pathname.startsWith(tab.path);
                return (
                  <NavLink
                    key={tab.path}
                    to={tab.path}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-primary text-white shadow-interactive font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5 font-medium'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 hidden min-[1600px]:inline" />
                    <span>{tab.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Right: Portal Target for Page-Specific Header Actions (Search bar, Action buttons) */}
          <div className="flex items-center gap-3 pb-2.5 min-h-[40px] shrink-0 pl-3">
            <div id="crm-header-actions" className="flex items-center gap-3"></div>
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
