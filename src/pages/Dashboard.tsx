import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, DollarSign, Target, MessageSquare, Calendar, Mail,
  Bot, Bell, RefreshCw, TrendingUp, TrendingDown, Clock,
  AlertTriangle, CheckCircle2, XCircle, Send, Eye, MousePointer,
  ChevronRight, Workflow, Activity, ArrowUpRight, ShieldAlert,
  Inbox, UserCheck, Flame
} from 'lucide-react';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useUnreadNotificationsCount } from '../hooks/useUnreadNotificationsCount';
import { formatCurrency } from '../lib/utils';
import type { DateRange } from '../types/dashboard';
import CRMAIAssistant from '../components/crm/CRMAIAssistant';
import NotificationPanel from '../components/ui/NotificationPanel';

// ─── Timeframe Presets ────────────────────────────────────────────────────────
const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: 'Today',     value: 'today' },
  { label: 'Last 7d',   value: '7d' },
  { label: 'Last 30d',  value: '30d' },
  { label: 'Last 90d',  value: '90d' },
  { label: 'This Year', value: '1y' },
];

type SectionTab = 'all' | 'crm' | 'conversations' | 'calendar' | 'email' | 'automations' | 'activity';

// ─── SVG Contacts Over Time Line Chart ───────────────────────────────────────
function ContactsChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-text-muted text-xs">
        No contacts recorded in this timeframe
      </div>
    );
  }

  const W = 600;
  const H = 160;
  const pad = { t: 16, r: 16, b: 28, l: 36 };

  const values = data.map((d) => d.count);
  const maxVal = Math.max(...values, 4);

  const toX = (i: number) => pad.l + (i / Math.max(data.length - 1, 1)) * (W - pad.l - pad.r);
  const toY = (v: number) => pad.t + (1 - v / maxVal) * (H - pad.t - pad.b);

  const points = data.map((d, i) => `${toX(i)},${toY(d.count)}`).join(' ');
  const areaPath = `M${toX(0)},${toY(0)} ${data.map((d, i) => `L${toX(i)},${toY(d.count)}`).join(' ')} L${toX(data.length - 1)},${toY(0)} Z`;

  // X-axis sample labels (show up to 6 labels)
  const step = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data
    .map((d, i) => ({ i, label: d.date.slice(5) }))
    .filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-44">
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((f, idx) => {
          const val = Math.round(maxVal * f);
          const y = toY(val);
          return (
            <g key={idx}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
              <text x={pad.l - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.4} className="font-mono">
                {val}
              </text>
            </g>
          );
        })}

        {/* X labels */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.4} className="font-mono">
            {label}
          </text>
        ))}

        {/* Shaded Area & Line */}
        <path d={areaPath} fill="#6366f1" fillOpacity={0.15} />
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points */}
        {data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(d.count)} r={d.count > 0 ? 3 : 1.5} fill="#6366f1" />
        ))}
      </svg>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({
  label,
  value,
  subvalue,
  delta,
  icon: Icon,
  onClick,
  isLoading,
}: {
  label: string;
  value: string;
  subvalue?: string;
  delta?: number | null;
  icon: React.ElementType;
  onClick?: () => void;
  isLoading?: boolean;
}) {
  const isPositive = delta != null && delta > 0;
  const isNegative = delta != null && delta < 0;

  return (
    <div
      onClick={onClick}
      className={`rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col justify-between p-4 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:bg-surface/50 hover:border-primary/40' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-bg border border-border/60 flex items-center justify-center text-text-muted">
          <Icon className="w-4 h-4" />
        </div>
        {delta != null ? (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : isNegative
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-surface text-text-muted border border-border/50'
            }`}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
            {isPositive ? `+${delta}%` : `${delta}%`}
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-text-muted bg-surface/40 px-2 py-0.5 rounded-full border border-border/40">
            Live
          </span>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{label}</p>
        {isLoading ? (
          <div className="h-7 w-24 bg-border/40 rounded animate-pulse my-1" />
        ) : (
          <p className="text-2xl font-bold tracking-tight text-text-main mt-1">{value}</p>
        )}
        {subvalue && <p className="text-[12px] text-text-muted mt-1 truncate">{subvalue}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [activeSection, setActiveSection] = useState<SectionTab>('all');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { count: unreadCount } = useUnreadNotificationsCount();

  const { metrics, isLoading, refetch } = useDashboardMetrics(dateRange);

  const headline = metrics?.headline;
  const crm = metrics?.crm;
  const conversations = metrics?.conversations;
  const calendar = metrics?.calendar;
  const emailMarketing = metrics?.emailMarketing;
  const automations = metrics?.automations;
  const activityFeed = metrics?.activityFeed || [];

  return (
    <div className="flex flex-col h-full w-full relative bg-bg text-text-main font-sans overflow-hidden">
      {/* Background glass overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* ── Top Header Bar ── */}
      <div
        className="w-full flex items-center justify-between px-6 py-3 shrink-0 border-b z-10 sticky top-0 shadow-sm"
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
        }}
      >
        {/* Left: AI Assistant & Notification Bell */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAIOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface/40 hover:bg-surface/70 border border-white/10 text-white transition-all text-xs font-medium shadow-xs"
            title="AI Assistant"
          >
            <Bot className="w-4 h-4 text-white" />
            <span>AI Assistant</span>
          </button>

          <div className="h-5 w-[1px] bg-border/60" />

          <button
            onClick={() => setIsNotifOpen(true)}
            className="p-1.5 rounded-lg hover:bg-surface/50 text-text-muted hover:text-white transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center bg-primary text-white border-2 border-[var(--sidebar-bg)]">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Center: Section Navigation Filter */}
        <div className="hidden md:flex items-center gap-1 bg-surface/30 border border-border/50 rounded-lg p-0.5">
          {[
            { id: 'all', label: 'Overview' },
            { id: 'crm', label: 'CRM & Pipeline' },
            { id: 'conversations', label: 'Conversations' },
            { id: 'calendar', label: 'Calendar' },
            { id: 'email', label: 'Email Marketing' },
            { id: 'automations', label: 'Automations' },
            { id: 'activity', label: 'Activity' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as SectionTab)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                activeSection === tab.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Timeframe Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-surface/40 border border-border/50 rounded-lg p-0.5">
            {DATE_RANGES.map((dr) => (
              <button
                key={dr.label}
                onClick={() => setDateRange(dr.value)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  dateRange === dr.value
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg border border-border/60 hover:bg-surface/60 text-text-muted hover:text-text-main transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Scrollable Dashboard Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

        {/* ═════════════════════════════════════════════════════════════════════
            1. TOP ROW: 5 HEADLINE NUMBERS (Change vs Previous Period)
        ═════════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Performance Headlines (vs Previous Period)
            </h2>
            <span className="text-[11px] text-text-muted">Direct verified telemetry</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* New contacts / leads */}
            <KPICard
              label="New Contacts / Leads"
              value={headline?.newContacts?.count != null ? headline.newContacts.count.toLocaleString() : '0'}
              subvalue={`${headline?.newContacts?.total?.toLocaleString() ?? 0} total leads in CRM`}
              delta={headline?.newContacts?.changePct}
              icon={Users}
              isLoading={isLoading}
              onClick={() => navigate('/crm/contacts')}
            />

            {/* Open opportunities */}
            <KPICard
              label="Open Opportunities"
              value={headline?.openOpportunities?.count != null ? `${headline.openOpportunities.count} deals` : '0 deals'}
              subvalue={formatCurrency(headline?.openOpportunities?.value || 0) + ' active pipeline'}
              delta={null}
              icon={Target}
              isLoading={isLoading}
              onClick={() => navigate('/crm/opportunities')}
            />

            {/* Won deals */}
            <KPICard
              label="Won Deals"
              value={formatCurrency(headline?.wonDeals?.value || 0)}
              subvalue={`${headline?.wonDeals?.count ?? 0} won this period (${formatCurrency(headline?.wonDeals?.allTimeValue || 0)} all-time)`}
              delta={headline?.wonDeals?.changePct}
              icon={DollarSign}
              isLoading={isLoading}
              onClick={() => navigate('/crm/opportunities')}
            />

            {/* Unread conversations */}
            <KPICard
              label="Unread Conversations"
              value={headline?.unreadConversations?.count != null ? `${headline.unreadConversations.count} unread` : '0 unread'}
              subvalue={`${headline?.unreadConversations?.openThreads ?? 0} open customer threads`}
              delta={null}
              icon={MessageSquare}
              isLoading={isLoading}
              onClick={() => navigate('/conversations')}
            />

            {/* Appointments booked */}
            <KPICard
              label="Appointments Booked"
              value={headline?.upcomingAppointments?.count != null ? `${headline.upcomingAppointments.count} upcoming` : '0 upcoming'}
              subvalue="Live schedule synced"
              delta={null}
              icon={Calendar}
              isLoading={isLoading}
              onClick={() => navigate('/calendar')}
            />
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            2. CRM / PIPELINE SECTION
        ═════════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'all' || activeSection === 'crm') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="text-[15px] font-semibold tracking-tight text-text-main">CRM & Pipeline</h2>
              </div>
              <button
                onClick={() => navigate('/crm/opportunities')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Go to Opportunities <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Pipeline by Stage (Funnel / Bar) */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-text-main">Pipeline by Stage</h3>
                    <span className="text-[11px] font-mono text-text-muted">
                      {crm?.pipelineStages?.reduce((acc, s) => acc + s.count, 0) || 0} Deals
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mb-4">Deal count and dollar value per pipeline stage</p>

                  <div className="space-y-3">
                    {(!crm?.pipelineStages || crm.pipelineStages.length === 0) ? (
                      <p className="text-xs text-text-muted py-6 text-center">No active pipeline stages found</p>
                    ) : (
                      crm.pipelineStages.map((stage) => {
                        const totalPipeline = crm.pipelineStages.reduce((sum, s) => sum + (s.value || 0), 0) || 1;
                        const pct = Math.min(100, Math.round(((stage.value || 0) / totalPipeline) * 100));
                        return (
                          <div key={stage.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-text-main flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                {stage.name} ({stage.count})
                              </span>
                              <span className="font-mono font-semibold text-text-muted">
                                {formatCurrency(stage.value)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-bg/80 border border-border/40 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(pct, stage.count > 0 ? 8 : 0)}%`, backgroundColor: stage.color }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Win Rate Card */}
                <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between bg-surface/40 p-3 rounded-lg">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Win Rate</span>
                    <p className="text-xs text-text-muted mt-0.5">
                      {crm?.wonDealsCount || 0} won ÷ {(crm?.wonDealsCount || 0) + (crm?.lostDealsCount || 0)} closed
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {crm?.winRate != null ? `${crm.winRate}%` : 'No closed deals yet'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lead Source Breakdown */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-main mb-1">Lead Source Breakdown</h3>
                  <p className="text-[11px] text-text-muted mb-4">Origins of new incoming contacts</p>

                  <div className="space-y-3">
                    {(!crm?.leadSources || crm.leadSources.length === 0) ? (
                      <p className="text-xs text-text-muted py-6 text-center">No lead sources recorded yet</p>
                    ) : (
                      crm.leadSources.map((src) => (
                        <div key={src.source} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-text-main capitalize">{src.source}</span>
                            <span className="font-mono text-text-muted">{src.count} ({src.percentage}%)</span>
                          </div>
                          <div className="h-1.5 bg-bg/80 border border-border/40 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${src.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-border/40 text-right">
                  <button
                    onClick={() => navigate('/crm/contacts')}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View all contacts <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stale Deals (Action Driver) */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-semibold text-text-main">Stale Deals (&gt;14 Days Idle)</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {crm?.staleDeals?.count ?? 0} at risk
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mb-4">
                    Open opportunities with no stage change in 14+ days
                  </p>

                  <div className="space-y-2">
                    {(!crm?.staleDeals?.topStale || crm.staleDeals.topStale.length === 0) ? (
                      <div className="p-6 text-center text-text-muted text-xs bg-surface/20 rounded-lg border border-border/30">
                        <UserCheck className="w-6 h-6 mx-auto mb-1 text-emerald-400 opacity-80" />
                        Zero stale deals! All opportunities are moving actively.
                      </div>
                    ) : (
                      crm.staleDeals.topStale.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => navigate(`/crm/opportunities/${deal.id}`)}
                          className="p-2.5 rounded-lg bg-surface/40 hover:bg-surface/70 border border-border/40 cursor-pointer transition-all flex items-center justify-between"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-semibold text-text-main truncate">{deal.name}</p>
                            <p className="text-[11px] text-text-muted truncate">
                              {deal.contactName ? `${deal.contactName} • ` : ''}{deal.stage}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-bold text-amber-400">
                              {formatCurrency(deal.amount || 0)}
                            </span>
                            <p className="text-[10px] font-mono text-text-muted">{deal.daysStale}d idle</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-text-muted">
                  <span>Total value idle:</span>
                  <span className="font-bold font-mono text-text-main">
                    {formatCurrency(crm?.staleDeals?.value || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* New Contacts Over Time Line Chart */}
            <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-text-main">New Contacts Over Time</h3>
                  <p className="text-[11px] text-text-muted">Actual contact creation volume across current period</p>
                </div>
                <span className="text-xs font-mono font-bold text-primary">
                  {headline?.newContacts?.count ?? 0} Total in Window
                </span>
              </div>
              <ContactsChart data={crm?.contactsOverTime || []} />
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            3. CONVERSATIONS SECTION
        ═════════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'all' || activeSection === 'conversations') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h2 className="text-[15px] font-semibold tracking-tight text-text-main">Conversations</h2>
              </div>
              <button
                onClick={() => navigate('/conversations')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Go to Inbox <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Unread & Volume Stats */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-text-main">Thread Status & Volume</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface/40 rounded-lg border border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Unread Messages</span>
                    <p className="text-2xl font-bold text-text-main mt-1 font-mono">
                      {conversations?.unreadCount ?? 0}
                    </p>
                  </div>
                  <div className="p-3 bg-surface/40 rounded-lg border border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Open Threads</span>
                    <p className="text-2xl font-bold text-text-main mt-1 font-mono">
                      {conversations?.openThreads ?? 0}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-surface/40 rounded-lg border border-border/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      Avg First-Response Time
                    </span>
                    <span className="font-bold font-mono text-text-main">
                      {conversations?.avgFirstResponseMinutes != null
                        ? conversations.avgFirstResponseMinutes < 60
                          ? `${conversations.avgFirstResponseMinutes} mins`
                          : `${Math.floor(conversations.avgFirstResponseMinutes / 60)}h ${conversations.avgFirstResponseMinutes % 60}m`
                        : 'No replies yet'}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted">Calculated strictly from inbound-to-outbound message timestamps</p>
                </div>
              </div>

              {/* Messages Sent vs Received (Email & SMS Split) */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 space-y-3.5">
                <h3 className="text-sm font-semibold text-text-main">Messages Sent vs Received</h3>
                <p className="text-[11px] text-text-muted">Channel split for SMS & Email communication</p>

                <div className="space-y-3 pt-1">
                  {/* Email */}
                  <div className="p-3 bg-surface/40 rounded-lg border border-border/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-text-main">
                        <Mail className="w-3.5 h-3.5 text-blue-400" /> Email Messages
                      </span>
                      <span className="text-text-muted font-mono">
                        {(conversations?.messages?.emailSent ?? 0) + (conversations?.messages?.emailReceived ?? 0)} total
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted font-mono">
                      <span>Sent: <strong className="text-text-main">{conversations?.messages?.emailSent ?? 0}</strong></span>
                      <span>Received: <strong className="text-text-main">{conversations?.messages?.emailReceived ?? 0}</strong></span>
                    </div>
                  </div>

                  {/* SMS */}
                  <div className="p-3 bg-surface/40 rounded-lg border border-border/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-text-main">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> SMS Messages
                      </span>
                      <span className="text-text-muted font-mono">
                        {(conversations?.messages?.smsSent ?? 0) + (conversations?.messages?.smsReceived ?? 0)} total
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted font-mono">
                      <span>Sent: <strong className="text-text-main">{conversations?.messages?.smsSent ?? 0}</strong></span>
                      <span>Received: <strong className="text-text-main">{conversations?.messages?.smsReceived ?? 0}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversations Awaiting Your Reply */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-text-main">Awaiting Your Reply</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                      {conversations?.awaitingReply?.count ?? 0} pending
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mb-3">Open threads where the customer sent the last message</p>

                  <div className="space-y-2">
                    {(!conversations?.awaitingReply?.items || conversations.awaitingReply.items.length === 0) ? (
                      <p className="text-xs text-text-muted py-6 text-center">
                        Inbox zero! No customer messages currently waiting for your reply.
                      </p>
                    ) : (
                      conversations.awaitingReply.items.map((thread) => (
                        <div
                          key={thread.id}
                          onClick={() => navigate('/conversations')}
                          className="p-2.5 rounded-lg bg-surface/40 hover:bg-surface/70 border border-border/40 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-text-main mb-0.5">
                            <span className="truncate max-w-[160px]">{thread.contactName}</span>
                            <span className="text-[10px] font-mono text-text-muted">
                              {new Date(thread.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted truncate">{thread.snippet || thread.subject}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2 text-right">
                  <button
                    onClick={() => navigate('/conversations')}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open Conversations <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            4. CALENDAR SECTION
        ═════════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'all' || activeSection === 'calendar') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h2 className="text-[15px] font-semibold tracking-tight text-text-main">Calendar & Bookings</h2>
              </div>
              <button
                onClick={() => navigate('/calendar')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Go to Calendar <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Today's & This Week's Appointments */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-text-main">Appointments Schedule</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface/40 rounded-lg border border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Today</span>
                    <p className="text-2xl font-bold text-text-main mt-1 font-mono">
                      {calendar?.todayAppointmentsCount ?? 0}
                    </p>
                  </div>
                  <div className="p-3 bg-surface/40 rounded-lg border border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">This Week</span>
                    <p className="text-2xl font-bold text-text-main mt-1 font-mono">
                      {calendar?.thisWeekAppointmentsCount ?? 0}
                    </p>
                  </div>
                </div>

                {/* Status Breakdown: Booked vs Completed vs Cancelled */}
                <div className="p-3 bg-surface/40 rounded-lg border border-border/40 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Status Breakdown</span>
                  <div className="flex items-center justify-between text-xs pt-1 font-mono">
                    <span className="text-emerald-400">Booked: <strong>{calendar?.statusBreakdown?.booked ?? 0}</strong></span>
                    <span className="text-blue-400">Completed: <strong>{calendar?.statusBreakdown?.completed ?? 0}</strong></span>
                    <span className="text-rose-400">Cancelled: <strong>{calendar?.statusBreakdown?.cancelled ?? 0}</strong></span>
                  </div>
                </div>
              </div>

              {/* Next 5 Upcoming Appointments (Clickable List) */}
              <div className="lg:col-span-2 rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-text-main">Next Upcoming Appointments</h3>
                    <p className="text-[11px] text-text-muted">Click any appointment to open in Calendar</p>
                  </div>
                  <button
                    onClick={() => navigate('/calendar')}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {(!calendar?.upcomingAppointments || calendar.upcomingAppointments.length === 0) ? (
                    <p className="text-xs text-text-muted py-6 text-center">
                      No upcoming appointments scheduled.
                    </p>
                  ) : (
                    calendar.upcomingAppointments.map((appt) => (
                      <div
                        key={appt.id}
                        onClick={() => navigate('/calendar')}
                        className="p-3 rounded-lg bg-surface/40 hover:bg-surface/70 border border-border/40 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-4">
                          <p className="text-xs font-semibold text-text-main truncate">{appt.title}</p>
                          <p className="text-[11px] text-text-muted truncate">
                            {appt.contactName ? `${appt.contactName} (${appt.contactEmail || ''})` : appt.type}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-medium text-text-main block">
                            {new Date(appt.startTime).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {appt.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            5. EMAIL MARKETING SECTION (Prominent Room)
        ═════════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'all' || activeSection === 'email') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <h2 className="text-[15px] font-semibold tracking-tight text-text-main">Email Marketing & Outreach</h2>
              </div>
              <button
                onClick={() => navigate('/email-marketing/campaigns')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Go to Campaigns <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-lg bg-surface/30 border border-border/50 shadow-luxury">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <Send className="w-3 h-3 text-primary" /> Sent
                </span>
                <p className="text-xl font-bold font-mono text-text-main mt-1">
                  {emailMarketing?.sent?.toLocaleString() ?? 0}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface/30 border border-border/50 shadow-luxury">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Delivered
                </span>
                <p className="text-xl font-bold font-mono text-text-main mt-1">
                  {emailMarketing?.delivered?.toLocaleString() ?? 0}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface/30 border border-border/50 shadow-luxury">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <Eye className="w-3 h-3 text-blue-400" /> Unique Opens
                </span>
                <p className="text-xl font-bold font-mono text-text-main mt-1">
                  {emailMarketing?.uniqueOpens?.toLocaleString() ?? 0}
                  <span className="text-[11px] font-normal text-text-muted ml-1 font-sans">
                    ({emailMarketing?.openRate ?? 0}%)
                  </span>
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface/30 border border-border/50 shadow-luxury">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <MousePointer className="w-3 h-3 text-indigo-400" /> Unique Clicks
                </span>
                <p className="text-xl font-bold font-mono text-text-main mt-1">
                  {emailMarketing?.uniqueClicks?.toLocaleString() ?? 0}
                  <span className="text-[11px] font-normal text-text-muted ml-1 font-sans">
                    ({emailMarketing?.clickRate ?? 0}%)
                  </span>
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface/30 border border-border/50 shadow-luxury">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" /> Bounces
                </span>
                <p className="text-xl font-bold font-mono text-text-main mt-1">
                  {emailMarketing?.bounces?.toLocaleString() ?? 0}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface/30 border border-border/50 shadow-luxury">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-400" /> Unsubscribed
                </span>
                <p className="text-xl font-bold font-mono text-text-main mt-1">
                  {emailMarketing?.unsubscribes?.toLocaleString() ?? 0}
                </p>
              </div>
            </div>

            {/* Last Campaign Card & List Growth */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Last Campaign Performance */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-text-main">Last Dispatched Campaign</h3>
                    {emailMarketing?.lastCampaign && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Dispatched
                      </span>
                    )}
                  </div>

                  {!emailMarketing?.lastCampaign ? (
                    <div className="py-8 text-center text-xs text-text-muted">
                      No sent email campaigns recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div>
                        <p className="text-base font-bold text-text-main">{emailMarketing.lastCampaign.name}</p>
                        <p className="text-xs text-text-muted mt-0.5">{emailMarketing.lastCampaign.subject}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5 pt-2">
                        <div className="p-2.5 bg-surface/40 rounded-lg border border-border/40">
                          <span className="text-[10px] text-text-muted block">Recipients</span>
                          <span className="text-sm font-bold font-mono text-text-main">
                            {emailMarketing.lastCampaign.totalRecipients.toLocaleString()}
                          </span>
                        </div>
                        <div className="p-2.5 bg-surface/40 rounded-lg border border-border/40">
                          <span className="text-[10px] text-text-muted block">Open Rate</span>
                          <span className="text-sm font-bold font-mono text-emerald-400">
                            {emailMarketing.lastCampaign.openRate}%
                          </span>
                        </div>
                        <div className="p-2.5 bg-surface/40 rounded-lg border border-border/40">
                          <span className="text-[10px] text-text-muted block">Click Rate</span>
                          <span className="text-sm font-bold font-mono text-indigo-400">
                            {emailMarketing.lastCampaign.clickRate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 text-right">
                  <button
                    onClick={() => navigate('/email-marketing/campaigns')}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View campaign analytics <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* List Growth Card */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-main mb-1">List Growth</h3>
                  <p className="text-[11px] text-text-muted mb-4">New audience subscribers minus unsubscribes</p>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-surface/40 rounded-lg border border-border/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">New Leads</span>
                      <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                        +{emailMarketing?.listGrowth?.newSubscribers ?? 0}
                      </p>
                    </div>
                    <div className="p-3 bg-surface/40 rounded-lg border border-border/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Unsubscribes</span>
                      <p className="text-xl font-bold font-mono text-rose-400 mt-1">
                        -{emailMarketing?.listGrowth?.unsubscribes ?? 0}
                      </p>
                    </div>
                    <div className="p-3 bg-surface/40 rounded-lg border border-border/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Net Growth</span>
                      <p className="text-xl font-bold font-mono text-primary mt-1">
                        {(emailMarketing?.listGrowth?.netGrowth ?? 0) >= 0 ? '+' : ''}
                        {emailMarketing?.listGrowth?.netGrowth ?? 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 text-right">
                  <button
                    onClick={() => navigate('/email-marketing/contacts')}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Manage audience lists <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            6. AUTOMATIONS SECTION (Active & Failures Tracked for Trust)
        ═════════════════════════════════════════════ */}
        {(activeSection === 'all' || activeSection === 'automations') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-primary" />
                <h2 className="text-[15px] font-semibold tracking-tight text-text-main">Automations & Workflows</h2>
              </div>
              <button
                onClick={() => navigate('/automations')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Go to Automations <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Active & Executions Summary */}
              <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-text-main">Workflow Telemetry</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface/40 rounded-lg border border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Active Workflows</span>
                    <p className="text-2xl font-bold text-text-main mt-1 font-mono">
                      {automations?.activeWorkflows ?? 0}
                    </p>
                  </div>
                  <div className="p-3 bg-surface/40 rounded-lg border border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Success Rate</span>
                    <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                      {automations?.successRate ?? 100}%
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-surface/40 rounded-lg border border-border/40 flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400">Succeeded: <strong>{automations?.succeededRuns ?? 0}</strong></span>
                  <span className="text-rose-400">Failed: <strong>{automations?.failedRuns ?? 0}</strong></span>
                  <span className="text-text-muted">Total: <strong>{automations?.totalRuns ?? 0}</strong></span>
                </div>
              </div>

              {/* Recent Failed Runs (Visibility Drives Trust) */}
              <div className="lg:col-span-2 rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <h3 className="text-sm font-semibold text-text-main">Recent Failed Automation Runs</h3>
                    </div>
                    <span className="text-[11px] font-mono text-text-muted">Direct links to run logs</span>
                  </div>
                  <p className="text-[11px] text-text-muted mb-3">
                    Failures are fully visible so you can inspect and resolve execution errors instantly
                  </p>

                  <div className="space-y-2">
                    {(!automations?.recentFailedRuns || automations.recentFailedRuns.length === 0) ? (
                      <div className="p-6 text-center text-text-muted text-xs bg-surface/20 rounded-lg border border-border/30">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400 opacity-80" />
                        Zero failed automation runs! Workflows executing with 100% stability.
                      </div>
                    ) : (
                      automations.recentFailedRuns.map((run) => (
                        <div
                          key={run.id}
                          onClick={() => navigate('/automations')}
                          className="p-3 rounded-lg bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 cursor-pointer transition-all flex items-center justify-between"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="text-xs font-semibold text-text-main truncate">{run.workflowName}</p>
                            <p className="text-[11px] text-rose-400 truncate mt-0.5">{run.error}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono text-text-muted block">
                              {new Date(run.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <span className="text-[10px] text-primary flex items-center gap-0.5 mt-0.5">
                              Inspect <ArrowUpRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2 text-right">
                  <button
                    onClick={() => navigate('/automations')}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open Automation Builder <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            7. ACTIVITY FEED SECTION (Chronological Union of Real Events)
        ═════════════════════════════════════════════ */}
        {(activeSection === 'all' || activeSection === 'activity') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h2 className="text-[15px] font-semibold tracking-tight text-text-main">Workspace Activity Feed</h2>
              </div>
              <span className="text-xs text-text-muted font-mono">{activityFeed.length} Recent Events</span>
            </div>

            <div className="rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 divide-y divide-border/30 overflow-hidden">
              {activityFeed.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-xs">
                  No workspace activity recorded yet.
                </div>
              ) : (
                activityFeed.map((event) => {
                  let Icon = Activity;
                  let iconColor = 'text-primary';
                  let iconBg = 'bg-primary/10';

                  if (event.type === 'contact_created') {
                    Icon = Users;
                    iconColor = 'text-blue-400';
                    iconBg = 'bg-blue-500/10';
                  } else if (event.type === 'deal_won') {
                    Icon = DollarSign;
                    iconColor = 'text-emerald-400';
                    iconBg = 'bg-emerald-500/10';
                  } else if (event.type === 'appointment_booked') {
                    Icon = Calendar;
                    iconColor = 'text-purple-400';
                    iconBg = 'bg-purple-500/10';
                  } else if (event.type === 'campaign_sent') {
                    Icon = Mail;
                    iconColor = 'text-indigo-400';
                    iconBg = 'bg-indigo-500/10';
                  } else if (event.type === 'workflow_failed') {
                    Icon = AlertTriangle;
                    iconColor = 'text-rose-400';
                    iconBg = 'bg-rose-500/10';
                  }

                  return (
                    <div
                      key={event.id}
                      onClick={() => navigate(event.link)}
                      className="p-3.5 hover:bg-surface-hover/60 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <div className={`w-8 h-8 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-main">{event.title}</p>
                          <p className="text-[11px] text-text-muted truncate">{event.subtitle}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-text-muted">
                          {new Date(event.timestamp).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

      {/* Floating CRM AI Assistant */}
      <CRMAIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />

      {/* Notifications Panel */}
      <NotificationPanel isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </div>
  );
}
