import { ChevronDown, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DateRange } from '../../../types/dashboard';

const DASHBOARD_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'activity', label: 'Activity' },
  { id: 'calendar', label: 'Calendar' },
] as const;

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
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function TopBanner({ activeTab, setActiveTab, dateRange, onDateRangeChange }: TopBannerProps) {
  const [rangeOpen, setRangeOpen] = useState(false);

  return (
    <>
      {/* Tab nav — mirrors CrmLayout */}
      <div className="w-full flex items-center justify-between px-4 md:px-8 pt-6 pb-0 shrink-0 bg-surface border-b border-border z-10 sticky top-0 shadow-sm">
        <nav className="flex items-center gap-6 overflow-x-auto scrollbar-none">
          {DASHBOARD_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-[14px] font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] relative whitespace-nowrap shrink-0 ${
                  isActive ? 'text-text-main' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {tab.label}
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Toolbar — mirrors Contacts secondary bar */}
      <div className="px-4 md:px-8 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface relative shadow-[0_4px_16px_rgba(0,0,0,0.03)] min-h-[73px] py-3 md:py-0 md:h-[73px]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-hover text-[13px] font-medium text-text-main">
            <LayoutGrid className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
            <span className="truncate">Workspace pulse</span>
          </div>
          <div className="hidden sm:block w-[1px] h-5 bg-border" />
          <p className="hidden sm:block text-[12px] text-text-muted truncate max-w-[280px]">
            Revenue, pipeline, and contacts at a glance
          </p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <button
              type="button"
              onClick={() => setRangeOpen((v) => !v)}
              className="btn-secondary"
            >
              <span>{rangeLabel(dateRange)}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {rangeOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setRangeOpen(false)} aria-hidden />
                <div className="absolute right-0 mt-2 w-44 bg-surface border border-border/50 shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5">
                  {RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id as string}
                      type="button"
                      onClick={() => {
                        onDateRangeChange(opt.id);
                        setRangeOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[13px] font-medium transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                        dateRange === opt.id
                          ? 'text-text-main bg-primary/10'
                          : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="w-[1px] h-5 bg-border hidden sm:block" />
          <Link to="/crm/contacts" className="btn-primary">
            View contacts
          </Link>
        </div>
      </div>
    </>
  );
}
