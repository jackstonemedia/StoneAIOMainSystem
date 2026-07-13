import { Bell, ChevronDown, Plus, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import type { DateRange } from '../../../types/dashboard';
import { useUnreadNotificationsCount } from '../../../hooks/useUnreadNotificationsCount';
import CRMAIAssistant from '../../crm/CRMAIAssistant';

const RANGE_OPTIONS: { id: DateRange; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '1y', label: 'This year' },
];

function rangeLabel(value: DateRange): string {
  return RANGE_OPTIONS.find((r) => r.id === value)?.label ?? 'Last 30 days';
}

interface TopBannerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function TopBanner({ dateRange, onDateRangeChange }: TopBannerProps) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const { count: unreadCount } = useUnreadNotificationsCount();

  return (
    <>
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
        </div>

        {/* Right side: Date Range & Action Buttons */}
        <div className="flex items-center gap-3 pb-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setRangeOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] border transition-colors shadow-sm font-medium text-[12px]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
            >
              <span>{rangeLabel(dateRange)}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
            {rangeOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setRangeOpen(false)} aria-hidden />
                <div className="absolute right-0 mt-2 w-44 border border-border shadow-luxury rounded-[8px] overflow-hidden py-1 z-50 ring-1 ring-white/5"
                     style={{ background: 'var(--bg)' }}>
                  {RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id as string}
                      type="button"
                      onClick={() => {
                        onDateRangeChange(opt.id);
                        setRangeOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[13px] font-medium transition-colors duration-200 ${
                        dateRange === opt.id
                          ? 'text-text-main bg-primary/10'
                          : 'text-text-muted hover:text-text-main hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="h-5 w-[1px] bg-border mx-1" />

          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border transition-colors shadow-sm font-medium text-[12px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
          >
            <LayoutGrid className="w-3.5 h-3.5 opacity-70" />
            <span>Edit Layout</span>
          </button>
          
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors border"
            style={{ background: 'var(--primary)', borderColor: 'transparent', color: '#ffffff' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Widget</span>
          </button>
        </div>
      </div>
      <CRMAIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </>
  );
}
