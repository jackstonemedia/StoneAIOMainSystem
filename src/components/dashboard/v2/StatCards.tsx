import { ArrowUpRight, TrendingDown, TrendingUp, Users, DollarSign, Target, GitBranch } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BusinessMetrics } from '../../../hooks/useDashboardMetrics';
import { DashboardFadeIn } from './DashboardPanel';

interface StatCardsProps {
  metrics?: BusinessMetrics;
  isLoading: boolean;
  variant?: 'bento' | 'row';
}

function formatCurrency(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return `$${val.toLocaleString()}`;
}

/** Tiny inline sparkline — 24px tall, fills its container width */
function Sparkline({ data, color = 'var(--primary)' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const w = 120;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 2) - 1,
  }));
  let path = `M ${coords[0].x},${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const p = coords[i - 1];
    const c = coords[i];
    const mx = (p.x + c.x) / 2;
    path += ` C ${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
  }
  // Area fill path
  const area =
    `${path} L ${coords[coords.length - 1].x},${h} L ${coords[0].x},${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: h }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  isLoading: boolean;
  footer: ReactNode;
  body?: ReactNode;
  className?: string;
  delay?: number;
}

function MetricCard({ label, value, icon, isLoading, footer, body, className = '', delay = 0 }: MetricCardProps) {
  return (
    <DashboardFadeIn delay={delay} className={className}>
      <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col h-full">
        {/* Top band — dark frosted header, matches contacts thead */}
        <div className="px-4 py-3 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center gap-2.5 shrink-0">
          <div className="w-6 h-6 rounded-md bg-bg border border-border/50 flex items-center justify-center shrink-0 text-text-muted">
            {icon}
          </div>
          <span className="text-label-caps">{label}</span>
        </div>

        {/* Card body */}
        <div className="px-4 pt-4 pb-3 flex-1 flex flex-col">
          {isLoading ? (
            <div className="space-y-2 flex-1">
              <div className="skeleton skeleton-title w-24" />
              <div className="skeleton skeleton-text w-full max-w-[140px]" />
            </div>
          ) : (
            <>
              <h2 className="text-[28px] font-bold tracking-tight text-text-main leading-none mb-3">{value}</h2>
              {body}
            </>
          )}
        </div>

        {/* Bottom band — solid dark footer, matches contacts paginator */}
        <div className="px-4 py-2.5 border-t border-border/50 bg-surface shrink-0">
          {isLoading ? (
            <div className="skeleton skeleton-text w-28" />
          ) : (
            footer
          )}
        </div>
      </div>
    </DashboardFadeIn>
  );
}

export function StatCards({ metrics, isLoading, variant = 'bento' }: StatCardsProps) {
  const contacts = metrics?.contacts?.total ?? 0;
  const revenue = metrics?.revenue?.current ?? 0;
  const pipeline = metrics?.pipeline?.value ?? 0;
  const contactsTrend = metrics?.contacts?.trend ?? [];
  const revenueTrend = metrics?.revenue?.trend ?? [];
  const pipelineTrend = metrics?.pipeline?.trend ?? [];

  const stages = metrics?.pipeline_stages ?? [];
  const won = stages.find((s) => s.name === 'Won')?.count ?? 0;
  const lost = stages.find((s) => s.name === 'Lost')?.count ?? 0;
  const openStages = stages.filter((s) => s.name !== 'Won' && s.name !== 'Lost');
  const openDeals = openStages.reduce((sum, s) => sum + s.count, 0);
  const totalDeals = won + lost + openDeals;

  // Trend direction helpers
  const revTrending = revenueTrend.length > 1
    ? revenueTrend[revenueTrend.length - 1] >= revenueTrend[0]
    : null;

  const wonRatio = totalDeals > 0 ? Math.round((won / totalDeals) * 100) : 0;

  const gridClass =
    variant === 'row'
      ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'
      : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4';

  return (
    <div className={gridClass}>

      {/* Contacts card */}
      <MetricCard
        className={variant === 'bento' ? 'md:col-span-1 xl:col-span-3' : ''}
        delay={0}
        label="Total contacts"
        value={contacts.toLocaleString()}
        icon={<Users className="w-3.5 h-3.5" strokeWidth={2} />}
        isLoading={isLoading}
        body={
          contactsTrend.length > 1 ? (
            <div className="flex-1 flex flex-col justify-end">
              <Sparkline data={contactsTrend} color="var(--primary)" />
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">Active people in your CRM.</p>
          )
        }
        footer={
          <span className="text-[11px] font-medium text-text-muted flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 inline-block" />
            Across all smart lists
          </span>
        }
      />

      {/* Revenue card */}
      <MetricCard
        className={variant === 'bento' ? 'md:col-span-1 xl:col-span-4' : ''}
        delay={0.04}
        label="Monthly revenue"
        value={formatCurrency(revenue)}
        icon={<DollarSign className="w-3.5 h-3.5" strokeWidth={2} />}
        isLoading={isLoading}
        body={
          revenueTrend.length > 1 ? (
            <div className="flex-1 flex flex-col justify-end">
              <Sparkline data={revenueTrend} color="var(--primary)" />
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">Closed-won value this period.</p>
          )
        }
        footer={
          <span className="text-[11px] font-medium text-text-muted flex items-center gap-1.5">
            {revTrending !== null ? (
              revTrending ? (
                <><TrendingUp className="w-3 h-3 text-[#10B981]" /><span className="text-[#10B981]">Trending up</span></>
              ) : (
                <><TrendingDown className="w-3 h-3 text-[#EF4444]" /><span className="text-[#EF4444]">Trending down</span></>
              )
            ) : (
              <><ArrowUpRight className="w-3 h-3" /> Tracking live</>
            )}
          </span>
        }
      />

      {/* Pipeline card */}
      <MetricCard
        className={variant === 'bento' ? 'md:col-span-1 xl:col-span-3' : ''}
        delay={0.08}
        label="Pipeline value"
        value={formatCurrency(pipeline)}
        icon={<Target className="w-3.5 h-3.5" strokeWidth={2} />}
        isLoading={isLoading}
        body={
          pipelineTrend.length > 1 ? (
            <div className="flex-1 flex flex-col justify-end">
              <Sparkline data={pipelineTrend} color="#8B5CF6" />
            </div>
          ) : openStages.length > 0 ? (
            <div className="flex-1 space-y-1.5 mt-1">
              {openStages.slice(0, 3).map((s) => (
                <div key={s.name} className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted truncate">{s.name}</span>
                  <span className="font-semibold text-text-main ml-2 shrink-0">{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">Weighted potential across open stages.</p>
          )
        }
        footer={
          <span className="text-[11px] font-medium text-text-muted flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]/70 inline-block" />
            {openDeals} open {openDeals === 1 ? 'deal' : 'deals'} in pipeline
          </span>
        }
      />

      {/* Deals card */}
      <MetricCard
        className={variant === 'bento' ? 'md:col-span-1 xl:col-span-2' : ''}
        delay={0.12}
        label="Deals"
        value={String(totalDeals)}
        icon={<GitBranch className="w-3.5 h-3.5" strokeWidth={2} />}
        isLoading={isLoading}
        body={
          <div className="flex-1 flex flex-col justify-between">
            {/* Won / Lost counts */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <div className="text-[16px] font-bold text-text-main">{won}</div>
                <div className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> Won
                </div>
              </div>
              <div>
                <div className="text-[16px] font-bold text-text-main">{lost}</div>
                <div className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                  <TrendingDown className="w-3 h-3 text-[#EF4444] opacity-80" /> Lost
                </div>
              </div>
            </div>
            {/* Win rate bar */}
            {totalDeals > 0 && (
              <div className="mt-3">
                <div className="h-1 rounded-full bg-border/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#10B981] transition-all duration-500"
                    style={{ width: `${wonRatio}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        }
        footer={
          <span className="text-[11px] font-medium text-text-muted">
            {totalDeals > 0 ? `${wonRatio}% win rate` : 'No closed deals yet'}
          </span>
        }
      />

    </div>
  );
}
