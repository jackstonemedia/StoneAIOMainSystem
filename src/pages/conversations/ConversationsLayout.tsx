import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AlertTriangle, X, Bot, Bell } from 'lucide-react';
import { ConversationsProvider } from './context/ConversationsContext';
import { useChannelConnections } from '../../hooks/useConversations';
import { useUnreadNotificationsCount } from '../../hooks/useUnreadNotificationsCount';
import CRMAIAssistant from '../../components/crm/CRMAIAssistant';
import NotificationPanel from '../../components/ui/NotificationPanel';

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

export default function ConversationsLayout() {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { count: unreadCount } = useUnreadNotificationsCount();

  return (
    <ConversationsProvider>
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

          {/* Portal Target for Header Actions */}
          <div id="conversations-header-actions" className="flex items-center gap-3 pb-3 min-h-[44px]"></div>
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
    </ConversationsProvider>
  );
}
