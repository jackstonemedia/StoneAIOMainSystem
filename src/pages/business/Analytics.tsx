import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, Bot, Zap, Mail, ArrowUpRight, ArrowDownRight, BarChart3, Activity, Download } from 'lucide-react';
import { MetricCard } from '../../components/ui/MetricCard';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';

const PERIODS = ['7d', '30d', '90d', '1y'] as const;

function AreaChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const w = 400, h = 120;
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - ((v - min) / range) * (h - 12) }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `M0,${h} L${pts.map(p => `${p.x},${p.y}`).join(' L')} L${w},${h} Z`;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g-${label})`} />
        <path d={line} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => i === data.length - 1 && (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} stroke="var(--surface)" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        {months.map(m => <span key={m} className="text-[10px] text-text-muted">{m}</span>)}
      </div>
    </div>
  );
}

function FunnelChart({ stages }: { stages: { name: string; count: number; pct: number; color: string }[] }) {
  const max = Math.max(...stages.map(s => s.count));
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-text-main font-medium">{s.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted">{s.count} deals</span>
              <span className="text-xs font-semibold" style={{ color: s.color }}>{s.pct}%</span>
            </div>
          </div>
          <div className="h-2.5 bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(s.count / max) * 100}%`, backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}60` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState<typeof PERIODS[number]>('30d');
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch('/api/business/metrics')
      .then(r => r.ok ? r.json() : null)
      .then(d => setMetrics(d))
      .catch(() => {});
  }, []);

  const agentPerformance = metrics?.agentPerformance || [
    { name: 'Lead Scorer',      runs: 1420, success: 98.2, avgTime: '1.2s',  credits: 2840  },
    { name: 'Email Drafter',    runs: 842,  success: 96.8, avgTime: '3.4s',  credits: 5890  },
    { name: 'SEO Analyzer',     runs: 320,  success: 94.1, avgTime: '12.1s', credits: 9600  },
    { name: 'Sentiment Tagger', runs: 2100, success: 99.1, avgTime: '0.8s',  credits: 1680  },
  ];
  const campaignMetrics = metrics?.campaigns || [
    { name: 'Black Friday VIP',      sent: 14500, opens: 42.5, clicks: 18.2, conversions: 6.8 },
    { name: 'Abandoned Cart Series', sent: 320,   opens: 0,    clicks: 0,    conversions: 0   },
    { name: 'Q4 Newsletter',         sent: 22000, opens: 34.1, clicks: 11.4, conversions: 3.2 },
  ];

  const funnelData = [
    { name: 'Lead',        count: 45, pct: 100, color: '#64748b' },
    { name: 'Qualified',   count: 28, pct: 62,  color: '#818cf8' },
    { name: 'Proposal',    count: 15, pct: 33,  color: '#fbbf24' },
    { name: 'Negotiation', count: 8,  pct: 18,  color: '#a78bfa' },
    { name: 'Won',         count: 18, pct: 40,  color: '#34d399' },
  ];

  const agentCols = [
    { key: 'name', label: 'Agent', sortable: true },
    { key: 'runs', label: 'Runs', sortable: true, render: (v: number) => v.toLocaleString() },
    {
      key: 'success', label: 'Success Rate', sortable: true,
      render: (v: number) => (
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: v > 97 ? '#34d399' : v > 93 ? '#fbbf24' : '#fb7185' }} />
          </div>
          <span className="text-sm font-medium">{v}%</span>
        </div>
      )
    },
    { key: 'avgTime', label: 'Avg Time' },
    { key: 'credits', label: 'Credits', sortable: true, render: (v: number) => v.toLocaleString() },
  ];

  const campaignCols = [
    { key: 'name', label: 'Campaign', sortable: true },
    { key: 'sent', label: 'Sent', sortable: true, render: (v: number) => v.toLocaleString() },
    {
      key: 'opens', label: 'Open Rate',
      render: (v: number) => v > 0 ? (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(v, 100)}%` }} />
          </div>
          <span>{v}%</span>
        </div>
      ) : <span className="text-text-muted">—</span>
    },
    { key: 'clicks', label: 'Click Rate', render: (v: number) => v > 0 ? `${v}%` : <span className="text-text-muted">—</span> },
    { key: 'conversions', label: 'Conversions', render: (v: number) => <span className={`font-semibold ${v > 0 ? 'text-emerald-400' : 'text-text-muted'}`}>{v > 0 ? `${v}%` : '—'}</span> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Analytics"
        subtitle="Monitor performance across your entire business"
        breadcrumb={['Business', 'Analytics']}
        actions={
          <>
            <div className="flex bg-surface p-1 rounded-lg border border-border">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${period === p ? 'bg-bg text-primary border border-border shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button className="btn-secondary text-sm py-2 px-4">
              <Download className="w-4 h-4" /> Export
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 stagger-children">
            <MetricCard label="Monthly Revenue"  value="$48,250" change="+12.5%" trend="up"   icon={DollarSign} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" sparkline={[38,42,41,55,52,62,58,71,68,78,82,92]} delay={0}   />
            <MetricCard label="Pipeline Value"   value="$182,400" change="+8.2%"  trend="up"   icon={TrendingUp}  iconColor="text-blue-400"    iconBg="bg-blue-500/10"    sparkline={[120,130,118,145,140,160,155,175,170,185,195,210]} delay={60}  />
            <MetricCard label="Agent Runs (30d)" value="4,682"   change="+34%"   trend="up"   icon={Bot}         iconColor="text-purple-400"  iconBg="bg-purple-500/10"  sparkline={[200,280,350,380,420,480,510,560,590,640,680,720]} delay={120} />
            <MetricCard label="Credits Used"     value="19,210"  change="+18%"   trend="up"   icon={Zap}         iconColor="text-amber-400"   iconBg="bg-amber-500/10"   sparkline={[1200,1400,1600,1650,1700,1800,1900,2100,2200,2400,2500,2660]} delay={180} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-2 gap-6">
            <div className="card-surface p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-text-main flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Revenue Over Time
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">12-month rolling — all sources</p>
                </div>
                <span className="badge badge-success">+12.5%</span>
              </div>
              <AreaChart data={[38,42,41,55,52,62,58,71,68,78,82,92]} color="var(--primary)" label="revenue" />
            </div>

            <div className="card-surface p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-text-main flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" /> Agent Runs Over Time
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">Automated executions per month</p>
                </div>
                <span className="badge badge-info">+34%</span>
              </div>
              <AreaChart data={[200,280,350,380,420,480,510,560,590,640,680,720]} color="#a78bfa" label="agents" />
            </div>
          </div>

          {/* Funnel + Campaign overview */}
          <div className="grid grid-cols-5 gap-6">
            <div className="col-span-2 card-surface p-6">
              <h3 className="font-semibold text-text-main mb-5">Pipeline Conversion Funnel</h3>
              <FunnelChart stages={funnelData} />
              <div className="mt-5 pt-5 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Lead → Won conversion</span>
                  <span className="font-bold text-emerald-400">40%</span>
                </div>
              </div>
            </div>

            <div className="col-span-3 card-surface overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-text-main flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" /> Campaign Performance
                </h3>
              </div>
              <DataTable
                columns={campaignCols as any}
                data={campaignMetrics}
                rowKey={(r: any) => r.name}
              />
            </div>
          </div>

          {/* Agent Performance Table */}
          <div className="card-surface overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-text-main flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" /> Agent Performance
              </h3>
            </div>
            <DataTable
              columns={agentCols as any}
              data={agentPerformance}
              searchable
              searchPlaceholder="Search agents..."
              rowKey={(r: any) => r.name}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
