import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Zap, Play, Link2, Table2, GitMerge, Settings, ShieldAlert, Search, Bell, Command, Sparkles } from 'lucide-react';
import CRMAIAssistant from '../../components/crm/CRMAIAssistant';
import { useUnreadNotificationsCount } from '../../hooks/useUnreadNotificationsCount';



export default function AutomationsLayout() {
  const { count: unreadCount } = useUnreadNotificationsCount();
  const [isAIOpen, setIsAIOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col h-full bg-bg relative z-0">
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
          '--btn-bg': '#1A2C47',
          '--btn-hover': '#233857',
          '--btn-text': '#F8FAFC',
          '--btn-border': 'transparent'
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-5 pl-0 pb-3">
          <button 
            onClick={() => setIsAIOpen(true)} 
            className="px-3 py-1.5 rounded-lg font-medium text-[13px] transition-colors shadow-sm"
            style={{ background: 'var(--btn-bg)', color: 'var(--btn-text)' }}
          >
            AI Assistant
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

          <div className="h-5 w-[1px] bg-border mr-2" />

          <span className="text-[13px] font-semibold text-text-muted uppercase tracking-widest">Automations</span>
        </div>

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

      {/* Content area */}
      <div className="flex flex-1 min-h-0 bg-bg">
        {/* Page content */}
        <div className="flex-1 min-w-0 overflow-auto flex flex-col">
          <Outlet />
        </div>
      </div>
      </div>
      <CRMAIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </>
  );
}
