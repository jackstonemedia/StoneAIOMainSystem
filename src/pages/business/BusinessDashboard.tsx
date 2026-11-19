import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  TrendingUp, Users, Mail, DollarSign, Calendar,
  BarChart3, Plus, MessageSquare, ChevronRight, Star, AlertTriangle
} from 'lucide-react';
import { MetricCard } from '../../components/ui/MetricCard';
import { FEATURES } from '../../config/features';
import { useDashboardMetrics } from '../../hooks/useDashboardMetrics';
import type { DateRange } from '../../types/dashboard';

// Every number on this page comes from GET /business/metrics (real data).
// There are no hardcoded fallbacks: an empty workspace shows zeros and
// empty states, never invented revenue, contacts, or activity.

const PERIODS: Array<{ id: '7d' | '30d' | '90d' | '1y'; label: string }> = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: '1y', label: '1y' },
];

const PERIOD_LABEL: Record<'7d' | '30d' | '90d' | '1y', string> = {
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  '1y': 'last 12 months',
};

const REVENUE_LABEL: Record<'7d' | '30d' | '90d' | '1y', string> = {
  '7d': 'Revenue · 7 days',
  '30d': 'Monthly Revenue',
  '90d': 'Revenue · 90 days',
  '1y': 'Revenue · 12 months',
};

const ACTIVITY_ICONS: Record<string, typeof Users> = {
  contact_created: Users,
  deal_won: DollarSign,
  appointment_booked: Calendar,
  campaign_sent: Mail,
  workflow_failed: AlertTriangle,
};

function changeProps(pct: number | null | undefined): { change?: string; trend: 'up' | 'down' | 'neutral' } {
  if (pct == null) return { trend: 'neutral' };
  return {
    change: `${pct >= 0 ? '+' : ''}${pct}%`,
    trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
}

function timeAgo(iso: string | Date): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function sampleLabels(dates: string[]): string[] {
  if (dates.length <= 6) return dates.map(shortDate);
  const step = (dates.length - 1) / 5;
  return Array.from({ length: 6 }, (_, i) => shortDate(dates[Math.round(i * step)]));
}

// Simple SVG area chart
function AreaChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const w = 300, h = 80;
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - ((v - min) / range) * h }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `M0,${h} L${pts.map(p => `${p.x},${p.y}`).join(' L')} L${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`ag-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#ag-${color})`} />
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DateRange>('30d');
  const { metrics, isLoading } = useDashboardMetrics(period);

  // useUser() throws when there is no <ClerkProvider /> — in dev auth bypass
  // the app mounts no provider, so fall back to null (greeting drops the name).
  let user: ReturnType<typeof useUser>['user'] | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    user = useUser().user;
  } catch {
    user = null;
  }
  const hour = new Date().getHours();
  const dayPart = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const greeting = user?.firstName ? `${dayPart}, ${user.firstName}` : dayPart;

  // Real numbers only — nullish checks so a real 0 renders as 0, never a fallback.
  const revenueCurrent = metrics?.revenue?.current ?? 0;
  const revenueChange = metrics?.revenue?.changePct ?? null;
  const revenueSeries = metrics?.crm?.revenueOverTime ?? [];
  const revenueValues = revenueSeries.map((b) => b.value);
  const revenueTotal = revenueValues.reduce((s, v) => s + v, 0);
  const pipelineValue = metrics?.pipeline?.value ?? 0;
  const contactsTotal = metrics?.contacts?.total ?? 0;
  const contactsChange = metrics?.contacts?.changePct ?? null;

  const pipeline = Array.isArray(metrics?.pipeline_stages) ? metrics.pipeline_stages : [];
  const totalPipelineCount = pipeline.reduce((s: number, p: any) => s + (p.count || 0), 0);

  const activity = Array.isArray(metrics?.activityFeed) ? metrics.activityFeed : [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todaysAppointments = (Array.isArray(metrics?.calendar?.upcomingAppointments)
    ? metrics.calendar.upcomingAppointments
    : []
  ).filter((a: any) => {
    const t = new Date(a.startTime).getTime();
    return t >= todayStart.getTime() && t <= todayEnd.getTime();
  });

  const quickActions = [
    { label: 'New Campaign', icon: Mail, path: '/email-marketing/campaigns', hex: '#52677D' },
    { label: 'Add Contact', icon: Users, path: '/crm/contacts', hex: '#52677D' },
    { label: 'Analytics', icon: BarChart3, path: '/business/analytics', hex: '#52677D' },
    { label: 'Send Message', icon: MessageSquare, path: '/conversations', hex: '#10B981' },
    ...(FEATURES.reputation
      ? [{ label: 'Reputation', icon: Star, path: '/business/reputation', hex: '#EF4444' }]
      : []),
  ];

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
          <div className="text-text-muted font-medium text-sm animate-pulse">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <div className="max-w-[1400px] mx-auto p-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-main tracking-tight">Business Overview</h1>
            <p className="text-sm text-text-muted mt-1.5">{greeting} — here&apos;s your business at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/email-marketing/campaigns')}
              className="btn-secondary text-sm py-2 px-4"
            >
              <Mail className="w-4 h-4" /> New Campaign
            </button>
            <button
              onClick={() => navigate('/crm/contacts')}
              className="btn-primary text-sm py-2 px-4"
            >
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
        </div>

        {/* Metric Cards — real values; a real 0 shows as 0, never an invented number */}
        <div className="grid grid-cols-3 gap-4 stagger-children">
          <MetricCard label={REVENUE_LABEL[period as '7d' | '30d' | '90d' | '1y']} value={`$${revenueCurrent.toLocaleString()}`} {...changeProps(revenueChange)} icon={DollarSign} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" sparkline={metrics?.revenue?.trend} delay={0} />
          <MetricCard label="Pipeline Value" value={`$${pipelineValue.toLocaleString()}`} icon={TrendingUp} iconColor="text-text-muted" iconBg="bg-primary/100/10" delay={60} />
          <MetricCard label="Active Contacts" value={contactsTotal.toLocaleString()} {...changeProps(contactsChange)} icon={Users} iconColor="text-text-muted" iconBg="bg-primary/100/10" sparkline={metrics?.contacts?.trend} delay={120} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-6">

          {/* Left 2/3 */}
          <div className="col-span-2 space-y-6">

            {/* Revenue chart — won deal value per bucket, from the real series */}
            <div className="card-surface p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-text-main">Revenue Trend</h2>
                  <p className="text-xs text-text-muted mt-0.5">Won deal value · {PERIOD_LABEL[period as '7d' | '30d' | '90d' | '1y']}</p>
                </div>
                <div className="flex bg-bg border border-border rounded-lg p-1">
                  {PERIODS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPeriod(p.id)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${period === p.id ? 'bg-surface text-primary border border-border shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-32">
                <AreaChart data={revenueValues.length ? revenueValues : [0]} color="var(--primary)" />
              </div>
              <div className="flex justify-between mt-2">
                {sampleLabels(revenueSeries.map((b) => b.date)).map((label) => (
                  <span key={label} className="text-[10px] text-text-muted">{label}</span>
                ))}
              </div>
              {revenueTotal === 0 && (
                <p className="text-xs text-text-muted mt-3">No won revenue in this period yet.</p>
              )}
            </div>

            {/* Pipeline Funnel — real stages, empty state when there are no deals */}
            <div className="card-surface p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-text-main">Sales Pipeline</h2>
                  <p className="text-xs text-text-muted mt-0.5">{totalPipelineCount} active deals</p>
                </div>
                <Link to="/crm/opportunities" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {pipeline.length === 0 ? (
                <p className="text-sm text-text-muted py-4">No deals yet — your pipeline will show up here once you add deals.</p>
              ) : (
                <div className="space-y-3">
                  {pipeline.map((stage: any, i: number) => {
                    const pct = Math.round(((stage.count || 0) / (totalPipelineCount || 1)) * 100);
                    return (
                      <div key={i} className="group cursor-pointer" onClick={() => navigate('/crm/opportunities')}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-text-main">{stage.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-text-muted">{stage.count} deals</span>
                            <span className="text-sm font-semibold text-text-main">${(stage.value / 1000).toFixed(0)}k</span>
                          </div>
                        </div>
                        <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 group-hover:opacity-90"
                            style={{ width: `${pct}%`, backgroundColor: stage.color, boxShadow: `0 0 8px ${stage.color}40` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Activity — real events from the backend, empty state when none */}
            <div className="card-surface overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="font-semibold text-text-main">Recent Activity</h2>
              </div>
              {activity.length === 0 ? (
                <p className="text-sm text-text-muted px-6 py-5">No activity yet — new leads, won deals, and appointments will show up here.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {activity.map((item: any) => {
                    const Icon = ACTIVITY_ICONS[item.type] || Users;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface-hover transition-colors group cursor-pointer"
                        onClick={() => navigate(item.link)}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: '#52677D18', color: '#52677D', border: '1px solid var(--border)' }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-main truncate">{item.title}</p>
                          <p className="text-xs text-text-muted truncate">{item.subtitle}</p>
                        </div>
                        <span className="text-xs text-text-muted shrink-0">{timeAgo(item.timestamp)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right 1/3 */}
          <div className="space-y-6">

            {/* Today's schedule — real upcoming appointments, today only */}
            <div className="card-surface overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-text-main flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" /> Today
                </h2>
                <Link to="/business/calendar" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Full calendar →</Link>
              </div>
              <div className="p-4 space-y-3">
                {todaysAppointments.length === 0 ? (
                  <p className="text-sm text-text-muted px-1 py-2">No appointments today.</p>
                ) : (
                  todaysAppointments.map((ev: any) => (
                    <div
                      key={ev.id}
                      className="flex items-start gap-3 p-3 rounded-xl transition-all"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                    >
                      <div className="w-1.5 h-12 rounded-full shrink-0 mt-0.5" style={{ background: '#52677D' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-main truncate">{ev.title}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {new Date(ev.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          {ev.contactName ? ` · ${ev.contactName}` : ''}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <button
                  onClick={() => navigate('/business/calendar')}
                  className="w-full py-2 border border-dashed border-border rounded-xl text-xs text-text-muted hover:border-primary/40 hover:text-primary transition-colors"
                >
                  + Add appointment
                </button>
              </div>
            </div>

            {/* Quick Actions — real routes only; Reputation only when the feature is on */}
            <div className="card-surface p-5">
              <h2 className="font-semibold text-text-main mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(a.path)}
                    className="flex flex-col items-center gap-2 p-3 text-center rounded-xl transition-all"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = a.hex)}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${a.hex}18`, color: a.hex }}
                    >
                      <a.icon className="w-4 h-4" strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
