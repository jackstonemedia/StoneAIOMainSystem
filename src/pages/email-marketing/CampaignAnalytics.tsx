/**
 * Campaign Analytics Dashboard — Email Marketing Module
 *
 * Rich CRM-style Dashboard providing comprehensive campaign performance metrics,
 * open/click conversion rates, engagement progress bars, and historical comparisons.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import {
  BarChart2, Mail, CheckCircle2, Eye, MousePointer, AlertTriangle,
  UserMinus, TrendingUp, Loader2, ChevronDown, Calendar, Search, Filter,
  Sparkles, RefreshCw, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';

const api = {
  getCampaigns: () => apiClient.get('/email-marketing/campaigns').then(r => r.data),
  getAnalytics: (id: string) => apiClient.get(`/email-marketing/campaigns/${id}/analytics`).then(r => r.data),
};

function pct(rate: number) {
  return `${((rate || 0) * 100).toFixed(1)}%`;
}

export default function CampaignAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedId = searchParams.get('campaign') || '';
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const { data: campaigns = [], isLoading: isCampaignsLoading } = useQuery({
    queryKey: ['email-marketing', 'campaigns'],
    queryFn: api.getCampaigns,
  });

  // Filter sent/sending campaigns
  const sentCampaigns = useMemo(() => {
    return campaigns.filter((c: any) => c.status === 'SENT' || c.status === 'SENDING');
  }, [campaigns]);

  // Default to first sent campaign if none in query param
  const activeCampaignId = selectedId || (sentCampaigns.length > 0 ? sentCampaigns[0].id : '');

  const { data, isLoading, error } = useQuery({
    queryKey: ['email-marketing', 'analytics', activeCampaignId],
    queryFn: () => api.getAnalytics(activeCampaignId),
    enabled: !!activeCampaignId,
    staleTime: 30_000,
  });

  const activeCampaign = useMemo(() => {
    return campaigns.find((c: any) => c.id === activeCampaignId);
  }, [campaigns, activeCampaignId]);

  const m = data?.metrics || {
    sent: 0,
    delivered: 0,
    uniqueOpens: 0,
    totalOpens: 0,
    openRate: 0,
    uniqueClicks: 0,
    totalClicks: 0,
    clickRate: 0,
    clickToOpenRate: 0,
    bouncesHard: 0,
    bouncesSoft: 0,
    complaints: 0,
    unsubscribes: 0,
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0 bg-bg text-text-main min-h-screen">
      {/* Full-tab frosted glass backdrop */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Top Header Portal for Controls */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          {/* Campaign Selector Dropdown */}
          <div className="relative">
            <select
              value={activeCampaignId}
              onChange={e => setSearchParams(e.target.value ? { campaign: e.target.value } : {})}
              className="appearance-none bg-surface border border-border/60 text-text-main rounded-full pl-4 pr-9 py-1.5 text-[13px] font-medium focus:outline-none focus:border-primary transition-all cursor-pointer hover:border-border"
            >
              {sentCampaigns.length === 0 && <option value="">No sent campaigns yet</option>}
              {sentCampaigns.map((c: any) => (
                <option key={c.id} value={c.id}>
                  📊 {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-1 bg-surface-hover/50 p-1 rounded-full border border-border/50 text-xs">
            {[
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '90d', label: '90D' },
              { id: 'all', label: 'All' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setDateRange(r.id as any)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                  dateRange === r.id ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </HeaderPortal>

      {/* Main Dashboard Content */}
      <div className="flex-1 overflow-auto p-8 space-y-6">
        
        {/* Active Campaign Overview Banner */}
        <div className="bg-surface/40 border border-border/50 rounded-2xl p-6 backdrop-blur-md shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent-green/10 text-accent-green border border-accent-green/20">
                Live Campaign Data
              </span>
              {activeCampaign?.sentAtUtc && (
                <span className="text-[12px] text-text-muted">
                  Sent on {new Date(activeCampaign.sentAtUtc).toLocaleDateString()}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-text-main tracking-tight">
              {activeCampaign?.name || 'Campaign Overview'}
            </h2>
            <p className="text-[13px] text-text-muted">
              Subject: <span className="text-text-main font-medium">{activeCampaign?.subject || 'N/A'}</span>
            </p>
          </div>

          <button
            onClick={() => navigate('/email-marketing/campaigns')}
            className="btn-secondary self-start md:self-auto flex items-center gap-2"
          >
            <Mail className="w-4 h-4 text-primary" /> View All Campaigns
          </button>
        </div>

        {/* ── Dashboard KPI Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Sent / Delivered */}
          <div className="bg-surface/40 border border-border/50 rounded-xl p-5 backdrop-blur-md shadow-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Delivered</span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-main">{m.delivered.toLocaleString()}</div>
            <div className="text-[11px] text-text-muted flex items-center gap-1">
              Out of <span className="font-semibold text-text-main">{m.sent.toLocaleString()}</span> sent
            </div>
          </div>

          {/* Open Rate */}
          <div className="bg-surface/40 border border-border/50 rounded-xl p-5 backdrop-blur-md shadow-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Open Rate</span>
              <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-accent-green">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-main">{pct(m.openRate)}</div>
            <div className="text-[11px] text-text-muted flex items-center gap-1">
              <span className="font-semibold text-text-main">{m.uniqueOpens.toLocaleString()}</span> unique opens ({m.totalOpens.toLocaleString()} total)
            </div>
          </div>

          {/* Click Rate */}
          <div className="bg-surface/40 border border-border/50 rounded-xl p-5 backdrop-blur-md shadow-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Click Rate</span>
              <div className="w-8 h-8 rounded-lg bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center text-accent-purple">
                <MousePointer className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-main">{pct(m.clickRate)}</div>
            <div className="text-[11px] text-text-muted flex items-center gap-1">
              <span className="font-semibold text-text-main">{m.uniqueClicks.toLocaleString()}</span> unique clicks ({m.totalClicks.toLocaleString()} total)
            </div>
          </div>

          {/* Unsubscribes / Bounces */}
          <div className="bg-surface/40 border border-border/50 rounded-xl p-5 backdrop-blur-md shadow-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Unsubscribes</span>
              <div className="w-8 h-8 rounded-lg bg-accent-amber/10 border border-accent-amber/20 flex items-center justify-center text-accent-amber">
                <UserMinus className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-main">{m.unsubscribes.toLocaleString()}</div>
            <div className="text-[11px] text-text-muted flex items-center gap-1">
              Bounces: <span className="font-semibold text-text-main">{m.bouncesHard + m.bouncesSoft}</span>
            </div>
          </div>
        </div>

        {/* ── Engagement Funnel / Progress Bars Panel ── */}
        <div className="bg-surface/40 border border-border/50 rounded-2xl p-6 backdrop-blur-md shadow-card space-y-5">
          <h3 className="text-[15px] font-bold text-text-main flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Engagement Conversion Funnel
          </h3>

          <div className="space-y-4">
            {/* Delivery Progress Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-text-muted">Delivery Rate</span>
                <span className="text-text-main">{m.sent > 0 ? pct(m.delivered / m.sent) : '0.0%'}</span>
              </div>
              <div className="w-full bg-surface-hover rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-500" 
                  style={{ width: m.sent > 0 ? `${(m.delivered / m.sent) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* Open Rate Progress Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-text-muted">Open Rate</span>
                <span className="text-text-main">{pct(m.openRate)}</span>
              </div>
              <div className="w-full bg-surface-hover rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-accent-green h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(m.openRate * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Click-to-Open Progress Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-text-muted">Click-To-Open (CTOR)</span>
                <span className="text-text-main">{pct(m.clickToOpenRate)}</span>
              </div>
              <div className="w-full bg-surface-hover rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-accent-purple h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(m.clickToOpenRate * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Sent Campaigns Overview Table Container ── */}
        <div className="rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between">
            <span className="text-[13px] font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Sent Campaign Analytics Breakdown
            </span>
            <span className="text-[11px] text-text-muted font-medium">
              Showing {sentCampaigns.length} Sent Campaign{sentCampaigns.length === 1 ? '' : 's'}
            </span>
          </div>

          <table className="w-full text-left">
            <thead className="border-b border-border/50 bg-surface/80 text-text-muted text-[12px] font-semibold">
              <tr>
                <th className="p-3 pl-6">Campaign</th>
                <th className="p-3">Delivered</th>
                <th className="p-3">Unique Opens</th>
                <th className="p-3">Open Rate</th>
                <th className="p-3">Click Rate</th>
                <th className="p-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sentCampaigns.map((c: any) => {
                const isSelected = c.id === activeCampaignId;
                const delivered = isSelected ? m.delivered : (c.stats?.delivered ?? c._count?.recipients ?? 0);
                const uniqueOpens = isSelected ? m.uniqueOpens : (c.stats?.uniqueOpens ?? 0);
                const openRate = isSelected ? m.openRate : (c.stats?.openRate ?? 0);
                const clickRate = isSelected ? m.clickRate : (c.stats?.clickRate ?? 0);

                return (
                  <tr 
                    key={c.id} 
                    onClick={() => setSearchParams({ campaign: c.id })}
                    className={`border-b border-border/50 text-[13px] transition-colors cursor-pointer ${isSelected ? 'bg-primary/10' : 'hover:bg-black/5'}`}
                  >
                    <td className="p-3 pl-6 font-semibold text-text-main">{c.name}</td>
                    <td className="p-3 text-text-muted">{delivered.toLocaleString()}</td>
                    <td className="p-3 text-text-muted">{uniqueOpens.toLocaleString()}</td>
                    <td className="p-3 font-semibold text-accent-green">{pct(openRate)}</td>
                    <td className="p-3 font-semibold text-accent-purple">{pct(clickRate)}</td>
                    <td className="p-3 pr-6 text-right">
                      <button 
                        onClick={() => setSearchParams({ campaign: c.id })}
                        className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all"
                      >
                        View Report
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Controls & Counter matching Campaigns section */}
      <div 
        className="pr-8 pl-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
        style={{ 
          background: 'var(--sidebar-bg)', 
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
        } as React.CSSProperties}
      >
        <span className="text-[12px] text-text-muted font-medium">
          Dashboard metrics synced live from email transport worker
        </span>
        <div className="flex items-center gap-3 font-semibold">
          <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Prev</button>
          <button className="px-3 py-0.5 rounded-[6px] shadow-sm bg-primary text-white font-bold text-[12px]">1</button>
          <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Next</button>
        </div>
      </div>
    </div>
  );
}
