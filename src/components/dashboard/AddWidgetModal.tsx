import { useState } from 'react';
import type { WidgetType } from '../../types/dashboard';
import { SlidePanel } from '../ui/SlidePanel';

interface AddWidgetModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: WidgetType) => void;
  existingTypes: WidgetType[];
}

type Category = 'All' | 'Metrics' | 'CRM' | 'Marketing' | 'Productivity';

const WIDGETS: {
  type: WidgetType;
  name: string;
  description: string;
  category: Category;
}[] = [
  { type: 'metric', name: 'Metric', description: 'Single KPI tile (revenue, pipeline, contacts, conversion).', category: 'Metrics' },
  { type: 'revenue_chart', name: 'Revenue Chart', description: 'Area chart of revenue over time.', category: 'Metrics' },
  { type: 'pipeline_funnel', name: 'Pipeline Funnel', description: 'Visualize deals by pipeline stage.', category: 'CRM' },
  { type: 'activity_feed', name: 'Activity Feed', description: 'Live feed of recent activity across the workspace.', category: 'CRM' },
  { type: 'tasks', name: 'Tasks', description: "Today's outstanding tasks with quick-complete.", category: 'Productivity' },
  { type: 'schedule', name: 'Schedule', description: "Today's upcoming appointments and calls.", category: 'Productivity' },
  { type: 'conversion', name: 'Conversion Funnel', description: 'Conversion rates between pipeline stages.', category: 'Metrics' },
  { type: 'campaign_health', name: 'Campaign Health', description: 'Performance of active campaigns.', category: 'Marketing' },
  { type: 'leaderboard', name: 'Leaderboard', description: 'Top performing workflows by run volume.', category: 'Productivity' },
  { type: 'quick_actions', name: 'Quick Actions', description: 'Grid of shortcuts to common actions.', category: 'Productivity' },
];

export function AddWidgetModal({ open, onClose, onAdd, existingTypes }: AddWidgetModalProps) {
  const [category, setCategory] = useState<Category>('All');

  const filtered = category === 'All'
    ? WIDGETS
    : WIDGETS.filter((w) => w.category === category);

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Add Widget"
      subtitle="Choose a widget to add to your dashboard"
      width="sm"
    >
      <div className="px-5 py-4 border-b border-border bg-surface/60 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="uppercase tracking-[0.16em] font-semibold">Categories</span>
        </div>
        <div className="flex items-center gap-1 text-[12px]">
          {(['All', 'Metrics', 'CRM', 'Marketing', 'Productivity'] as Category[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-full border text-[12px] font-medium transition-colors ${
                category === cat
                  ? 'bg-primary/10 border-primary text-text-main'
                  : 'bg-surface border-border text-text-muted hover:text-text-main hover:border-primary/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((w) => {
          const disabled = existingTypes.includes(w.type);
          return (
            <div
              key={w.type}
              className="card-surface border border-border rounded-xl p-4 flex flex-col justify-between gap-3 shadow-[var(--shadow-card)]"
            >
              <div>
                <div className="h-20 mb-3 rounded-lg bg-[color:var(--surface-hover)]/70 border border-[var(--border-subtle)]" />
                <div className="text-sm font-semibold text-text-main">{w.name}</div>
                <div className="text-xs text-text-muted mt-0.5 leading-relaxed">{w.description}</div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    onAdd(w.type);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 border transition-colors ${
                    disabled
                      ? 'border-border text-text-muted/60 bg-surface cursor-not-allowed'
                      : 'border-primary text-text-main bg-primary/10 hover:bg-primary/20'
                  }`}
                >
                  {disabled ? 'Added' : 'Add'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </SlidePanel>
  );
}
