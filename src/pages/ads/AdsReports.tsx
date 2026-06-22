import { useState } from 'react';
import { Download, BarChart3, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';

const REPORT_TYPES = [
  {
    id: 'performance',
    name: 'Campaign Performance',
    description: 'Spend, impressions, clicks, CTR, and conversions across all campaigns.',
    icon: BarChart3,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    id: 'leads',
    name: 'Lead Generation',
    description: 'Lead volume, cost per lead, and CRM sync status breakdown.',
    icon: Users,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
  {
    id: 'spend',
    name: 'Spend Summary',
    description: 'Budget utilization, platform spend split, and daily pacing.',
    icon: DollarSign,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    id: 'trends',
    name: 'Trend Analysis',
    description: 'Week-over-week and month-over-month performance trends.',
    icon: TrendingUp,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
];

const DATE_PRESETS = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This month', 'Last month', 'Custom range'];

export default function AdsReports() {
  const [selectedReport, setSelectedReport] = useState('performance');
  const [datePreset, setDatePreset] = useState('Last 30 days');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-text-main">Reports</h2>
          <p className="text-[12px] text-text-muted mt-0.5">Export and analyze campaign performance data</p>
        </div>
        <button
          className="flex items-center gap-2 h-9 px-4 bg-primary text-white rounded-lg text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[12px] text-text-muted font-medium">
          <Calendar className="w-4 h-4" /> Date range:
        </div>
        <div className="flex items-center gap-0.5 bg-background border border-border rounded-lg p-0.5">
          {DATE_PRESETS.slice(0, 4).map(p => (
            <button
              key={p}
              onClick={() => setDatePreset(p)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                datePreset === p ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon;
          return (
            <button
              key={rt.id}
              onClick={() => setSelectedReport(rt.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedReport === rt.id
                  ? 'border-primary bg-primary/8'
                  : 'border-border bg-surface hover:border-border hover:bg-surface-hover'
              }`}
            >
              <div className={`p-2 rounded-lg w-fit mb-3 ${rt.bg} ${rt.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-[13px] font-bold text-text-main mb-1">{rt.name}</p>
              <p className="text-[11px] text-text-muted leading-relaxed">{rt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Coming soon state */}
      <div className="rounded-xl border border-border bg-surface flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-full bg-primary/10 mb-4">
          <BarChart3 className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-[16px] font-bold text-text-main mb-2">Reports coming soon</h3>
        <p className="text-[13px] text-text-muted max-w-sm">
          Advanced reporting with custom date ranges, platform breakdowns, and CSV exports is in active development.
        </p>
        <p className="text-[12px] text-text-muted mt-3">
          In the meantime, view performance on the{' '}
          <a href="/ads/overview" className="text-primary hover:underline underline-offset-2">Overview dashboard</a>.
        </p>
      </div>
    </div>
  );
}
