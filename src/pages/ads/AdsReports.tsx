import { useState } from 'react';
import { Download, BarChart3, TrendingUp, Users, DollarSign, Calendar, RefreshCw, CheckCircle, Clock, XCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAdCampaigns } from '../../hooks/useAdCampaigns';
import { useAdDashboardMetrics, useAdChartData } from '../../hooks/useAdMetrics';
import { useAdLeads } from '../../hooks/useAdLeads';
import { formatCurrency } from '../../lib/utils';
import type { AdCampaign, AdLead, DailyMetricPoint } from '../../types/ads';

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
    description: 'Daily trend trajectory, volume changes, and conversion rates.',
    icon: TrendingUp,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
];

const PRESETS = [
  { label: 'Last 7 days', value: 'LAST_7' },
  { label: 'Last 30 days', value: 'LAST_30' },
  { label: 'Last 90 days', value: 'LAST_90' },
  { label: 'This month', value: 'THIS_MONTH' },
];

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function AdsReports() {
  const [selectedReport, setSelectedReport] = useState('performance');
  const [preset, setPreset] = useState<string>('LAST_30');

  const { data: campaignsData, isLoading: campaignsLoading } = useAdCampaigns({ status: 'ALL' });
  const { data: metricsData, isLoading: metricsLoading } = useAdDashboardMetrics({ preset });
  const { data: chartData, isLoading: chartLoading } = useAdChartData({ preset });
  const { data: leadsData, isLoading: leadsLoading } = useAdLeads({ pageSize: 100 });

  const campaigns: AdCampaign[] = (campaignsData as any) || [];
  const leads: AdLead[] = (leadsData?.data as any) || [];
  const dailyMetrics: DailyMetricPoint[] = (chartData as any) || [];

  const totalSpendCents = metricsData?.totalSpendCents || campaigns.reduce((acc: number, c: any) => acc + (c.cachedSpend30dCents || 0), 0);
  const totalLeads = metricsData?.totalLeads || campaigns.reduce((acc: number, c: any) => acc + (c.cachedLeads30d || 0), 0);
  const totalClicks = campaigns.reduce((acc: number, c: any) => acc + (c.clicks30d || 0), 0);
  const totalImpressions = campaigns.reduce((acc: number, c: any) => acc + (c.impressions30d || 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) : (campaigns.length > 0 ? campaigns.reduce((acc: number, c: any) => acc + (c.cachedCtr30d || 0), 0) / campaigns.length : 0);
  const costPerLead = totalLeads > 0 ? (totalSpendCents / totalLeads) : null;

  const handleExport = () => {
    if (selectedReport === 'performance') {
      const headers = ['Campaign Name', 'Platform', 'Status', 'Spend ($)', 'Leads', 'CTR (%)', 'Budget ($)', 'Budget Type'];
      const rows = campaigns.map((c: any) => [
        c.name,
        c.platform,
        c.status,
        ((c.cachedSpend30dCents || 0) / 100).toFixed(2),
        c.cachedLeads30d || 0,
        ((c.cachedCtr30d || 0) * 100).toFixed(2),
        ((c.budgetAmountCents || 0) / 100).toFixed(2),
        c.budgetType,
      ]);
      downloadCsv('ads_campaign_performance_report', [headers, ...rows]);
    } else if (selectedReport === 'leads') {
      const headers = ['Lead Name', 'Email', 'Phone', 'Platform', 'CRM Sync Status', 'Captured Date'];
      const rows = leads.map((l: any) => [
        l.leadName || 'Anonymous',
        l.leadEmail || '',
        l.leadPhone || '',
        l.platform,
        l.syncStatus,
        l.capturedAt,
      ]);
      downloadCsv('ads_leads_generation_report', [headers, ...rows]);
    } else if (selectedReport === 'spend') {
      const headers = ['Campaign Name', 'Platform', 'Spend ($)', 'Budget ($)', 'Budget Type', 'Schedule'];
      const rows = campaigns.map((c: any) => [
        c.name,
        c.platform,
        ((c.cachedSpend30dCents || 0) / 100).toFixed(2),
        ((c.budgetAmountCents || 0) / 100).toFixed(2),
        c.budgetType,
        c.scheduleType,
      ]);
      downloadCsv('ads_spend_summary_report', [headers, ...rows]);
    } else {
      const headers = ['Date', 'Spend ($)', 'Leads', 'Clicks', 'Impressions', 'CTR (%)'];
      const rows = dailyMetrics.map((d: any) => [
        d.date,
        ((d.spendCents || 0) / 100).toFixed(2),
        d.leads || 0,
        d.clicks || 0,
        d.impressions || 0,
        ((d.ctr || 0) * 100).toFixed(2),
      ]);
      downloadCsv('ads_trend_analysis_report', [headers, ...rows]);
    }
  };

  const isLoading = campaignsLoading || metricsLoading || leadsLoading;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-text-main">Reports & Analytics</h2>
          <p className="text-[12px] text-text-muted mt-0.5">Export and analyze campaign performance data</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
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
          {PRESETS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreset(p.value)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                preset === p.value ? 'bg-surface text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {p.label}
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
              type="button"
              onClick={() => setSelectedReport(rt.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedReport === rt.id
                  ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
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

      {/* Report Content */}
      <div className="space-y-6">
        {/* KPI Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-surface border border-border rounded-xl">
          <div>
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block mb-1">Total Spend</span>
            <span className="text-xl font-black text-text-main tabular-nums">{formatCurrency(totalSpendCents / 100)}</span>
          </div>
          <div>
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block mb-1">Total Leads</span>
            <span className="text-xl font-black text-text-main tabular-nums">{totalLeads}</span>
          </div>
          <div>
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block mb-1">Cost Per Lead</span>
            <span className="text-xl font-black text-text-main tabular-nums">{costPerLead ? formatCurrency(costPerLead / 100) : '—'}</span>
          </div>
          <div>
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block mb-1">Avg. CTR</span>
            <span className="text-xl font-black text-text-main tabular-nums">{(avgCtr * 100).toFixed(2)}%</span>
          </div>
        </div>

        {/* ── Report 1: Performance ── */}
        {selectedReport === 'performance' && (
          <div className="border border-border rounded-xl overflow-hidden bg-surface">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-main">Campaign Performance Breakdown</h3>
              <span className="text-xs text-text-muted">{campaigns.length} campaigns</span>
            </div>
            {campaigns.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-sm">No campaigns found</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-background/60 border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Campaign</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Platform</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Spend</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Leads</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">CTR</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {campaigns.map(c => (
                    <tr key={c.id} className="hover:bg-surface/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-[13px] text-text-main">{c.name}</td>
                      <td className="px-4 py-3 text-[12px] text-text-muted">{c.platform === 'GOOGLE' ? 'Google' : 'Meta'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10 text-text-muted'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-main text-right">{formatCurrency((c.cachedSpend30dCents || 0) / 100)}</td>
                      <td className="px-4 py-3 text-[13px] font-medium text-text-main text-right">{c.cachedLeads30d || 0}</td>
                      <td className="px-4 py-3 text-[13px] text-text-main text-right">{((c.cachedCtr30d || 0) * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-[13px] text-text-muted text-right">{formatCurrency((c.budgetAmountCents || 0) / 100)}/{c.budgetType === 'DAILY' ? 'd' : 'total'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Report 2: Leads ── */}
        {selectedReport === 'leads' && (
          <div className="border border-border rounded-xl overflow-hidden bg-surface">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-main">Lead Generation Log</h3>
              <span className="text-xs text-text-muted">{leads.length} leads</span>
            </div>
            {leads.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-sm">No leads recorded yet</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-background/60 border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Lead Name</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Contact Info</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Platform</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">CRM Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {leads.map((l: any) => (
                    <tr key={l.id} className="hover:bg-surface/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-[13px] text-text-main">{l.leadName || 'Anonymous'}</td>
                      <td className="px-4 py-3 text-[12px] text-text-muted">{l.leadEmail || l.leadPhone || '—'}</td>
                      <td className="px-4 py-3 text-[12px] text-text-muted">{l.platform}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          l.syncStatus === 'SYNCED' ? 'text-green-500' : l.syncStatus === 'PENDING' ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          {l.syncStatus === 'SYNCED' ? <CheckCircle className="w-3.5 h-3.5" /> : l.syncStatus === 'PENDING' ? <Clock className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {l.syncStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-text-muted text-right">{l.capturedAt ? new Date(l.capturedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Report 3: Spend Summary ── */}
        {selectedReport === 'spend' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 border border-border rounded-xl bg-surface">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">Spend by Platform</h4>
                <div className="space-y-3">
                  {['GOOGLE', 'META'].map((plat: string) => {
                    const platSpend = campaigns.filter((c: any) => c.platform === plat).reduce((acc: number, c: any) => acc + (c.cachedSpend30dCents || 0), 0);
                    const pct = totalSpendCents > 0 ? (platSpend / totalSpendCents) * 100 : 0;
                    return (
                      <div key={plat} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-text-main">{plat === 'GOOGLE' ? 'Google Ads' : 'Meta Ads'}</span>
                          <span className="text-text-muted">{formatCurrency(platSpend / 100)} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                          <div className={`h-full ${plat === 'GOOGLE' ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 border border-border rounded-xl bg-surface">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">Budget Allocations</h4>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Total Active Campaigns</dt>
                    <dd className="font-bold text-text-main">{campaigns.filter((c: any) => c.status === 'ACTIVE').length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">Total Daily Commitment</dt>
                    <dd className="font-bold text-text-main">
                      {formatCurrency(campaigns.filter((c: any) => c.budgetType === 'DAILY' && c.status === 'ACTIVE').reduce((acc: number, c: any) => acc + (c.budgetAmountCents || 0), 0) / 100)}/day
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* ── Report 4: Trends ── */}
        {selectedReport === 'trends' && (
          <div className="border border-border rounded-xl overflow-hidden bg-surface">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-main">Daily Performance Snapshot</h3>
              <span className="text-xs text-text-muted">{dailyMetrics.length} days recorded</span>
            </div>
            {dailyMetrics.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-sm">No trend data available for this range</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-background/60 border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Date</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Spend</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Leads</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Clicks</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Impressions</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {dailyMetrics.map((d: any) => (
                    <tr key={d.date} className="hover:bg-surface/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-[13px] text-text-main">{d.date}</td>
                      <td className="px-4 py-3 text-[13px] text-text-main text-right">{formatCurrency((d.spendCents || 0) / 100)}</td>
                      <td className="px-4 py-3 text-[13px] font-medium text-text-main text-right">{d.leads || 0}</td>
                      <td className="px-4 py-3 text-[13px] text-text-main text-right">{d.clicks || 0}</td>
                      <td className="px-4 py-3 text-[13px] text-text-main text-right">{d.impressions || 0}</td>
                      <td className="px-4 py-3 text-[13px] text-text-main text-right">{((d.ctr || 0) * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
