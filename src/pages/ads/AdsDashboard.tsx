import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, TrendingUp, TrendingDown, Users, MousePointerClick, Activity, DollarSign, Eye, BarChart3 } from 'lucide-react';
import { useAdDashboardMetrics, useAdChartData } from '../../hooks/useAdMetrics';
import { useAdAccounts } from '../../hooks/useAdAccounts';
import { useAdCampaigns } from '../../hooks/useAdCampaigns';
import { formatCurrency } from '../../lib/utils';


// ─── Date range presets ───────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: 'Today',      value: 'TODAY' },
  { label: 'Last 7d',   value: 'LAST_7' },
  { label: 'Last 30d',  value: 'LAST_30' },
  { label: 'This Month', value: 'THIS_MONTH' },
  { label: 'Last Month', value: 'LAST_MONTH' },
];

// ─── Native SVG Area Chart ────────────────────────────────────────────────────

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
  const W = 100; // viewBox percentage width
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

  // Y axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    val: maxVal * f,
    y: toY(maxVal * f),
  }));

  // X axis labels (every ~7 items)
  const xLabels = data
    .map((d, i) => ({ i, label: String(d.date ?? '').slice(5) }))
    .filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0);

  return (
    <svg
      viewBox={`0 0 ${viewBoxW} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: H }}
    >
      {/* Grid lines */}
      {ticks.map((t, i) => (
        <line key={i} x1={pad.l} x2={viewBoxW - pad.r} y1={t.y} y2={t.y}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
      ))}

      {/* Y labels */}
      {ticks.map((t, i) => (
        <text key={i} x={pad.l - 6} y={t.y + 4} textAnchor="end"
          fontSize={9} fill="currentColor" fillOpacity={0.4}
          className="font-mono"
        >
          {t.val >= 100 ? `$${(t.val / 100).toFixed(0)}` : t.val.toFixed(0)}
        </text>
      ))}

      {/* X labels */}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={toX(i)} y={H - 6} textAnchor="middle"
          fontSize={8.5} fill="currentColor" fillOpacity={0.4}
        >{label}</text>
      ))}

      {/* Area + Line per key */}
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

// ─── Donut Chart (platform split) ────────────────────────────────────────────

function DonutChart({ slices, size = 80 }: {
  slices: Array<{ value: number; color: string; label: string }>;
  size?: number;
}) {
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  const r = 28;
  const cx = size / 2;
  const cy = size / 2;
  let startAngle = -Math.PI / 2;

  const arcs = slices.map(sl => {
    const angle = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    startAngle += angle;
    const x2 = cx + r * Math.cos(startAngle);
    const y2 = cy + r * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    return { path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`, color: sl.color };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((arc, i) => (
        <path key={i} d={arc.path} fill={arc.color} fillOpacity={0.85} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--surface)" />
    </svg>
  );
}

function KPICard({
  label, value, delta, icon: Icon, isLoading,
}: {
  label: string;
  value: string;
  delta?: number | null;
  icon: React.ElementType;
  isLoading?: boolean;
}) {
  const isSpend = label.toLowerCase().includes('spend') || label.toLowerCase().includes('cost');
  const positive = delta != null && delta > 0;
  const negative = delta != null && delta < 0;
  const deltaGood = isSpend ? negative : positive;

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
              deltaGood ? 'text-[#10B981]' : 'text-[#EF4444]'
            }`}>
              {deltaGood ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {deltaGood ? 'Trending up ' : 'Trending down '}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdsDashboard() {
  const navigate = useNavigate();
  const [preset, setPreset]     = useState('LAST_30');
  const [platform, setPlatform] = useState<'ALL' | 'GOOGLE' | 'FACEBOOK'>('ALL');
  const [chartMetric, setChartMetric] = useState<'spend' | 'leads'>('spend');

  const { data: rawMetrics, isLoading: isMetricsLoading, refetch } = useAdDashboardMetrics({ preset, platform });
  const { data: rawChart,   isLoading: isChartLoading }            = useAdChartData({ preset, platform });
  const { data: rawCampaigns = [] } = useAdCampaigns();
  const { data: accounts = [] }     = useAdAccounts();

  const metrics   = rawMetrics;
  const chartData = rawChart ?? [];
  const campaigns = rawCampaigns as any[];

  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');
  const googleSpend     = campaigns.filter((c: any) => c.platform === 'GOOGLE').reduce((s: number, c: any) => s + (c.cachedSpend30dCents || 0), 0);
  const fbSpend         = campaigns.filter((c: any) => c.platform === 'FACEBOOK').reduce((s: number, c: any) => s + (c.cachedSpend30dCents || 0), 0);

  const lastSyncAt = accounts
    .filter(a => a.lastSyncAt)
    .sort((a, b) => new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime())[0]?.lastSyncAt;

  const syncMinutesAgo = lastSyncAt
    ? Math.round((Date.now() - new Date(lastSyncAt).getTime()) / 60_000)
    : null;

  // Chart data transform
  const chartSeries = useMemo(() => {
    if (chartMetric === 'spend') {
      return {
        keys: ['googleSpendCents', 'facebookSpendCents'],
        colors: ['#4285F4', '#1877F2'],
        labels: ['Google Spend', 'Meta Spend'],
      };
    }
    return {
      keys: ['googleLeads', 'facebookLeads'],
      colors: ['#4285F4', '#1877F2'],
      labels: ['Google Leads', 'Meta Leads'],
    };
  }, [chartMetric]);

  // Total impressions + clicks from active campaigns
  const totalImpressions = activeCampaigns.reduce((s: number, c: any) => s + (c.impressions30d ?? 0), 0);
  const totalClicks      = activeCampaigns.reduce((s: number, c: any) => s + (c.clicks30d ?? 0), 0);
  const avgCtr           = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">

      {/* ── Unified Toolbar ─────────────────────────────────────────── */}
      <div className="px-8 flex items-center justify-between border-b border-border bg-surface relative shadow-[0_4px_16px_rgba(0,0,0,0.03)] h-[73px] shrink-0">
        {/* Left */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-[13px] font-medium text-text-main bg-surface-hover border-border">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            <span>Overview</span>
          </div>
          <div className="w-[1px] h-5 bg-border mx-2" />
          {/* Platform filter */}
          <div className="flex items-center gap-0.5 bg-background border border-border rounded-lg p-0.5">
            {(['ALL', 'GOOGLE', 'FACEBOOK'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                  platform === p ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {p === 'ALL' ? 'All Platforms' : p === 'GOOGLE' ? 'Google' : 'Meta'}
              </button>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Date range */}
          <div className="flex items-center gap-0.5 bg-background border border-border rounded-lg p-0.5">
            {DATE_RANGES.map(dr => (
              <button
                key={dr.value}
                onClick={() => setPreset(dr.value)}
                className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                  preset === dr.value ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Scrollable content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-8 mt-6 mb-8 space-y-5">

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Amount Spent"
          value={metrics?.totalSpendCents ? formatCurrency(metrics.totalSpendCents / 100) : '$0.00'}
          delta={metrics?.spendDeltaPct}
          icon={DollarSign}
          isLoading={isMetricsLoading}
        />
        <KPICard
          label="Total Leads"
          value={String(metrics?.totalLeads ?? 0)}
          delta={metrics?.leadsDeltaPct}
          icon={Users}
          isLoading={isMetricsLoading}
        />
        <KPICard
          label="Cost per Lead"
          value={metrics?.costPerLeadCents ? formatCurrency(metrics.costPerLeadCents / 100) : '—'}
          icon={MousePointerClick}
          isLoading={isMetricsLoading}
        />
        <KPICard
          label="Active Campaigns"
          value={String(metrics?.activeCampaigns ?? 0)}
          icon={Activity}
          isLoading={isMetricsLoading}
        />
        <KPICard
          label="Impressions"
          value={totalImpressions >= 1000 ? `${(totalImpressions / 1000).toFixed(1)}K` : String(totalImpressions)}
          icon={Eye}
          isLoading={isMetricsLoading}
        />
        <KPICard
          label="Avg. CTR"
          value={`${(avgCtr * 100).toFixed(2)}%`}
          icon={TrendingUp}
          isLoading={isMetricsLoading}
        />
      </div>

      {/* ── Main chart + platform split ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* Time series chart */}
        <div className="lg:col-span-3 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Performance Over Time</h3>
              <p className="text-[12px] text-text-muted mt-0.5">Google + Meta combined · {DATE_RANGES.find(d => d.value === preset)?.label}</p>
            </div>
            <div className="flex items-center gap-0.5 bg-bg border border-border rounded-lg p-0.5">
              <button
                onClick={() => setChartMetric('spend')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  chartMetric === 'spend' ? 'bg-surface text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
                }`}
              >
                Spend
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
            {isChartLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <AreaChart
                data={chartData as any}
                keys={chartSeries.keys}
                colors={chartSeries.colors}
                height={200}
              />
            )}
          </div>
        </div>

        {/* Platform split */}
        <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md shrink-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Platform Split</h3>
            <p className="text-[12px] text-text-muted mt-0.5">Spend distribution</p>
          </div>

          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-center">
            <DonutChart
              size={100}
              slices={[
                { value: googleSpend, color: '#4285F4', label: 'Google' },
                { value: fbSpend,     color: '#1877F2', label: 'Meta' },
              ]}
            />
          </div>

          <div className="space-y-3">
            {[
              { platform: 'Google', spend: googleSpend, color: '#4285F4', colorClass: 'bg-blue-500' },
              { platform: 'Meta',   spend: fbSpend,     color: '#1877F2', colorClass: 'bg-blue-700' },
            ].map(p => {
              const total = googleSpend + fbSpend || 1;
              const pct   = ((p.spend / total) * 100).toFixed(1);
              return (
                <div key={p.platform}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${p.colorClass}`} />
                      <span className="text-[12px] font-medium text-text-main">{p.platform}</span>
                    </div>
                    <span className="text-[12px] text-text-muted tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: p.color }}
                    />
                  </div>
                  <div className="text-[11px] text-text-muted mt-1 tabular-nums">
                    {formatCurrency(p.spend / 100)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>

      {/* ── Active campaigns strip ──────────────────────────────────── */}
      <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md">
          <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Active Campaigns</h3>
          <button
            onClick={() => navigate('/ads/campaigns')}
            className="text-[12px] text-primary font-medium hover:underline underline-offset-2"
          >
            View all campaigns →
          </button>
        </div>

        {activeCampaigns.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <BarChart3 className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-text-muted">No active campaigns</p>
            <button
              onClick={() => navigate('/ads/campaigns/new')}
              className="mt-3 text-[12px] text-primary font-medium hover:underline underline-offset-2"
            >
              Create your first campaign
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {activeCampaigns.slice(0, 5).map((c: any) => {
              const totalSpendAll = activeCampaigns.reduce((s: number, x: any) => s + x.cachedSpend30dCents, 0) || 1;
              const pct = Math.min(100, (c.cachedSpend30dCents / totalSpendAll) * 100);
              const isGoogle = c.platform === 'GOOGLE';

              return (
                <div
                  key={c.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-background/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/ads/campaigns/${c.id}`)}
                >
                  {/* Platform dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isGoogle ? 'bg-blue-500' : 'bg-blue-700'}`} />

                  {/* Name + type */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-text-main truncate">{c.name}</p>
                    <p className="text-[11px] text-text-muted">
                      {isGoogle ? 'Google' : 'Meta'} · {c.adType.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </p>
                  </div>

                  {/* Spend bar */}
                  <div className="w-32 hidden sm:block">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-text-muted">Spend</span>
                      <span className="text-[10px] text-text-muted">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: isGoogle ? '#4285F4' : '#1877F2' }}
                      />
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-text-main tabular-nums">
                      {formatCurrency(c.cachedSpend30dCents / 100)}
                    </p>
                    <p className="text-[11px] text-text-muted tabular-nums">
                      {c.cachedLeads30d} leads · {(c.cachedCtr30d * 100).toFixed(2)}% CTR
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

        </div>
      </div>
    </div>
  );
}
