import { useState } from 'react';
import {
  Briefcase, BarChart3, Calendar, CheckSquare, Zap, Activity,
  Mail, Target, Plus, Check, TrendingUp, Layers
} from 'lucide-react';
import type { MetricKey, WidgetType } from '../../types/dashboard';
import { SlidePanel } from '../ui/SlidePanel';

interface AddWidgetModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: WidgetType, config?: { metricKey?: MetricKey; label?: string }) => void;
  existingTypes: WidgetType[];
}

type Category = 'All' | 'CRM & Pipeline' | 'Productivity' | 'Analytics & Health';

interface WidgetDef {
  type: WidgetType;
  name: string;
  description: string;
  category: Category;
  icon: React.ElementType;
  config?: { metricKey?: MetricKey };
  previewTag?: string;
}

const CRM_WIDGETS: WidgetDef[] = [
  {
    type: 'pipeline_funnel',
    name: 'Pipeline Stage Funnel',
    description: 'Track deals through Lead, Qualified, Proposal, and Won stages.',
    category: 'CRM & Pipeline',
    icon: Target,
    previewTag: 'Live CRM Pipeline',
  },
  {
    type: 'revenue_chart',
    name: 'Revenue Performance Chart',
    description: 'Visual area graph of closed-won deal revenue and growth over time.',
    category: 'CRM & Pipeline',
    icon: TrendingUp,
    previewTag: 'Financial Trends',
  },
  {
    type: 'schedule',
    name: 'Upcoming Appointments',
    description: "Real-time calendar view of scheduled meetings, calls, and slots.",
    category: 'Productivity',
    icon: Calendar,
    previewTag: 'Live Calendar',
  },
  {
    type: 'tasks',
    name: 'CRM Action Items & Tasks',
    description: 'Active to-dos and follow-up reminders with quick-complete buttons.',
    category: 'Productivity',
    icon: CheckSquare,
    previewTag: 'Task Manager',
  },
  {
    type: 'leaderboard',
    name: 'Agent Automation Performance',
    description: 'Workflow execution counts, run times, and success rates.',
    category: 'Analytics & Health',
    icon: Zap,
    previewTag: 'AI & Automations',
  },
  {
    type: 'activity_feed',
    name: 'Real-Time Activity Stream',
    description: 'Audit log of recent CRM updates, deal movements, and messages.',
    category: 'Productivity',
    icon: Activity,
    previewTag: 'Telemetry Stream',
  },
  {
    type: 'campaign_health',
    name: 'Email Deliverability & Health',
    description: 'Inbox open rates, click tracking, and deliverability metrics.',
    category: 'Analytics & Health',
    icon: Mail,
    previewTag: 'Outreach Health',
  },
  {
    type: 'conversion',
    name: 'Conversion Velocity',
    description: 'Stage-by-stage win rates and conversion cycle times.',
    category: 'Analytics & Health',
    icon: BarChart3,
    previewTag: 'Stage Analytics',
  },
  {
    type: 'quick_actions',
    name: 'Quick Action Shortcuts',
    description: 'One-click shortcuts to create deals, add contacts, or compose.',
    category: 'Productivity',
    icon: Layers,
    previewTag: 'Productivity Bar',
  },
];

export function AddWidgetModal({ open, onClose, onAdd, existingTypes }: AddWidgetModalProps) {
  const [category, setCategory] = useState<Category>('All');

  const filtered = category === 'All'
    ? CRM_WIDGETS
    : CRM_WIDGETS.filter((w) => w.category === category);

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Add CRM Widget"
      subtitle="Select real-time CRM telemetry and productivity widgets to monitor your workspace"
      width="lg"
    >
      {/* Category Pills Header */}
      <div className="px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Categories</span>
        <div className="flex items-center gap-1.5 text-[12px] flex-wrap">
          {(['All', 'CRM & Pipeline', 'Productivity', 'Analytics & Health'] as Category[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-lg border text-[12px] font-semibold transition-all ${
                category === cat
                  ? 'bg-primary border-primary text-white shadow-xs'
                  : 'bg-surface border-border/60 text-text-muted hover:text-text-main hover:border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Widget Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((w) => {
          const isAdded = existingTypes.includes(w.type);
          const Icon = w.icon;

          return (
            <div
              key={w.type}
              className="group rounded-xl border border-border/70 bg-surface/60 hover:bg-surface/90 hover:border-primary/40 p-5 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  {w.previewTag && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-muted">
                      {w.previewTag}
                    </span>
                  )}
                </div>

                <h4 className="text-[14px] font-bold text-text-main mb-1 group-hover:text-primary transition-colors">
                  {w.name}
                </h4>
                <p className="text-[12px] text-text-muted leading-relaxed mb-4">
                  {w.description}
                </p>
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] text-text-muted font-medium">
                  {w.category}
                </span>

                <button
                  type="button"
                  disabled={isAdded}
                  onClick={() => onAdd(w.type, w.config)}
                  className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all ${
                    isAdded
                      ? 'bg-surface border border-border text-text-muted cursor-not-allowed opacity-60'
                      : 'bg-primary text-white hover:bg-primary-hover shadow-xs active:scale-95'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Added
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Add Widget
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </SlidePanel>
  );
}
