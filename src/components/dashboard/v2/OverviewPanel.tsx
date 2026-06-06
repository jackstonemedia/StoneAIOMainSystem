import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, DollarSign, Target, GitBranch,
  Mail, Phone, TrendingUp, TrendingDown,
  ChevronRight, ChevronLeft, Calendar,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { BusinessMetrics } from '../../../hooks/useDashboardMetrics';
import type { Contact } from '../../../types/crm';
import type { Appointment } from '../../../types/business';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return `$${val.toLocaleString()}`;
}

function pctChange(arr: number[]): number | null {
  if (arr.length < 2 || arr[0] === 0) return null;
  return Math.round(((arr[arr.length - 1] - arr[0]) / arr[0]) * 100);
}

function statusBadgeClass(s: string | null | undefined) {
  const v = (s || '').toLowerCase();
  if (v.includes('won') || v.includes('active') || v.includes('customer')) return 'badge-success';
  if (v.includes('lost') || v.includes('churn')) return 'badge-danger';
  if (v.includes('qualified') || v.includes('proposal')) return 'badge-info';
  return 'badge-neutral';
}

// ─── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ data, color = 'var(--primary)' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const W = 100, H = 52;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 6) - 3,
  }));
  let line = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i], mx = (p.x + c.x) / 2;
    line += ` C ${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
  }
  const area = `${line} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`;
  const id = `sp${H}${color.length}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="75%" stopColor={color} stopOpacity="0.04" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Revenue chart ───────────────────────────────────────────────────────────

function RevenueChart({ data, max }: { data: number[]; max: number }) {
  if (data.length < 2) return null;
  const W = 800, H = 200;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (v / max) * (H - 10),
  }));
  let line = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i], mx = (p.x + c.x) / 2;
    line += ` C ${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
  }
  const area = `${line} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="rvc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(p => (
        <line key={p} x1="0" y1={H * p} x2={W} y2={H * p} stroke="rgba(100,120,140,0.08)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#rvc)" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Mini calendar ───────────────────────────────────────────────────────────

const APPT_COLORS: Record<string, string> = {
  call: '#F59E0B', meeting: '#EF4444', task: '#8B5CF6', default: 'var(--primary)',
};

function apptDotColor(a: Appointment) {
  const t = (a.type || a.title || '').toLowerCase();
  if (t.includes('call')) return APPT_COLORS.call;
  if (t.includes('meet')) return APPT_COLORS.meeting;
  if (t.includes('task')) return APPT_COLORS.task;
  return APPT_COLORS.default;
}

function MiniCalendar({ appointments }: { appointments: Appointment[] }) {
  const now = new Date();
  const month = now.getMonth(), year = now.getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const out: { day: number | null; colors: string[]; isToday: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) out.push({ day: null, colors: [], isToday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dayAppts = appointments.filter(a => {
        const dt = new Date(a.startTime);
        return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === d;
      });
      const colors = [...new Set(dayAppts.map(apptDotColor))].slice(0, 3);
      out.push({ day: d, colors, isToday: now.getDate() === d });
    }
    while (out.length % 7 !== 0) out.push({ day: null, colors: [], isToday: false });
    return out;
  }, [appointments, month, year]);

  return (
    <>
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-text-muted/50 uppercase tracking-wide py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => (
          <div key={i} className="flex flex-col items-center py-0.5">
            {cell.day != null && (
              <>
                <span className={`text-[11px] font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  cell.isToday
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                    : 'text-text-muted/70 hover:text-text-main'
                }`}>
                  {cell.day}
                </span>
                {cell.colors.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {cell.colors.map((c, j) => (
                      <span key={j} className="w-1 h-1 rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Shared inner card style ─────────────────────────────────────────────────

const CARD = 'rounded-lg bg-surface/50 border border-border/25';

// ─── Stat card sub-row ───────────────────────────────────────────────────────

function CardFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between text-[11px]">
      {children}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface OverviewPanelProps {
  metrics?: BusinessMetrics;
  contacts: Contact[];
  appointments: Appointment[];
  isMetricsLoading: boolean;
  isContactsLoading: boolean;
  isApptsLoading: boolean;
}

export function OverviewPanel({
  metrics, contacts, appointments,
  isMetricsLoading, isContactsLoading, isApptsLoading,
}: OverviewPanelProps) {

  const totalContacts = metrics?.contacts?.total ?? 0;
  const revenue = metrics?.revenue?.current ?? 0;
  const pipeline = metrics?.pipeline?.value ?? 0;
  const cTrend = metrics?.contacts?.trend ?? [];
  const rTrend = metrics?.revenue?.trend ?? [];
  const stages = metrics?.pipeline_stages ?? [];
  const won = stages.find(s => s.name === 'Won')?.count ?? 0;
  const lost = stages.find(s => s.name === 'Lost')?.count ?? 0;
  const openStages = stages.filter(s => s.name !== 'Won' && s.name !== 'Lost');
  const openDeals = openStages.reduce((n, s) => n + s.count, 0);
  const totalDeals = won + lost + openDeals;
  const wonRatio = totalDeals > 0 ? Math.round((won / totalDeals) * 100) : 0;
  const revPct = pctChange(rTrend);
  const ctPct = pctChange(cTrend);
  const topStages = openStages.slice(0, 3);
  const maxStageCount = Math.max(...topStages.map(s => s.count), 1);

  const chartData = rTrend.length > 1 ? rTrend : [12, 18, 15, 22, 28, 24, 32, 30, 26, 34, 38, 42];
  const chartMax = Math.max(...chartData, 1);
  const xLabels = chartData.map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (chartData.length - 1 - i));
    return d.toLocaleDateString(undefined, { month: 'short' });
  });

  const recentContacts = useMemo(() =>
    [...contacts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6),
    [contacts]
  );

  const now = new Date();
  const upcoming = useMemo(() =>
    [...appointments]
      .filter(a => new Date(a.startTime).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 8),
    [appointments]
  );

  const todayFull = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const monthYear = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col"
    >

      {/* ── TOP BAND ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-label-caps mb-0.5 block">Overview</span>
            <h2 className="text-[15px] font-semibold tracking-tight text-text-main">Workspace pulse</h2>
          </div>
          <div className="w-px h-8 bg-border/50 hidden sm:block" />
          <p className="text-[12px] text-text-muted hidden sm:block">{todayFull}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-text-muted">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/70" />{totalContacts.toLocaleString()} contacts</span>
          <div className="w-px h-3.5 bg-border/50 hidden sm:block" />
          <span className="hidden sm:block">{fmt(revenue)} revenue</span>
          <div className="w-px h-3.5 bg-border/50 hidden md:block" />
          <span className="hidden md:block">{fmt(pipeline)} pipeline</span>
        </div>
      </div>

      {/* ── INNER CONTENT ─────────────────────────────────────────────────── */}
      <div className="p-4 md:p-5 space-y-4 flex-1">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Contacts */}
          <div className={`${CARD} p-4 flex flex-col`}>
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="w-5 h-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Users className="w-2.5 h-2.5 text-primary" strokeWidth={2.5} />
              </div>
              <span className="text-label-caps">Contacts</span>
            </div>
            {isMetricsLoading ? (
              <div className="space-y-2.5 flex-1">
                <div className="skeleton skeleton-title w-16" />
                <div className="skeleton h-10 rounded" />
              </div>
            ) : (
              <>
                <div className="text-[30px] font-bold tracking-tight text-text-main leading-none mb-3 tabular-nums">
                  {totalContacts.toLocaleString()}
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  {cTrend.length > 1
                    ? <Sparkline data={cTrend} />
                    : <p className="text-[11px] text-text-muted">Active in workspace</p>
                  }
                </div>
                <CardFooter>
                  <span className="text-text-muted">Period change</span>
                  {ctPct !== null ? (
                    <span className={`font-semibold flex items-center gap-1 ${ctPct >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {ctPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {ctPct >= 0 ? '+' : ''}{ctPct}%
                    </span>
                  ) : (
                    <span className="font-semibold text-text-main">All lists</span>
                  )}
                </CardFooter>
              </>
            )}
          </div>

          {/* Revenue */}
          <div className={`${CARD} p-4 flex flex-col`}>
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="w-5 h-5 rounded-md bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center shrink-0">
                <DollarSign className="w-2.5 h-2.5 text-[#10B981]" strokeWidth={2.5} />
              </div>
              <span className="text-label-caps">Revenue</span>
            </div>
            {isMetricsLoading ? (
              <div className="space-y-2.5 flex-1">
                <div className="skeleton skeleton-title w-20" />
                <div className="skeleton h-10 rounded" />
              </div>
            ) : (
              <>
                <div className="text-[30px] font-bold tracking-tight text-text-main leading-none mb-3 tabular-nums">
                  {fmt(revenue)}
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  {rTrend.length > 1
                    ? <Sparkline data={rTrend} color="#10B981" />
                    : <p className="text-[11px] text-text-muted">Closed-won this period</p>
                  }
                </div>
                <CardFooter>
                  <span className="text-text-muted">vs prior period</span>
                  {revPct !== null ? (
                    <span className={`font-semibold flex items-center gap-1 ${revPct >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {revPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {revPct >= 0 ? '+' : ''}{revPct}%
                    </span>
                  ) : (
                    <span className="font-semibold text-text-muted">—</span>
                  )}
                </CardFooter>
              </>
            )}
          </div>

          {/* Pipeline — stage breakdown */}
          <div className={`${CARD} p-4 flex flex-col`}>
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="w-5 h-5 rounded-md bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center shrink-0">
                <Target className="w-2.5 h-2.5 text-[#8B5CF6]" strokeWidth={2.5} />
              </div>
              <span className="text-label-caps">Pipeline</span>
            </div>
            {isMetricsLoading ? (
              <div className="space-y-2.5 flex-1">
                <div className="skeleton skeleton-title w-20" />
                <div className="skeleton h-10 rounded" />
              </div>
            ) : (
              <>
                <div className="text-[30px] font-bold tracking-tight text-text-main leading-none mb-3 tabular-nums">
                  {fmt(pipeline)}
                </div>
                <div className="flex-1 flex flex-col justify-end gap-2">
                  {topStages.length > 0 ? topStages.map(s => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-medium text-text-muted truncate">{s.name}</span>
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: s.color || '#8B5CF6' }}>{s.count}</span>
                      </div>
                      <div className="h-2 bg-border/20 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: s.color || '#8B5CF6' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(6, Math.round((s.count / maxStageCount) * 100))}%` }}
                          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
                        />
                      </div>
                    </div>
                  )) : (
                    <p className="text-[11px] text-text-muted">{openDeals} open deals</p>
                  )}
                </div>
                <CardFooter>
                  <span className="text-text-muted">Open deals</span>
                  <span className="font-semibold text-text-main">{openDeals}</span>
                </CardFooter>
              </>
            )}
          </div>

          {/* Deals */}
          <div className={`${CARD} p-4 flex flex-col`}>
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="w-5 h-5 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center shrink-0">
                <GitBranch className="w-2.5 h-2.5 text-[#F59E0B]" strokeWidth={2.5} />
              </div>
              <span className="text-label-caps">Deals</span>
            </div>
            {isMetricsLoading ? (
              <div className="space-y-2.5 flex-1">
                <div className="skeleton skeleton-title w-12" />
                <div className="skeleton h-10 rounded" />
              </div>
            ) : (
              <>
                <div className="text-[30px] font-bold tracking-tight text-text-main leading-none mb-3 tabular-nums">
                  {totalDeals}
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-4 text-[12px] text-text-muted mb-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                      {lost} lost
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-border" />
                      {openDeals} open
                    </span>
                  </div>
                  {totalDeals > 0 && (
                    <div className="h-1 bg-border/25 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${wonRatio}%` }} />
                    </div>
                  )}
                </div>
                <CardFooter>
                  <span className="text-text-muted">Win rate</span>
                  <span className="font-semibold text-text-main">{totalDeals > 0 ? `${wonRatio}%` : '—'}</span>
                </CardFooter>
              </>
            )}
          </div>

        </div>

        {/* ── Chart + Calendar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-3">

          {/* Chart card */}
          <div className={`${CARD} p-5 flex flex-col min-h-[300px]`}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <span className="text-label-caps mb-0.5 block">Performance</span>
                <span className="text-[14px] font-semibold text-text-main">Revenue trend</span>
              </div>
              <Link to="/crm/pipeline" className="btn-secondary h-7 text-[11px] px-3">
                Pipeline <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex-1 relative pb-6 min-h-[160px]">
              {isMetricsLoading ? (
                <div className="skeleton rounded-lg absolute inset-0" />
              ) : (
                <>
                  <div className="absolute inset-0 bottom-6">
                    <RevenueChart data={chartData} max={chartMax} />
                  </div>
                  {/* Won/Lost overlay — subtle, top-right */}
                  <div className="absolute top-0 right-0 border border-border/30 rounded-lg px-3 py-2 text-[11px] font-medium bg-surface/60 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-1.5 text-text-main mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />{won} won
                    </div>
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />{lost} lost
                    </div>
                  </div>
                  {/* X-axis labels */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] font-medium text-text-muted/50">
                    {xLabels.map(l => <span key={l}>{l}</span>)}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Calendar card */}
          <div className={`${CARD} flex flex-col min-h-[300px]`}>
            <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0">
              <div>
                <span className="text-label-caps mb-0.5 block">Schedule</span>
                <span className="text-[14px] font-semibold text-text-main">{monthYear}</span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="w-6 h-6 rounded-md border border-border/30 flex items-center justify-center text-text-muted hover:text-text-main transition-colors" aria-label="Prev">
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button type="button" className="w-6 h-6 rounded-md border border-border/30 flex items-center justify-center text-text-muted hover:text-text-main transition-colors" aria-label="Next">
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="px-4 pb-3 shrink-0">
              {isApptsLoading
                ? <div className="skeleton rounded-lg h-36" />
                : <MiniCalendar appointments={appointments} />
              }
            </div>

            <div className="flex-1 border-t border-border/25 flex flex-col overflow-hidden">
              <div className="px-4 pt-3 pb-1.5 shrink-0 flex items-center justify-between">
                <span className="text-label-caps flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Next up
                </span>
                <Link to="/business/calendar" className="text-[10px] font-semibold text-primary hover:underline">
                  View all
                </Link>
              </div>
              {upcoming.length === 0 ? (
                <div className="flex-1 flex items-center justify-center pb-4">
                  <p className="text-[12px] text-text-muted">No upcoming appointments.</p>
                </div>
              ) : (
                <ul className="flex-1 overflow-y-auto">
                  {upcoming.map(a => {
                    const apptDate = new Date(a.startTime);
                    return (
                      <li key={a.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-border/20 last:border-0 hover:bg-surface-hover/40 transition-colors duration-150">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: apptDotColor(a) }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-text-main truncate">{a.title || 'Appointment'}</div>
                          <div className="text-[11px] text-text-muted/70 mt-0.5">
                            {apptDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' · '}
                            {apptDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

        </div>

        {/* ── Contacts table card ── */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border/30 bg-surface/60 backdrop-blur-sm">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Contact</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap hidden md:table-cell">Phone</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap hidden lg:table-cell">Email</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap">Status</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap hidden sm:table-cell">Added</th>
                  <th className="px-5 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {isContactsLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="px-5 py-3.5" colSpan={6}>
                          <div className="flex items-center gap-3">
                            <div className="skeleton skeleton-avatar w-7 h-7" />
                            <div className="skeleton skeleton-text w-40" />
                          </div>
                        </td>
                      </tr>
                    ))
                  : recentContacts.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center">
                          <p className="text-[13px] text-text-muted mb-3">No contacts yet.</p>
                          <Link to="/crm/contacts" className="btn-primary inline-flex">Add first contact</Link>
                        </td>
                      </tr>
                    )
                    : recentContacts.map(c => {
                        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown';
                        const initials = `${c.firstName?.charAt(0) || ''}${c.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
                        return (
                          <tr key={c.id} className="border-b border-border/20 last:border-0 transition-colors hover:bg-surface-hover/40">
                            <td className="px-5 py-3.5">
                              <Link to={`/crm/contacts/${c.id}`} className="flex items-center gap-3 group">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-bg shadow-sm shrink-0" style={{ backgroundColor: c.color || 'var(--primary)' }}>
                                  {initials}
                                </div>
                                <span className="text-[13px] font-medium text-text-main group-hover:text-primary transition-colors truncate">{name}</span>
                              </Link>
                            </td>
                            <td className="px-5 py-3.5 hidden md:table-cell">
                              {c.phone
                                ? <div className="flex items-center gap-2 text-[13px] font-medium text-text-main"><Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />{c.phone}</div>
                                : <span className="text-text-muted text-[12px]">—</span>}
                            </td>
                            <td className="px-5 py-3.5 hidden lg:table-cell">
                              {c.email
                                ? <div className="flex items-center gap-2 text-[13px] font-medium text-text-main max-w-[200px]"><Mail className="w-3.5 h-3.5 text-text-muted shrink-0" /><span className="truncate">{c.email}</span></div>
                                : <span className="text-text-muted text-[12px]">—</span>}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`badge ${statusBadgeClass(c.status)}`}>{c.status || 'Lead'}</span>
                            </td>
                            <td className="px-5 py-3.5 hidden sm:table-cell text-[11px] font-medium text-text-muted whitespace-nowrap opacity-60">
                              {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-3.5">
                              <Link to={`/crm/contacts/${c.id}`} className="text-text-muted/30 hover:text-primary transition-colors">
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── BOTTOM BAND ───────────────────────────────────────────────────── */}
      <div className="px-6 py-3.5 border-t border-border/50 bg-surface flex items-center justify-between shrink-0">
        <span className="font-semibold text-text-muted text-[12px] flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-primary/60" />
          Showing {recentContacts.length} of {contacts.length} contacts
        </span>
        <Link to="/crm/contacts" className="btn-secondary h-8 text-[12px]">
          All contacts <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

    </motion.div>
  );
}
