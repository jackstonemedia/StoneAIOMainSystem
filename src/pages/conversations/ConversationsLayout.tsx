import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AlertTriangle, X, Bot, Bell, Search, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ConversationsProvider, useConversationsCtx } from './context/ConversationsContext';
import { useChannelConnections } from '../../hooks/useConversations';
import { useUnreadNotificationsCount } from '../../hooks/useUnreadNotificationsCount';
import CRMAIAssistant from '../../components/crm/CRMAIAssistant';
import NotificationPanel from '../../components/ui/NotificationPanel';
import { TourLauncher } from '../../components/tour/TourLauncher';
import { useAutoLaunchTour } from '../../hooks/useAutoLaunchTour';

function DisconnectedBanner() {
  const { data: connections = [] } = useChannelConnections();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const expired = connections.filter(c => c.status === 'expired' || (!c.isActive && c.provider !== 'twilio'));
  if (expired.length === 0 || dismissed) return null;

  const label =
    expired[0].provider === 'gmail' || expired[0].provider === 'outlook'
      ? (expired[0].email ?? 'Gmail')
      : (expired[0].twilioPhoneNumber ?? 'Twilio');

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-950/60 border-b border-amber-700/40 text-amber-300 text-[13px] font-medium shrink-0">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
      <span className="flex-1">
        <span className="font-semibold">{label}</span> connection expired.{' '}
        <button
          onClick={() => navigate('/conversations/settings/channels')}
          className="underline underline-offset-2 hover:text-amber-200 transition-colors"
        >
          Reconnect →
        </button>
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 hover:text-amber-100 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function ConversationsTopBarActions() {
  const qc = useQueryClient();
  const { view, setView, search, setSearch } = useConversationsCtx();
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput, setSearch]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  return (
    <div className="flex items-center gap-3 pb-3 min-h-[44px]">
      {/* View Selector Dropdown */}
      <select
        value={view}
        data-tour="inbox-channel-filter"
        onChange={e => setView(e.target.value as any)}
        className="bg-surface/40 hover:bg-surface border border-border/40 text-text-main text-[12px] font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary cursor-pointer shadow-xs transition-colors"
      >
        <option value="all">All</option>
        <option value="unassigned">Unassigned</option>
        <option value="mine">Assigned to Me</option>
        <option value="unread">Unread</option>
        <option value="snoozed">Snoozed</option>
        <option value="archived">Archived</option>
      </select>

      {/* Search Bar */}
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search conversations…"
          className="w-full pl-8 pr-7 py-1.5 bg-surface/40 hover:bg-surface border border-border/40 rounded-lg text-[12px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(''); setSearch(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Refresh */}
      <button
        onClick={() => qc.invalidateQueries({ queryKey: ['conversations'] })}
        className="btn-secondary"
        title="Refresh conversations"
      >
        <RefreshCw className="w-4 h-4" /> Refresh
      </button>

      <TourLauncher />
    </div>
  );
}

function ConversationsLayoutContent() {
  useAutoLaunchTour('conversations');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { count: unreadCount } = useUnreadNotificationsCount();

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans relative z-0 bg-bg overflow-hidden">
      {/* Full-tab frosted glass overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Conversations Top Nav Bar matching CRM */}
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
        {/* Left: AI Assistant Button & Notification Bell */}
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
            onClick={() => setIsNotifOpen(true)}
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
        </div>

        {/* Right: Search conversations, All view selector, and Refresh */}
        <ConversationsTopBarActions />
      </div>

      <DisconnectedBanner />

      {/* Page Content */}
      <div className="flex-1 overflow-hidden flex flex-col relative w-full">
        <Outlet />
      </div>

      {/* AI Assistant */}
      <CRMAIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
      
      {/* Notifications Panel */}
      <NotificationPanel isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </div>
  );
}

export default function ConversationsLayout() {
  return (
    <ConversationsProvider>
      <ConversationsLayoutContent />
    </ConversationsProvider>
  );
}
