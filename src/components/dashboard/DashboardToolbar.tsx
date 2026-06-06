import { useState } from 'react';
import { ChevronDown, LayoutGrid, Plus, RotateCcw } from 'lucide-react';
import type { DateRange } from '../../types/dashboard';

interface DashboardToolbarProps {
  greeting: string;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  isEditing: boolean;
  onToggleEdit: () => void;
  onAddWidget: () => void;
  onResetLayout: () => void;
}

const RANGE_LABELS: { id: DateRange; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '1y', label: 'This year' },
];

function getRangeLabel(value: DateRange): string {
  if (typeof value !== 'string') return 'Custom range';
  const found = RANGE_LABELS.find((r) => r.id === value);
  return found?.label ?? 'Last 30 days';
}

export function DashboardToolbar({
  greeting,
  dateRange,
  onDateRangeChange,
  isEditing,
  onToggleEdit,
  onAddWidget,
  onResetLayout,
}: DashboardToolbarProps) {
  const [open, setOpen] = useState(false);

  const rangeLabel = getRangeLabel(dateRange);

  return (
    <div className="sticky top-0 z-20 border-b border-border/60 bg-bg/95 backdrop-blur">
      <div className="max-w-[1440px] mx-auto px-6 md:px-8 py-3.5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/80 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.14em] text-text-muted">
              <LayoutGrid className="w-3 h-3" />
              <span>Workspace Overview</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <h1 className="text-[22px] md:text-[24px] font-bold tracking-tight text-text-main">Dashboard</h1>
              <span className="hidden md:inline text-[12px] text-text-muted truncate max-w-[360px]">{greeting}</span>
            </div>
            <p className="mt-1 text-[12px] text-text-muted md:hidden truncate">{greeting}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-hover/80 px-3 py-1.5 text-[13px] text-text-main hover:border-primary hover:text-primary transition-colors"
              >
                <span>{rangeLabel}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {open && (
                <div
                  className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-surface shadow-[var(--shadow-luxury)] z-30 overflow-hidden"
                >
                  {RANGE_LABELS.map((opt) => (
                    <button
                      key={opt.id as string}
                      type="button"
                      onClick={() => {
                        onDateRangeChange(opt.id);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${
                        dateRange === opt.id
                          ? 'bg-primary/10 text-text-main'
                          : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="hidden md:flex items-center gap-2 text-[11px] text-text-muted">
            <span>Drag cards to rearrange, resize from corners, and tailor this view to your workflow.</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onAddWidget}
              className="btn-secondary h-9 px-3 text-[13px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Widget</span>
            </button>

            <button
              type="button"
              onClick={onToggleEdit}
              className={`${
                isEditing
                  ? 'btn-danger h-9 px-3 text-[13px]'
                  : 'btn-primary h-9 px-3 text-[13px]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>{isEditing ? 'Done' : 'Edit Layout'}</span>
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={onResetLayout}
                className="inline-flex items-center justify-center rounded-full border border-border bg-transparent text-text-muted hover:text-text-main hover:border-primary transition-colors w-9 h-9"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
