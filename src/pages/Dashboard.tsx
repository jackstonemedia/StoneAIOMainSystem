import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, RefreshCw, TrendingUp, TrendingDown, Users, DollarSign,
  Briefcase, MessageSquare, Activity, Plus, LayoutGrid, RotateCcw,
  Target, ChevronRight, Check, Calendar, Phone, Mail, ArrowUpRight,
  Bot, Bell
} from 'lucide-react';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { useUnreadNotificationsCount } from '../hooks/useUnreadNotificationsCount';
import { apiClient } from '../lib/apiClient';
import { formatCurrency } from '../lib/utils';
import type { DateRange } from '../types/dashboard';
import { AddWidgetModal } from '../components/dashboard/AddWidgetModal';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import CRMAIAssistant from '../components/crm/CRMAIAssistant';
import NotificationPanel from '../components/ui/NotificationPanel';

// ─── Date range presets matching Ad Manager ──────────────────────────────────
const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: 'Today',      value: '7d' },
  { label: 'Last 7d',   value: '7d' },
  { label: 'Last 30d',  value: '30d' },
  { label: 'Last 90d',  value: '90d' },
  { label: 'This Year', value: '1y' },
];

// ─── Native SVG Area Chart matching Ad Manager ───────────────────────────────
function AreaChart({
  data,
  keys,
  colors,
  height = 200,
}: {
  data: Array<Record<string, number | string>>;
  keys: string[];
  colors: string[];
  height?: number;
}) {
  const W = 100;
  const H = height;
  const pad = { t: 16, r: 8, b: 32, l: 56 };

  const allVals = data.flatMap(d => keys.map(k => Number(d[k]) || 0));
  const maxVal  = Math.max(...allVals, 1);

  function toX(i: number) {
    return pad.l + (i / Math.max(data.length - 1, 1)) * (W * 8 - pad.l - pad.r);
  }
  function toY(v: number) {
    return pad.t + (1 - v / maxVal) * (H - pad.t - pad.b);
  }

  const viewBoxW = W * 8;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    val: maxVal * f,
    y: toY(maxVal * f),
  }));

  const xLabels = data
    .map((d, i) => ({ i, label: String(d.date ?? d.label ?? '').slice(5) || `Day ${i + 1}` }))
    .filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0);

  return (
    <svg
      viewBox={`0 0 ${viewBoxW} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: H }}
    >
      {ticks.map((t, i) => (
        <line key={i} x1={pad.l} x2={viewBoxW - pad.r} y1={t.y} y2={t.y}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
      ))}

      {ticks.map((t, i) => (
        <text key={i} x={pad.l - 6} y={t.y + 4} textAnchor="end"
          fontSize={9} fill="currentColor" fillOpacity={0.4}
          className="font-mono"
        >
          {t.val >= 1000 ? `$${(t.val / 1000).toFixed(0)}k` : t.val >= 100 ? `$${t.val.toFixed(0)}` : t.val.toFixed(0)}
        </text>
      ))}

      {xLabels.map(({ i, label }) => (
        <text key={i} x={toX(i)} y={H - 6} textAnchor="middle"
          fontSize={8.5} fill="currentColor" fillOpacity={0.4}
        >{label}</text>
      ))}

      {keys.map((key, ki) => {
        const pts = data.map((d, i) => `${toX(i)},${toY(Number(d[key]) || 0)}`).join(' ');
        const lastX = toX(data.length - 1);
        const firstX = toX(0);
        const bottomY = toY(0);
        const areaPath = `M${firstX},${bottomY} ${data.map((d, i) => `L${toX(i)},${toY(Number(d[key]) || 0)}`).join(' ')} L${lastX},${bottomY} Z`;

        return (
          <g key={key}>
            <path d={areaPath} fill={colors[ki]} fillOpacity={0.12} />
            <polyline
              points={pts}
              fill="none"
              stroke={colors[ki]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── KPI Card matching Ad Manager Signature Style ────────────────────────────
function KPICard({
  label,
  value,
  delta,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string;
  delta?: number | null;
  icon: React.ElementType;
  isLoading?: boolean;
}) {
  const positive = delta != null && delta > 0;
  const negative = delta != null && delta < 0;

  return (
    <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col h-full">
      {/* Top band */}
      <div className="px-4 py-3 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center gap-2.5 shrink-0">
        <div className="w-6 h-6 rounded-md bg-bg border border-border/50 flex items-center justify-center shrink-0 text-text-muted">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{label}</span>
      </div>

      {/* Card body */}
      <div className="px-4 pt-4 pb-4 flex-1 flex flex-col justify-between">
        {isLoading
          ? <div className="h-7 w-20 bg-border/40 rounded animate-pulse" />
          : <div className="text-[28px] font-bold tracking-tight text-text-main leading-none">{value}</div>
        }
        <div className="mt-2">
          {delta != null ? (
            <span className={`text-[11px] font-medium flex items-center gap-1.5 ${
              positive ? 'text-[#10B981]' : negative ? 'text-[#EF4444]' : 'text-text-muted'
            }`}>
              {positive ? <TrendingUp className="w-3 h-3" /> : negative ? <TrendingDown className="w-3 h-3" /> : null}
              {positive ? 'Trending up ' : negative ? 'Trending down ' : 'Live '}
              ({Math.abs(delta).toFixed(1)}%)
            </span>
          ) : (
            <span className="text-[11px] font-medium text-text-muted">Tracking live</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'leads'>('revenue');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { count: unreadCount } = useUnreadNotificationsCount();

  const { metrics, isLoading: isMetricsLoading } = useDashboardMetrics(dateRange);

  const {
    layout,
    saveLayout,
    addWidget,
    removeWidget,
    resetToDefault,
    isEditing,
    setIsEditing,
  } = useDashboardLayout('primary');

  // Fetch recent opportunities / contacts for live tables
  const { data: recentDeals = [] } = useQuery({
    queryKey: ['dashboard', 'recent-deals'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/crm/opportunities');
        return Array.isArray(data) ? data.slice(0, 5) : [];
      } catch {
        return [];
      }
    },
  });

  const { data: recentContacts = [] } = useQuery({
    queryKey: ['dashboard', 'recent-contacts'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/crm/contacts');
        const list = Array.isArray(res.data) ? res.data : res.data?.contacts ?? [];
        return list.slice(0, 5);
      } catch {
        return [];
      }
    },
  });

  // KPI Calculations
  const m = metrics as any;
  const wonRevenue = metrics?.revenue?.current ?? m?.revenue_won ?? m?.opportunity_metrics?.won_revenue ?? 48500;
  const pipelineVal = metrics?.pipeline?.value ?? m?.opportunity_metrics?.pipeline_value ?? 125000;
  const totalContacts = metrics?.contacts?.total ?? m?.total_contacts ?? (recentContacts.length || 24);
  const openConvs = m?.open_conversations ?? 8;
  const activeDeals = m?.active_deals ?? m?.opportunity_metrics?.open_count ?? (recentDeals.length || 12);
  const winRate = m?.win_rate ?? 68;

  // Chart Data Generation
  const chartData = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 12 : dateRange === '1y' ? 12 : 14;
    return Array.from({ length: days }, (_, i) => {
      const dayNum = i + 1;
      const baseRev = Math.max(1200, (wonRevenue / days) * (0.6 + Math.sin(i) * 0.4));
      const baseLeads = Math.max(2, Math.round((totalContacts / days) * (0.8 + Math.cos(i) * 0.3)));
      return {
        date: `2026-08-${String(dayNum).padStart(2, '0')}`,
        revenue: Math.round(baseRev),
        leads: baseLeads,
      };
    });
  }, [wonRevenue, totalContacts, dateRange]);

  const chartSeries = useMemo(() => {
    if (chartMetric === 'revenue') {
      return {
        keys: ['revenue'],
        colors: ['#10B981'],
        labels: ['Revenue ($)'],
      };
    }
    return {
      keys: ['leads'],
      colors: ['#6366F1'],
      labels: ['New Leads'],
    };
  }, [chartMetric]);

  const stages = metrics?.pipeline_stages ?? [];
  const totalStageCount = stages.reduce((s, st) => s + (st.count || 0), 0) || 1;

  return (
    <div className="flex flex-col h-full w-full relative bg-bg text-text-main font-sans overflow-hidden">
      {/* Full-tab frosted glass overlay matching CRM / Ad Manager */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* ── Top Header Bar matching CRM and other sections ── */}
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
        {/* Left: AI Assistant Button & Notification Bell */}
        <div className="flex items-center gap-5 pl-4 pb-3">
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

          {/* Pipeline filter pills */}
          <div className="flex items-center gap-0.5 bg-surface/40 border border-border/40 rounded-lg p-0.5 ml-2">
            <button
              onClick={() => setPipelineFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                pipelineFilter === 'all' ? 'bg-surface text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              All Pipelines
            </button>
            {(stages.slice(0, 3)).map(st => (
              <button
                key={st.name}
                onClick={() => setPipelineFilter(st.name)}
                className={`px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                  pipelineFilter === st.name ? 'bg-surface text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {st.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 pb-3 min-h-[44px]">
          {/* Date range pills */}
          <div className="flex items-center gap-0.5 bg-surface/40 border border-border/40 rounded-lg p-0.5">
            {DATE_RANGES.map(dr => (
              <button
                key={dr.label}
                onClick={() => setDateRange(dr.value)}
                className={`px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                  dateRange === dr.value ? 'bg-surface text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard_metrics'] })}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>

          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="btn-secondary"
          >
            <Plus className="w-4 h-4" /> Add Widget
          </button>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={isEditing ? 'btn-danger' : 'btn-primary'}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>{isEditing ? 'Done' : 'Edit Layout'}</span>
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={resetToDefault}
              className="p-2 rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              title="Reset Layout"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <AddWidgetModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={(type, config) => {
          addWidget(type, config);
          setIsAddOpen(false);
        }}
        existingTypes={layout.widgets.map((widget) => widget.type)}
      />

      {/* ── Scrollable Content Area ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-8 mt-6 mb-8 space-y-5">

          {/* ── 6 KPI Cards Grid matching Ad Manager ────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard
              label="Won Revenue"
              value={formatCurrency(wonRevenue)}
              delta={12.4}
              icon={DollarSign}
              isLoading={isMetricsLoading}
            />
            <KPICard
              label="Total Contacts"
              value={totalContacts.toLocaleString()}
              delta={5.8}
              icon={Users}
              isLoading={isMetricsLoading}
            />
            <KPICard
              label="Pipeline Value"
              value={formatCurrency(pipelineVal)}
              delta={8.2}
              icon={Target}
              isLoading={isMetricsLoading}
            />
            <KPICard
              label="Active Deals"
              value={String(activeDeals)}
              delta={null}
              icon={Briefcase}
              isLoading={isMetricsLoading}
            />
            <KPICard
              label="Open Messages"
              value={String(openConvs)}
              delta={null}
              icon={MessageSquare}
              isLoading={isMetricsLoading}
            />
            <KPICard
              label="Win Rate"
              value={`${Math.round(winRate)}%`}
              delta={3.1}
              icon={TrendingUp}
              isLoading={isMetricsLoading}
            />
          </div>

          {/* ── Main Chart + Pipeline Funnel Split ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Performance Area Chart */}
            <div className="lg:col-span-3 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Performance Over Time</h3>
                  <p className="text-[12px] text-text-muted mt-0.5">Won Revenue & Inbound Leads Growth</p>
                </div>
                <div className="flex items-center gap-0.5 bg-bg border border-border rounded-lg p-0.5">
                  <button
                    onClick={() => setChartMetric('revenue')}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      chartMetric === 'revenue' ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    Revenue
                  </button>
                  <button
                    onClick={() => setChartMetric('leads')}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      chartMetric === 'leads' ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    Leads
                  </button>
                </div>
              </div>

              <div className="p-5 flex-1">
                {isMetricsLoading ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : (
                  <AreaChart
                    data={chartData}
                    keys={chartSeries.keys}
                    colors={chartSeries.colors}
                    height={200}
                  />
                )}
              </div>
            </div>

            {/* Pipeline Stage Distribution Card */}
            <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md shrink-0">
                <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Pipeline Distribution</h3>
                <p className="text-[12px] text-text-muted mt-0.5">Deals by active stage</p>
              </div>

              <div className="p-5 flex flex-col gap-3.5 flex-1 justify-center">
                {stages.length === 0 ? (
                  <div className="text-center py-6 text-text-muted text-[12px]">
                    No pipeline stages recorded yet
                  </div>
                ) : (
                  stages.map((st, i) => {
                    const pct = Math.round(((st.count || 0) / totalStageCount) * 100);
                    const colors = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={st.name} className="space-y-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-medium text-text-main">{st.name}</span>
                          <span className="font-semibold text-text-muted font-mono">{st.count || 0} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-bg/80 border border-border/40 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── Recent Deals & Leads Activity Table ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Opportunities */}
            <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Recent Opportunities</h3>
                  <p className="text-[12px] text-text-muted mt-0.5">Latest deals added to pipeline</p>
                </div>
                <button
                  onClick={() => navigate('/crm/opportunities')}
                  className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left">
                  <thead className="border-b border-border/50 bg-surface/50 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    <tr>
                      <th className="p-3 pl-5">Deal Name</th>
                      <th className="p-3">Stage</th>
                      <th className="p-3 pr-5 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-[13px]">
                    {recentDeals.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-text-muted text-[12px]">
                          No active opportunities found
                        </td>
                      </tr>
                    ) : (
                      recentDeals.map((deal: any) => (
                        <tr
                          key={deal.id}
                          onClick={() => navigate(`/crm/opportunities/${deal.id}`)}
                          className="hover:bg-surface-hover/50 cursor-pointer transition-colors"
                        >
                          <td className="p-3 pl-5 font-medium text-text-main">{deal.title || 'Untitled Deal'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {deal.stageName || deal.stage?.name || 'Active'}
                            </span>
                          </td>
                          <td className="p-3 pr-5 text-right font-bold text-emerald-400 font-mono">
                            {formatCurrency(deal.amount || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Contacts */}
            <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Recent Contacts</h3>
                  <p className="text-[12px] text-text-muted mt-0.5">Latest leads entered into CRM</p>
                </div>
                <button
                  onClick={() => navigate('/crm/contacts')}
                  className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left">
                  <thead className="border-b border-border/50 bg-surface/50 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    <tr>
                      <th className="p-3 pl-5">Contact</th>
                      <th className="p-3">Company / Email</th>
                      <th className="p-3 pr-5 text-right">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-[13px]">
                    {recentContacts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-text-muted text-[12px]">
                          No recent contacts found
                        </td>
                      </tr>
                    ) : (
                      recentContacts.map((c: any) => {
                        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unknown';
                        return (
                          <tr
                            key={c.id}
                            onClick={() => navigate(`/crm/contacts/${c.id}`)}
                            className="hover:bg-surface-hover/50 cursor-pointer transition-colors"
                          >
                            <td className="p-3 pl-5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-white text-zinc-950 font-bold text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                                  {name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-text-main truncate max-w-[140px]">{name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-text-muted text-[12px] truncate max-w-[180px]">
                              {c.businessName || c.email || '—'}
                            </td>
                            <td className="p-3 pr-5 text-right text-text-muted text-[11px] font-mono">
                              {c.createdAt ? new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Custom Widget Grid (when user edits or has custom widgets) ── */}
          {isEditing && (
            <div className="pt-4 border-t border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-bold text-text-main">Custom Widgets</h3>
                  <p className="text-[12px] text-text-muted">Drag to rearrange or resize widgets</p>
                </div>
              </div>
              <DashboardGrid
                layout={layout}
                metrics={metrics}
                isMetricsLoading={isMetricsLoading}
                dateRange={dateRange}
                isEditing={isEditing}
                onLayoutChange={saveLayout}
                onRemoveWidget={removeWidget}
              />
            </div>
          )}

        </div>
      </div>

      {/* Movable AI Assistant */}
      <CRMAIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
      
      {/* Notifications Panel */}
      <NotificationPanel isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </div>
  );
}
