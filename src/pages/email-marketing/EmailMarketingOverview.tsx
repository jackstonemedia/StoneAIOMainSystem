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
  Mail, Sparkles, Users, AlertTriangle, ArrowRight, Plus,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { getProfile, listDrafts } from '../../lib/createWithAiApi';
import { draftSummary } from '../../components/email-marketing/draftSummary';
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
  // Flow improvements (2026-11-08): unfinished AI drafts, so the next step
  // can point back at one instead of always starting a new campaign.
  const { data: draftsData } = useQuery({
    queryKey: ['create-with-ai', 'drafts'],
    queryFn: listDrafts,
  });

  const gmailConnected = connections.some((c: any) => c.provider === 'gmail' && c.isActive);
  const profileComplete = !!profileData?.profile && (profileData?.missingRequired?.length ?? 0) === 0;

  const sentCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === 'SENT' || c.status === 'SENDING'),
    [campaigns],
  );

  const recentCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 3),
    [campaigns],
  );

  // Unfinished AI drafts, most recently edited first (the list API already
  // orders by updatedAt desc). Continuing one is the path to a first campaign.
  const unfinishedDraft = (draftsData?.drafts ?? []).find((d) => d.status !== 'scheduled' && d.status !== 'canceled');

  // First incomplete setup item, in plain words.
  const nextStep = !gmailConnected
    ? { text: 'Connect your Gmail mailbox so campaigns can send.', cta: 'Connect a mailbox', to: '/settings?tab=outreach' }
    : !profileComplete
      ? { text: 'Finish your Business Profile so the AI writes in your voice.', cta: 'Finish profile', to: '/email-marketing/profile' }
      : unfinishedDraft
        ? { text: `Continue your draft: ${draftSummary(unfinishedDraft)}`, cta: 'Continue draft', to: '/email-marketing/create-with-ai' }
        : sentCampaigns.length === 0
          ? { text: 'Send your first campaign to see performance here.', cta: 'Create a campaign', to: '/email-marketing/campaigns/new' }
          : null;

  // Setup health shows ONLY when something needs attention — when everything
  // is fine, there is nothing to show (simplified 2026-11-08: the old page
  // showed three health cards + four KPI cards that duplicated Analytics).
  const attention = [
    !gmailConnected ? { text: 'Gmail is not connected — campaigns cannot send yet.', cta: 'Connect a mailbox', to: '/settings?tab=outreach' } : null,
    !profileComplete ? { text: 'Your Business Profile is incomplete — the AI writes better with it done.', cta: 'Finish profile', to: '/email-marketing/profile' } : null,
  ].filter(Boolean) as { text: string; cta: string; to: string }[];

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

        {/* Needs attention — only when something is actually incomplete. */}
        {attention.map((a) => (
          <div key={a.text} className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-[13px] font-medium text-text-main">{a.text}</span>
            </div>
            <button
              onClick={() => navigate(a.to)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-full text-xs font-bold shrink-0 transition-colors"
            >
              {a.cta} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Quick actions + Recent campaigns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="bg-surface/50 border border-border/60 rounded-xl p-4 backdrop-blur-md shadow-card">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">Quick actions</h2>
            <div className="space-y-2">
              {[
                { label: 'New campaign', desc: 'One email to your audience', icon: Mail, to: '/email-marketing/campaigns/new' },
                { label: 'Build with AI', desc: 'Interview-driven campaign, written for you', icon: Sparkles, to: '/email-marketing/create-with-ai' },
                { label: 'Manage audience', desc: 'Lists, segments, and suppression', icon: Users, to: '/email-marketing/audience' },
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
