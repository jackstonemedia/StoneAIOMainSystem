/**
 * Email Marketing home / overview (added 2026-11-07, agent/email-marketing-ux).
 * Route: /email-marketing (index) — it used to redirect straight to /campaigns,
 * so the section opened on a table with no health, no recent performance, and
 * no next steps. This page is the landing: setup health, last-30-days
 * performance, recent campaigns, and quick actions. All data comes from
 * existing endpoints (campaigns, channel connections, business profile) —
 * no new API work.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Mail, Sparkles, Zap, Users, FileText, CheckCircle2, AlertTriangle,
  ArrowRight, Send, Eye, MousePointer, Plus,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { getProfile } from '../../lib/createWithAiApi';
import { HeaderPortal } from '../../components/layout/HeaderPortal';

interface CampaignLike {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAtUtc?: string | null;
  createdAt: string;
  stats?: { sent?: number; delivered?: number; uniqueOpens?: number; uniqueClicks?: number };
  _count?: { recipients?: number };
}

export default function EmailMarketingOverview() {
  const navigate = useNavigate();

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['email-marketing', 'campaigns'],
    queryFn: () => apiClient.get('/email-marketing/campaigns').then((r) => r.data as CampaignLike[]),
  });
  const { data: connections = [] } = useQuery({
    queryKey: ['channels', 'connections'],
    queryFn: () => apiClient.get('/channels/connections').then((r) => r.data as any[]),
  });
  const { data: profileData } = useQuery({
    queryKey: ['create-with-ai', 'profile'],
    queryFn: getProfile,
  });

  const gmailConnected = connections.some((c: any) => c.provider === 'gmail' && c.isActive);
  const profileComplete = !!profileData?.profile && (profileData?.missingRequired?.length ?? 0) === 0;

  const sentCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === 'SENT' || c.status === 'SENDING'),
    [campaigns],
  );
  const last30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = sentCampaigns.filter((c) => c.sentAtUtc && new Date(c.sentAtUtc).getTime() >= cutoff);
    const sent = recent.reduce((a, c) => a + (c.stats?.sent ?? c._count?.recipients ?? 0), 0);
    const delivered = recent.reduce((a, c) => a + (c.stats?.delivered ?? 0), 0);
    const opens = recent.reduce((a, c) => a + (c.stats?.uniqueOpens ?? 0), 0);
    const clicks = recent.reduce((a, c) => a + (c.stats?.uniqueClicks ?? 0), 0);
    return { sent, delivered, opens, clicks, openRate: sent > 0 ? (opens / sent) * 100 : 0, clickRate: sent > 0 ? (clicks / sent) * 100 : 0 };
  }, [sentCampaigns]);

  const recentCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 3),
    [campaigns],
  );

  // First incomplete setup item, in plain words.
  const nextStep = !gmailConnected
    ? { text: 'Connect your Gmail mailbox so campaigns can send.', cta: 'Connect a mailbox', to: '/settings?tab=outreach' }
    : !profileComplete
      ? { text: 'Finish your Business Profile so the AI writes in your voice.', cta: 'Finish profile', to: '/email-marketing/profile' }
      : sentCampaigns.length === 0
        ? { text: 'Send your first campaign to see performance here.', cta: 'Create a campaign', to: '/email-marketing/campaigns/new' }
        : null;

  const health = [
    { label: 'Gmail mailbox', ok: gmailConnected, detail: gmailConnected ? 'Connected — campaigns can send' : 'Not connected', to: '/settings?tab=outreach' },
    { label: 'Business Profile', ok: profileComplete, detail: profileComplete ? 'Complete — AI writes in your voice' : 'Incomplete — finish it for AI copy', to: '/email-marketing/profile' },
    { label: 'Campaigns sent', ok: sentCampaigns.length > 0, detail: sentCampaigns.length > 0 ? `${sentCampaigns.length} sent so far` : 'None sent yet', to: '/email-marketing/campaigns' },
  ];

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0">
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      <HeaderPortal>
        <button
          onClick={() => navigate('/email-marketing/campaigns/new')}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white rounded-full px-4 py-1.5 text-[13px] font-bold shadow-interactive transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span>Create Campaign</span>
        </button>
      </HeaderPortal>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6 relative z-10">
        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-text-main">Email Marketing</h1>
          <p className="text-[13px] text-text-muted mt-1">
            Campaigns, automations, and audience — everything in one place.
          </p>
        </div>

        {/* Next step — the one thing to do next */}
        {nextStep && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-primary/10 border border-primary/25 rounded-xl">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span className="text-[13px] font-medium text-text-main">{nextStep.text}</span>
            </div>
            <button
              onClick={() => navigate(nextStep.to)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-full text-xs font-bold shrink-0 transition-colors"
            >
              {nextStep.cta} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Setup health */}
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2.5">Setup health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {health.map((h) => (
              <button
                key={h.label}
                onClick={() => navigate(h.to)}
                className="text-left bg-surface/50 border border-border/60 rounded-xl p-4 backdrop-blur-md shadow-card hover:border-border transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{h.label}</span>
                  {h.ok
                    ? <CheckCircle2 className="w-4 h-4 text-accent-green" />
                    : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                </div>
                <div className={`text-[13px] font-semibold ${h.ok ? 'text-text-main' : 'text-amber-300'}`}>
                  {h.ok ? 'Ready' : 'Needs attention'}
                </div>
                <div className="text-[12px] text-text-muted mt-0.5">{h.detail}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Last 30 days */}
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2.5">Last 30 days</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {[
              { label: 'Sent', value: last30.sent.toLocaleString(), icon: Send, sub: `${last30.delivered.toLocaleString()} delivered` },
              { label: 'Open rate', value: `${last30.openRate.toFixed(1)}%`, icon: Eye, sub: `${last30.opens.toLocaleString()} opens` },
              { label: 'Click rate', value: `${last30.clickRate.toFixed(1)}%`, icon: MousePointer, sub: `${last30.clicks.toLocaleString()} clicks` },
              { label: 'Campaigns sent', value: String(sentCampaigns.length), icon: Mail, sub: `${campaigns.length} total` },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-surface/50 border border-border/60 rounded-xl p-3.5 backdrop-blur-md shadow-card">
                <div className="flex items-center justify-between text-text-muted mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider">{kpi.label}</span>
                  <kpi.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="text-xl font-bold text-text-main">{kpi.value}</div>
                <div className="text-[11px] text-text-muted mt-1">{kpi.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions + Recent campaigns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="bg-surface/50 border border-border/60 rounded-xl p-4 backdrop-blur-md shadow-card">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">Quick actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Build with AI', desc: 'Interview-driven campaign, written for you', icon: Sparkles, to: '/email-marketing/create-with-ai' },
                { label: 'New broadcast campaign', desc: 'One email to your audience', icon: Mail, to: '/email-marketing/campaigns/new' },
                { label: 'New automation', desc: 'Drip sequences triggered by tags or events', icon: Zap, to: '/email-marketing/automations/new' },
                { label: 'Manage audience', desc: 'Lists, segments, and suppression', icon: Users, to: '/email-marketing/audience' },
                { label: 'Browse templates', desc: 'Starter kits and your custom designs', icon: FileText, to: '/email-marketing/templates' },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => navigate(a.to)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors text-left"
                >
                  <a.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-text-main">{a.label}</span>
                    <span className="block text-[12px] text-text-muted truncate">{a.desc}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface/50 border border-border/60 rounded-xl p-4 backdrop-blur-md shadow-card">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">Recent campaigns</h2>
            {campaignsLoading ? (
              <p className="text-[13px] text-text-muted">Loading…</p>
            ) : recentCampaigns.length === 0 ? (
              <div className="text-center py-6">
                <Mail className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-[13px] font-semibold text-text-main">No campaigns yet</p>
                <p className="text-[12px] text-text-muted mt-1 mb-4">Your first campaign will show up here.</p>
                <button
                  onClick={() => navigate('/email-marketing/campaigns/new')}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-full text-xs font-bold transition-colors"
                >
                  Create your first campaign
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCampaigns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/email-marketing/campaigns/${c.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors text-left"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold text-text-main truncate">{c.name}</span>
                      <span className="block text-[12px] text-text-muted truncate">{c.subject || '(No subject)'}</span>
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface border border-border/60 text-text-muted shrink-0">
                      {c.status}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => navigate('/email-marketing/campaigns')}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline px-3 pt-1"
                >
                  View all campaigns <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
