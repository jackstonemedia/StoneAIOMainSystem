import { useState } from 'react';
import type { MetricKey, WidgetType } from '../../types/dashboard';
import { SlidePanel } from '../ui/SlidePanel';

interface AddWidgetModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: WidgetType, config?: { metricKey?: MetricKey; label?: string }) => void;
  existingTypes: WidgetType[];
}

type Category = 'All' | 'CRM' | 'Email' | 'Metrics' | 'Productivity';

const WIDGETS: {
  type: WidgetType;
  config?: { metricKey?: MetricKey; group?: string };
  name: string;
  description: string;
  category: Category;
}[] = [
  { type: 'metric', name: 'Revenue Metrics', description: 'Revenue, pipeline, contacts and conversion.', category: 'CRM' },
  { type: 'metric', name: 'Email Volume', description: 'Sent and delivered email counts.', category: 'Email', config: { group: 'volume' } },
  { type: 'metric', name: 'Engagement', description: 'Opens, clicks and engagement rates.', category: 'Email', config: { group: 'engagement' } },
  { type: 'metric', name: 'Deliverability Risk', description: 'Bounces, complaints and unsubscribes.', category: 'Email', config: { group: 'risk' } },
  { type: 'revenue_chart', name: 'Revenue Chart', description: 'Area chart of revenue over time.', category: 'Metrics' },
  { type: 'pipeline_funnel', name: 'Pipeline Funnel', description: 'Visualize deals by pipeline stage.', category: 'CRM' },
  { type: 'schedule', name: 'Schedule', description: "Today's upcoming appointments and calls.", category: 'Productivity' },
  { type: 'tasks', name: 'Tasks', description: "Today's outstanding tasks with quick-complete.", category: 'Productivity' },
  { type: 'leaderboard', name: 'Leaderboard', description: 'Top performing workflows by run volume.', category: 'Productivity' },
];

const EMAIL_METRIC_GROUPS: Record<string, MetricKey[]> = {
  volume: ['email_sent', 'email_delivered'],
  engagement: ['email_unique_opens', 'email_total_opens', 'email_unique_clicks', 'email_total_clicks', 'email_open_rate', 'email_click_rate'],
  risk: ['email_hard_bounces', 'email_soft_bounces', 'email_complaints', 'email_unsubscribes'],
};

const CRM_METRICS: MetricKey[] = ['revenue', 'pipeline', 'contacts', 'conversion'];

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
          {(['All', 'CRM', 'Email', 'Metrics', 'Productivity'] as Category[]).map((cat) => (
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
        {filtered.map((w, index) => {
          const metrics = w.config?.group ? EMAIL_METRIC_GROUPS[w.config.group] : w.type === 'metric' ? CRM_METRICS : undefined;
          if (metrics) {
            return (
              <div
                key={`${w.type}-${index}`}
                className="card-surface border border-border rounded-xl p-4 shadow-[var(--shadow-card)]"
              >
                <div className="text-sm font-semibold text-text-main">{w.name}</div>
                <div className="text-xs text-text-muted mt-0.5 mb-3 leading-relaxed">{w.description}</div>
                <div className="grid grid-cols-2 gap-2">
                  {metrics.map((metricKey) => (
                    <button
                      key={metricKey}
                      type="button"
                      onClick={() => onAdd('metric', { metricKey })}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-[12px] text-text-muted transition-colors hover:border-primary hover:text-text-main"
                    >
                      Add {metricKey.replace(/^(email_)/, '').replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
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
