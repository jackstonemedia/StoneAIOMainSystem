/**
 * Campaign Analytics Dashboard — Email Marketing Module
 *
 * Rich CRM-style Dashboard providing comprehensive campaign performance metrics,
 * A/B Split Testing comparative breakdown with statistical significance / confidence meters,
 * winner selection & rollout triggers, engagement funnels, and recipient activity logs.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient, extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import {
  BarChart2, Mail, CheckCircle2, Eye, MousePointer, AlertTriangle,
  UserMinus, TrendingUp, Loader2, ChevronDown, Calendar, Search, Filter,
  Sparkles, RefreshCw, ArrowUpRight, ArrowDownRight, Layers, Split,
  Crown, Check, Zap, ArrowRight, ShieldCheck, Trophy, HelpCircle, Users, X,
  Flame, Clock, UserCheck, MessageSquare
} from 'lucide-react';

const api = {
  getCampaigns: () => apiClient.get('/email-marketing/campaigns').then(r => r.data),
  getAnalytics: (id: string) => apiClient.get(`/email-marketing/campaigns/${id}/analytics`).then(r => r.data),
  selectWinner: (campaignId: string, winnerVariant: 'A' | 'B') =>
    apiClient.post(`/email-marketing/campaigns/${campaignId}/select-winner`, { winnerVariant }).then(r => r.data),
};

function pct(rate: number) {
  return `${((rate || 0) * 100).toFixed(1)}%`;
}

export default function CampaignAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const selectedId = searchParams.get('campaign') || '';
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [recipientVariantFilter, setRecipientVariantFilter] = useState<'ALL' | 'A' | 'B' | 'HOLD'>('ALL');
  const [showWinnerConfirmModal, setShowWinnerConfirmModal] = useState(false);
  const [selectedWinnerVariant, setSelectedWinnerVariant] = useState<'A' | 'B'>('A');

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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['email-marketing', 'analytics', activeCampaignId],
    queryFn: () => api.getAnalytics(activeCampaignId),
    enabled: !!activeCampaignId,
    staleTime: 15_000,
  });

  const selectWinnerMutation = useMutation({
    mutationFn: (winner: 'A' | 'B') => api.selectWinner(activeCampaignId, winner),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'analytics', activeCampaignId] });
      qc.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] });
      toast(
        'success',
        `Variant ${res.winnerVariant} Declared Winner!`,
        res.rolledOutCount > 0
          ? `Dispatched winning email to ${res.rolledOutCount} held recipients.`
          : 'Winning variant recorded successfully.'
      );
      setShowWinnerConfirmModal(false);
    },
    onError: (err: any) => {
      toast('error', 'Winner Rollout Error', extractApiError(err) || 'Failed to declare winner.');
    },
  });

  const { data: sequenceOverview } = useQuery({
    queryKey: ['email-marketing', 'sequence-overview', activeCampaignId],
    queryFn: () => apiClient.get(`/email-marketing/campaigns/${activeCampaignId}/sequence-overview`).then(r => r.data).catch(() => null),
    enabled: !!activeCampaignId,
    staleTime: 10_000,
  });

  const markReplyMutation = useMutation({
    mutationFn: (contactId: string) => apiClient.post(`/email-marketing/campaigns/${activeCampaignId}/recipients/${contactId}/reply`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'sequence-overview', activeCampaignId] });
      qc.invalidateQueries({ queryKey: ['email-marketing', 'analytics', activeCampaignId] });
      toast('success', 'Marked as Replied', 'Contact marked as replied. Further sequence emails halted.');
    },
    onError: (err: any) => {
      toast('error', 'Error', extractApiError(err) || 'Failed to mark contact as replied');
    }
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

  const ab = data?.abTest;
  const isAbTest = !!ab && ab.enabled;
  const recipientActivity = data?.recipientActivity || [];

  const filteredRecipients = useMemo(() => {
    if (recipientVariantFilter === 'ALL') return recipientActivity;
    if (recipientVariantFilter === 'HOLD') return recipientActivity.filter((r: any) => r.status === 'HOLD');
    return recipientActivity.filter((r: any) => r.variant === recipientVariantFilter && r.status !== 'HOLD');
  }, [recipientActivity, recipientVariantFilter]);

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
                  {c.abTestConfig?.enabled ? '⚡ [A/B] ' : '📊 '} {c.name}
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

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-full bg-surface border border-border text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
            title="Refresh analytics data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </HeaderPortal>

      {/* Main Dashboard Content */}
      <div className="flex-1 overflow-auto p-8 space-y-6">
        
        {/* Active Campaign Overview Banner */}
        <div className="bg-surface/40 border border-border/50 rounded-2xl p-6 backdrop-blur-md shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isAbTest ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Split className="w-3 h-3" /> A/B Split Test Campaign
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent-green/10 text-accent-green border border-accent-green/20">
                  Standard Broadcast
                </span>
              )}
              {activeCampaign?.sentAtUtc && (
                <span className="text-[12px] text-text-muted">
                  Dispatched on {new Date(activeCampaign.sentAtUtc).toLocaleDateString()}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-text-main tracking-tight">
              {activeCampaign?.name || 'Campaign Overview'}
            </h2>
            <p className="text-[13px] text-text-muted">
              Primary Subject: <span className="text-text-main font-medium">{activeCampaign?.subject || 'N/A'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/email-marketing/campaigns/${activeCampaignId}`)}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              Edit Campaign
            </button>
            <button
              onClick={() => navigate('/email-marketing/campaigns')}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-interactive flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" /> All Campaigns
            </button>
          </div>
        </div>

        {/* ── A/B SPLIT TEST COMPARATIVE PERFORMANCE SECTION ── */}
        {isAbTest && ab && (
          <div className="space-y-4">
            {/* A/B Header Banner & Winner Status */}
            <div className="bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-surface/40 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-md shadow-card space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                      {ab.isCompleted ? 'Test Completed' : 'A/B Test Active'}
                    </span>
                    <span className="text-xs text-text-muted">
                      Goal: <strong className="text-purple-300 uppercase">{ab.metricUsed === 'open_rate' ? 'Open Rate' : 'Click Rate'}</strong>
                    </span>
                    {ab.heldCount > 0 && (
                      <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                        {ab.heldCount} Contacts Held for Rollout
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Split className="w-5 h-5 text-purple-400" /> A/B Split Comparative Analysis
                  </h3>
                  <p className="text-xs text-purple-200/80">
                    {ab.significance?.recommendation || 'Comparing engagement between Variant A and Variant B.'}
                  </p>
                </div>

                {/* Winner Status / Rollout Button */}
                <div className="flex items-center gap-3">
                  {ab.declaredWinner ? (
                    <div className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/30 px-4 py-2 rounded-xl text-accent-green text-xs font-bold shadow-sm">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>Winner Declared: <strong>Variant {ab.declaredWinner}</strong></span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedWinnerVariant('A');
                          setShowWinnerConfirmModal(true);
                        }}
                        className="px-3.5 py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <Crown className="w-3.5 h-3.5 text-amber-300" /> Pick Variant A
                      </button>
                      <button
                        onClick={() => {
                          setSelectedWinnerVariant('B');
                          setShowWinnerConfirmModal(true);
                        }}
                        className="px-3.5 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <Crown className="w-3.5 h-3.5 text-amber-300" /> Pick Variant B
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Statistical Significance Meter */}
              <div className="bg-surface/50 border border-purple-500/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-text-muted flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-400" /> Statistical Significance Confidence
                  </span>
                  <span className={`font-bold ${ab.significance?.isSignificant ? 'text-accent-green' : 'text-amber-300'}`}>
                    {ab.significance?.confidenceScore ?? 50}% Confidence {ab.significance?.isSignificant ? '(Statistically Significant)' : '(Gathering More Data)'}
                  </span>
                </div>
                <div className="w-full bg-surface-hover rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      ab.significance?.isSignificant ? 'bg-accent-green' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                    }`}
                    style={{ width: `${Math.min(ab.significance?.confidenceScore ?? 50, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Side-by-Side Variant A vs Variant B Comparison Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ── Variant A Card ── */}
              <div className={`bg-surface/40 border rounded-2xl p-6 backdrop-blur-md shadow-card space-y-5 transition-all ${
                ab.declaredWinner === 'A' || ab.significance?.winner === 'A'
                  ? 'border-purple-500/60 ring-2 ring-purple-500/20 bg-purple-950/10'
                  : 'border-border/50'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                        A
                      </span>
                      <h4 className="font-bold text-text-main text-base">Variant A (Control)</h4>
                      {(ab.declaredWinner === 'A' || (!ab.declaredWinner && ab.significance?.winner === 'A')) && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Winner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted font-medium truncate max-w-sm">
                      Subject: <span className="text-text-main font-semibold">{ab.variantA?.subject || activeCampaign?.subject}</span>
                    </p>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-surface/60 border border-border/40 p-3 rounded-xl">
                    <div className="text-[11px] font-bold text-text-muted uppercase">Delivered</div>
                    <div className="text-lg font-black text-text-main">{ab.variantA?.delivered?.toLocaleString() || 0}</div>
                  </div>
                  <div className="bg-surface/60 border border-border/40 p-3 rounded-xl">
                    <div className="text-[11px] font-bold text-text-muted uppercase">Open Rate</div>
                    <div className="text-lg font-black text-accent-green">{pct(ab.variantA?.openRate)}</div>
                    <div className="text-[10px] text-text-muted">{ab.variantA?.uniqueOpens || 0} opens</div>
                  </div>
                  <div className="bg-surface/60 border border-border/40 p-3 rounded-xl">
                    <div className="text-[11px] font-bold text-text-muted uppercase">Click Rate</div>
                    <div className="text-lg font-black text-accent-purple">{pct(ab.variantA?.clickRate)}</div>
                    <div className="text-[10px] text-text-muted">{ab.variantA?.uniqueClicks || 0} clicks</div>
                  </div>
                </div>

                {/* Progress Visualizer */}
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <div className="flex justify-between text-xs text-text-muted font-semibold">
                    <span>Open Conversion</span>
                    <span className="text-text-main">{pct(ab.variantA?.openRate)}</span>
                  </div>
                  <div className="w-full bg-surface-hover rounded-full h-2 overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min((ab.variantA?.openRate || 0) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* ── Variant B Card ── */}
              <div className={`bg-surface/40 border rounded-2xl p-6 backdrop-blur-md shadow-card space-y-5 transition-all ${
                ab.declaredWinner === 'B' || ab.significance?.winner === 'B'
                  ? 'border-indigo-500/60 ring-2 ring-indigo-500/20 bg-indigo-950/10'
                  : 'border-border/50'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                        B
                      </span>
                      <h4 className="font-bold text-text-main text-base">Variant B (Test Variation)</h4>
                      {(ab.declaredWinner === 'B' || (!ab.declaredWinner && ab.significance?.winner === 'B')) && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Winner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted font-medium truncate max-w-sm">
                      Subject: <span className="text-text-main font-semibold">{ab.variantB?.subject || 'Variant B Subject'}</span>
                    </p>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-surface/60 border border-border/40 p-3 rounded-xl">
                    <div className="text-[11px] font-bold text-text-muted uppercase">Delivered</div>
                    <div className="text-lg font-black text-text-main">{ab.variantB?.delivered?.toLocaleString() || 0}</div>
                  </div>
                  <div className="bg-surface/60 border border-border/40 p-3 rounded-xl">
                    <div className="text-[11px] font-bold text-text-muted uppercase">Open Rate</div>
                    <div className="text-lg font-black text-accent-green">{pct(ab.variantB?.openRate)}</div>
                    <div className="text-[10px] text-text-muted">{ab.variantB?.uniqueOpens || 0} opens</div>
                  </div>
                  <div className="bg-surface/60 border border-border/40 p-3 rounded-xl">
                    <div className="text-[11px] font-bold text-text-muted uppercase">Click Rate</div>
                    <div className="text-lg font-black text-accent-purple">{pct(ab.variantB?.clickRate)}</div>
                    <div className="text-[10px] text-text-muted">{ab.variantB?.uniqueClicks || 0} clicks</div>
                  </div>
                </div>

                {/* Progress Visualizer */}
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <div className="flex justify-between text-xs text-text-muted font-semibold">
                    <span>Open Conversion</span>
                    <span className="text-text-main">{pct(ab.variantB?.openRate)}</span>
                  </div>
                  <div className="w-full bg-surface-hover rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min((ab.variantB?.openRate || 0) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── OVERALL DASHBOARD KPI STAT CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Delivered */}
          <div className="bg-surface/40 border border-border/50 rounded-xl p-5 backdrop-blur-md shadow-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Delivered</span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-main">{m.delivered.toLocaleString()}</div>
            <div className="text-[11px] text-text-muted flex items-center gap-1">
              Out of <span className="font-semibold text-text-main">{m.sent.toLocaleString()}</span> total sent
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
              Bounces: <span className="font-semibold text-text-main">{(m.bouncesHard || 0) + (m.bouncesSoft || 0)}</span>
            </div>
          </div>
        </div>

        {/* ── Engagement Funnel Panel ── */}
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

        {/* ── Multi-Step Follow-Up Sequence & Response Tracker ── */}
        {sequenceOverview && sequenceOverview.steps.length > 1 && (
          <div className="bg-surface/40 border border-border/50 rounded-2xl p-6 backdrop-blur-md shadow-card space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/50 pb-4">
              <div>
                <h3 className="text-[15px] font-bold text-text-main flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" /> Multi-Step Follow-Up Cadence & Non-Responder Tracking
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Automated drip progression: halts next steps on reply, and delivers follow-ups only to non-responders.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {sequenceOverview.steps.length}-Step Active Sequence
              </span>
            </div>

            {/* Sequence Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-hover/50 border border-border/40 space-y-1">
                <span className="text-[10px] font-bold uppercase text-text-muted">Total Enrolled</span>
                <div className="text-xl font-bold text-text-main">{sequenceOverview.totalEnrolled}</div>
                <div className="text-[10px] text-text-muted">All contacts targeted</div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-hover/50 border border-border/40 space-y-1">
                <span className="text-[10px] font-bold uppercase text-text-muted">Active in Sequence</span>
                <div className="text-xl font-bold text-primary">{sequenceOverview.activeInSequence}</div>
                <div className="text-[10px] text-text-muted">Awaiting replies or next step</div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-400">Stopped on Reply</span>
                <div className="text-xl font-bold text-emerald-400">{sequenceOverview.stoppedOnReply}</div>
                <div className="text-[10px] text-emerald-500/80">Replied & safely exited</div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-hover/50 border border-border/40 space-y-1">
                <span className="text-[10px] font-bold uppercase text-text-muted">Completed All Steps</span>
                <div className="text-xl font-bold text-text-main">{sequenceOverview.completedSequence}</div>
                <div className="text-[10px] text-text-muted">Finished cadence</div>
              </div>
            </div>

            {/* Step-by-Step Cadence Funnel */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Step-by-Step Delivery & Response Funnel
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sequenceOverview.steps.map((st: any, idx: number) => (
                  <div
                    key={st.stepNumber}
                    className="p-4 rounded-xl bg-surface border border-border/60 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                        {st.stepNumber}
                      </span>
                      <span className="text-[11px] text-text-muted font-medium">
                        {idx === 0 ? 'Initial Send' : `+${st.delayDays}d delay`}
                      </span>
                    </div>

                    <div className="font-semibold text-xs text-text-main line-clamp-1" title={st.subject}>
                      {st.subject}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-border/30">
                      <div>
                        <div className="text-[10px] text-text-muted">Sent</div>
                        <div className="font-bold text-text-main">{st.sentCount}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted">Opens</div>
                        <div className="font-bold text-accent-green">{st.openedCount}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted">Clicks</div>
                        <div className="font-bold text-accent-purple">{st.clickedCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Non-Responders Cadence Queue */}
            {sequenceOverview.nonResponders && sequenceOverview.nonResponders.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary" /> Non-Responder Cadence Queue ({sequenceOverview.nonResponders.length})
                  </h4>
                  <span className="text-[11px] text-text-muted">
                    Contacts who have not replied yet
                  </span>
                </div>

                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-hover/80 border-b border-border/50 text-text-muted font-semibold">
                      <tr>
                        <th className="p-2.5 pl-4">Contact</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Current Step</th>
                        <th className="p-2.5">Days Since Last Touch</th>
                        <th className="p-2.5 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sequenceOverview.nonResponders.slice(0, 10).map((nr: any) => (
                        <tr key={nr.contactId} className="border-b border-border/30 hover:bg-surface-hover/30 transition-colors">
                          <td className="p-2.5 pl-4 font-medium text-text-main">{nr.name}</td>
                          <td className="p-2.5 text-text-muted">{nr.email}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              Step {nr.currentStep} of {sequenceOverview.steps.length}
                            </span>
                          </td>
                          <td className="p-2.5 text-text-muted">
                            {nr.daysSinceLastTouch === 0 ? 'Today' : `${nr.daysSinceLastTouch} day${nr.daysSinceLastTouch !== 1 ? 's' : ''} ago`}
                          </td>
                          <td className="p-2.5 pr-4 text-right">
                            <button
                              onClick={() => markReplyMutation.mutate(nr.contactId)}
                              disabled={markReplyMutation.isPending}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition-all inline-flex items-center gap-1"
                              title="Mark as replied to stop future sequence follow-ups"
                            >
                              <Check className="w-3 h-3" /> Mark Replied
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Recipient Activity Log with Variant Filter ── */}
        {recipientActivity.length > 0 && (
          <div className="rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between flex-wrap gap-3">
              <span className="text-[13px] font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Recipient Activity & Variant Tracking
              </span>

              {isAbTest && (
                <div className="flex items-center gap-1 bg-surface-hover/60 p-1 rounded-xl border border-border/50 text-xs">
                  {[
                    { id: 'ALL', label: 'All Recipients' },
                    { id: 'A', label: 'Variant A' },
                    { id: 'B', label: 'Variant B' },
                    ...(ab.heldCount > 0 ? [{ id: 'HOLD', label: 'Held in Reserve' }] : []),
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setRecipientVariantFilter(f.id as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        recipientVariantFilter === f.id
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <table className="w-full text-left">
              <thead className="border-b border-border/50 bg-surface/80 text-text-muted text-[12px] font-semibold">
                <tr>
                  <th className="p-3 pl-6">Recipient ID</th>
                  {isAbTest && <th className="p-3">Variant</th>}
                  <th className="p-3">Status</th>
                  <th className="p-3">Opened</th>
                  <th className="p-3 pr-6">Clicked</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipients.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 text-[13px] hover:bg-black/5 transition-colors">
                    <td className="p-3 pl-6 font-mono text-xs text-text-muted">{r.contactId.slice(0, 16)}...</td>
                    {isAbTest && (
                      <td className="p-3">
                        {r.status === 'HOLD' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            HELD
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.variant === 'B' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            Variant {r.variant || 'A'}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        r.status === 'SENT' ? 'text-accent-green bg-accent-green/10' : 'text-text-muted bg-surface-hover'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {r.opened ? (
                        <span className="text-accent-green flex items-center gap-1 text-xs font-bold">
                          <Check className="w-3.5 h-3.5" /> Opened
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3 pr-6">
                      {r.clicked ? (
                        <span className="text-accent-purple flex items-center gap-1 text-xs font-bold">
                          <Check className="w-3.5 h-3.5" /> Clicked
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Sent Campaigns Overview Table Container ── */}
        <div className="rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between">
            <span className="text-[13px] font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> All Sent Campaigns
            </span>
            <span className="text-[11px] text-text-muted font-medium">
              Showing {sentCampaigns.length} Sent Campaign{sentCampaigns.length === 1 ? '' : 's'}
            </span>
          </div>

          <table className="w-full text-left">
            <thead className="border-b border-border/50 bg-surface/80 text-text-muted text-[12px] font-semibold">
              <tr>
                <th className="p-3 pl-6">Campaign</th>
                <th className="p-3">Type</th>
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
                const hasAb = c.abTestConfig?.enabled;

                return (
                  <tr 
                    key={c.id} 
                    onClick={() => setSearchParams({ campaign: c.id })}
                    className={`border-b border-border/50 text-[13px] transition-colors cursor-pointer ${isSelected ? 'bg-primary/10' : 'hover:bg-black/5'}`}
                  >
                    <td className="p-3 pl-6 font-semibold text-text-main">{c.name}</td>
                    <td className="p-3">
                      {hasAb ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          A/B SPLIT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-hover text-text-muted">
                          BROADCAST
                        </span>
                      )}
                    </td>
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

      {/* ── WINNER SELECTION CONFIRMATION MODAL ── */}
      {showWinnerConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-md p-6 shadow-luxury space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-text-main text-base">
                  Declare Variant {selectedWinnerVariant} as Winner?
                </h3>
              </div>
              <button onClick={() => setShowWinnerConfirmModal(false)} className="text-text-muted hover:text-text-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Variant {selectedWinnerVariant} will be marked as the winning email.
              {ab?.heldCount > 0 ? (
                <> The <strong>{ab.heldCount} contacts held in reserve</strong> will immediately be sent Variant {selectedWinnerVariant}.</>
              ) : (
                ' This will finalize the test metrics.'
              )}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowWinnerConfirmModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={() => selectWinnerMutation.mutate(selectedWinnerVariant)}
                disabled={selectWinnerMutation.isPending}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-interactive transition-all"
              >
                {selectWinnerMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                Confirm & Rollout Winner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Controls & Counter */}
      <div 
        className="pr-8 pl-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
        style={{ 
          background: 'var(--sidebar-bg)', 
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
        } as React.CSSProperties}
      >
        <span className="text-[12px] text-text-muted font-medium">
          Analytics synchronized live with email tracking events
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
