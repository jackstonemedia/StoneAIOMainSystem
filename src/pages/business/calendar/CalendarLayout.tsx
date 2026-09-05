import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Bot, Bell } from 'lucide-react';
import { useUnreadNotificationsCount } from '../../../hooks/useUnreadNotificationsCount';
import CRMAIAssistant from '../../../components/crm/CRMAIAssistant';
import NotificationPanel from '../../../components/ui/NotificationPanel';

export default function CalendarLayout() {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { count: unreadCount } = useUnreadNotificationsCount();

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans relative z-0 bg-bg overflow-hidden">
      {/* Frosted glass overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* ── Top Header Bar matching CRM, Dashboard & Ad Manager ──────────────── */}
      <div 
        className="w-full flex items-center justify-between pr-6 pl-0 pt-3 pb-0 shrink-0 border-b z-10 sticky top-0 shadow-sm"
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
        {/* Left: AI Assistant & Notifications */}
        <div className="flex items-center gap-4 pl-4 pb-3">
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

        {/* Portal Target for Page Actions */}
        <div id="crm-header-actions" className="flex items-center gap-2 pb-3 min-h-[44px]"></div>
      </div>

      {/* ── Subpage Outlet ─────────────────────────────────────────── */}
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

