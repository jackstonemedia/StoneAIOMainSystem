import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Users, DollarSign, MessageSquare, Mail, FileText, Calendar,
  Star, TrendingUp, TrendingDown, ArrowUpRight, BarChart3,
  Activity, Target, Download, RefreshCw, CheckCircle2
} from 'lucide-react';

const RANGES = [
  { label: '7d',   days: 7 },
  { label: '30d',  days: 30 },
  { label: '90d',  days: 90 },
  { label: '1yr',  days: 365 },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

function BarChart({ data, color = 'var(--primary)' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            style={{ height: `${(d.value / max) * 100}%`, background: color, originY: 1 }}
            className="w-full rounded-t-[3px] min-h-[4px]"
          />
          <span className="text-[9px] text-text-muted leading-none">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function AreaSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const w = 200, h = 40;
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - (v / max) * (h - 4) }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `M0,${h} L${pts.map(p => `${p.x},${p.y}`).join(' L')} L${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`ag-${color.replace(/[^a-z]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#ag-${color.replace(/[^a-z]/gi, '')})`} />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  color: string;
  bg: string;
  trend?: 'up' | 'down' | null;
  trendPct?: string;
  delay?: number;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon: Icon, color, bg, trend, trendPct, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-surface border border-border rounded-[12px] p-5 hover:shadow-md hover:border-border/80 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center ${bg}`}>
          <Icon className={`w-4.5 h-4.5 ${color}`} />
        </div>
        {trend && trendPct && (
          <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendPct}
          </div>
        )}
      </div>
      <div className="text-[22px] font-bold text-text-main tracking-tight">{value}</div>
      <div className="text-[12px] text-text-muted mt-1">{label}</div>
      {sub && <div className="text-[11px] text-text-muted/60 mt-0.5">{sub}</div>}
    </motion.div>
  );
}

const STAGE_COLORS: Record<string, string> = {
  Lead: '#64748b', Qualified: '#818cf8', Proposal: '#fbbf24', Negotiation: '#a78bfa', Won: '#34d399', Lost: '#ef4444',
};

export default function Analytics() {
  const [range, setRange] = useState(30);

  const { data: overview, isLoading, refetch } = useQuery<any>({
    queryKey: ['analytics', 'overview', range],
    queryFn: () => fetch(`/api/analytics/overview?days=${range}`).then(r => r.ok ? r.json() : null),
    staleTime: 60000,
  });

  const handleExport = () => {
    if (!overview) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Contacts', overview.contacts?.total],
      ['New Contacts', overview.contacts?.newThisPeriod],
      ['Total Deals', overview.deals?.total],
      ['Won Deals', overview.deals?.won],
      ['Won Revenue', overview.deals?.wonValue],
      ['Open Conversations', overview.conversations?.open],
      ['Form Submissions', overview.forms?.submissions],
      ['Avg Rating', overview.reviews?.avgRating],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `analytics-${range}d.csv`; a.click();
  };

  const kpis = overview ? [
    { label: 'Total Contacts', value: (overview.contacts?.total || 0).toLocaleString(), sub: `+${overview.contacts?.newThisPeriod || 0} this period`, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10', trend: 'up' as const, trendPct: '+5.2%', delay: 0 },
    { label: 'Revenue (Won Deals)', value: fmt(overview.deals?.wonValue || 0), sub: `${overview.deals?.won || 0} deals closed`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-400/10', trend: 'up' as const, trendPct: '+12.4%', delay: 0.05 },
    { label: 'Pipeline Value', value: fmt(overview.deals?.totalValue || 0), sub: `${overview.deals?.total || 0} active deals`, icon: Target, color: 'text-primary', bg: 'bg-primary/10', trend: null, delay: 0.1 },
    { label: 'Open Conversations', value: overview.conversations?.open || 0, sub: 'Active threads', icon: MessageSquare, color: 'text-violet-400', bg: 'bg-violet-400/10', trend: null, delay: 0.15 },
    { label: 'Form Submissions', value: overview.forms?.submissions || 0, sub: `${overview.forms?.total || 0} active forms`, icon: FileText, color: 'text-amber-400', bg: 'bg-amber-400/10', trend: null, delay: 0.2 },
    { label: 'Appointments', value: overview.appointments?.total || 0, sub: `${overview.appointments?.completed || 0} completed`, icon: Calendar, color: 'text-cyan-400', bg: 'bg-cyan-400/10', trend: null, delay: 0.25 },
    { label: 'Avg Review Rating', value: overview.reviews?.avgRating ? `${overview.reviews.avgRating}★` : '—', sub: `${overview.reviews?.total || 0} reviews`, icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10', trend: null, delay: 0.3 },
    { label: 'Campaigns', value: overview.campaigns?.total || 0, sub: 'Total campaigns', icon: Mail, color: 'text-indigo-400', bg: 'bg-indigo-400/10', trend: null, delay: 0.35 },
  ] : [];

  const monthlyData = (overview?.monthlyRevenue || []).map((m: any) => ({ label: m.month, value: m.won || 0 }));
  const stageData = (overview?.deals?.byStage || []).filter((s: any) => s.count > 0);
  const totalStageDeals = stageData.reduce((s: number, d: any) => s + d.count, 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      {/* Header */}
      <div className="px-8 border-b border-border bg-surface flex items-center justify-between shrink-0 h-[68px]">
        <div>
          <h1 className="text-[20px] font-bold text-text-main">Analytics</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Real-time performance across all modules</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Range selector */}
          <div className="flex gap-0.5 bg-bg border border-border rounded-[8px] p-1">
            {RANGES.map(r => (
              <button key={r.days} onClick={() => setRange(r.days)}
                className={`px-3 py-1 text-[12px] font-semibold rounded-[5px] transition-all ${range === r.days ? 'bg-surface text-primary border border-border shadow-sm' : 'text-text-muted hover:text-text-main'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-border text-text-muted hover:text-text-main hover:border-primary/40 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-border rounded-[8px] text-[13px] font-semibold text-text-muted hover:text-text-main hover:border-primary/40 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-[12px] p-5 h-[120px] animate-pulse">
                <div className="w-9 h-9 bg-surface-hover rounded-[8px] mb-3" />
                <div className="h-6 bg-surface-hover rounded w-1/2 mb-2" />
                <div className="h-3 bg-surface-hover rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((kpi, i) => <KpiCard key={i} {...kpi} />)}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-3 gap-6">
              {/* Monthly Revenue */}
              <div className="col-span-2 bg-surface border border-border rounded-[12px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[14px] font-bold text-text-main">Revenue by Month</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">Won deals — past 6 months</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {overview?.deals?.wonValue ? fmt(overview.deals.wonValue) : '$0'}
                  </div>
                </div>
                {monthlyData.length > 0 ? (
                  <BarChart data={monthlyData} color="var(--primary)" />
                ) : (
                  <div className="h-28 flex items-center justify-center">
                    <p className="text-[12px] text-text-muted">No revenue data for this period</p>
                  </div>
                )}
              </div>

              {/* Pipeline Funnel */}
              <div className="bg-surface border border-border rounded-[12px] p-5">
                <h3 className="text-[14px] font-bold text-text-main mb-1">Pipeline Stages</h3>
                <p className="text-[11px] text-text-muted mb-4">{totalStageDeals} total deals</p>
                {stageData.length > 0 ? (
                  <div className="space-y-3">
                    {stageData.map((stage: any, i: number) => {
                      const pct = Math.round((stage.count / Math.max(totalStageDeals, 1)) * 100);
                      const color = STAGE_COLORS[stage.name] || 'var(--primary)';
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-medium text-text-main">{stage.name}</span>
                            <span className="text-[11px] text-text-muted">{stage.count}</span>
                          </div>
                          <div className="h-1.5 bg-border/50 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.08 }}
                              className="h-full rounded-full" style={{ backgroundColor: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-28">
                    <p className="text-[12px] text-text-muted">No active pipeline data</p>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics table */}
            <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-surface-hover/20 flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-text-main">Module Summary</h3>
                <span className="text-[11px] text-text-muted">Last {range} days</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Module', 'Key Metric', 'Value', 'Status'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {[
                    { module: 'CRM Contacts', metric: 'Total Contacts', value: (overview?.contacts?.total || 0).toLocaleString(), status: 'active' },
                    { module: 'Opportunities', metric: 'Pipeline Value', value: fmt(overview?.deals?.totalValue || 0), status: 'active' },
                    { module: 'Conversations', metric: 'Open Threads', value: overview?.conversations?.open || 0, status: overview?.conversations?.open > 10 ? 'attention' : 'active' },
                    { module: 'Campaigns',     metric: 'Total Campaigns', value: overview?.campaigns?.total || 0, status: 'active' },
                    { module: 'Forms',         metric: 'Submissions', value: overview?.forms?.submissions || 0, status: 'active' },
                    { module: 'Reputation',    metric: 'Avg Rating', value: overview?.reviews?.avgRating ? `${overview.reviews.avgRating} / 5.0` : '—', status: (overview?.reviews?.avgRating || 0) >= 4 ? 'good' : 'attention' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="px-6 py-3.5 text-[13px] font-semibold text-text-main">{row.module}</td>
                      <td className="px-6 py-3.5 text-[13px] text-text-muted">{row.metric}</td>
                      <td className="px-6 py-3.5 text-[13px] font-bold text-text-main">{row.value}</td>
                      <td className="px-6 py-3.5">
                        <span className={`flex items-center gap-1 w-fit text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          row.status === 'good' ? 'text-emerald-400 bg-emerald-400/10' :
                          row.status === 'attention' ? 'text-amber-400 bg-amber-400/10' :
                          'text-primary bg-primary/10'
                        }`}>
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {row.status === 'good' ? 'Good' : row.status === 'attention' ? 'Needs Attention' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
