import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import {
  Plus, Send, Clock, CheckCircle2, XCircle, Pause,
  BarChart2, Edit2, Trash2, ChevronRight, Mail,
  Calendar, Users, Loader2, AlertCircle, Search, Filter,
  ChevronDown, Check, CheckSquare, X, Flame, Split, Copy, Crown, Sparkles,
  Eye, MousePointer
} from 'lucide-react';
import { AICampaignCopilotModal, type GeneratedCampaignPayload } from '../../components/email-marketing/AICampaignCopilotModal';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'PAUSED' | 'CANCELLED';
  blockJson?: any;
  abTestConfig?: any;
  scheduledAtUtc?: string | null;
  sentAtUtc?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { recipients: number };
  stats?: {
    sent: number;
    delivered: number;
    uniqueOpens: number;
    uniqueClicks: number;
    openRate: number;
    clickRate: number;
  };
}

const STATUS_CONFIG: Record<Campaign['status'], { label: string; badgeClass: string; icon: any }> = {
  DRAFT:     { label: 'Draft',     badgeClass: 'text-text-muted bg-surface-hover border-border',             icon: Edit2 },
  SCHEDULED: { label: 'Scheduled', badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',           icon: Clock },
  SENDING:   { label: 'Sending',   badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30 animate-pulse', icon: Loader2 },
  SENT:      { label: 'Sent',      badgeClass: 'text-green-400 bg-green-500/10 border-green-500/30',         icon: CheckCircle2 },
  PAUSED:    { label: 'Paused',    badgeClass: 'text-orange-400 bg-orange-500/10 border-orange-500/30',       icon: Pause },
  CANCELLED: { label: 'Cancelled', badgeClass: 'text-red-400 bg-red-500/10 border-red-500/30',                icon: XCircle },
};

async function fetchCampaigns(): Promise<Campaign[]> {
  const { data } = await apiClient.get('/email-marketing/campaigns');
  return data;
}

async function deleteCampaignApi(id: string) {
  await apiClient.delete(`/email-marketing/campaigns/${id}`);
}

async function sendCampaignApi(id: string) {
  await apiClient.post(`/email-marketing/campaigns/${id}/send`);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CampaignsList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{ field: keyof Campaign; direction: 'asc' | 'desc' } | null>({ field: 'createdAt', direction: 'desc' });
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [showAICopilotModal, setShowAICopilotModal] = useState(false);

  const handleApplyAICampaignFromList = async (payload: GeneratedCampaignPayload) => {
    try {
      const isDrip = Array.isArray(payload.dripSteps) && payload.dripSteps.length > 0;
      const initialStep = payload.dripSteps?.[0];
      const initialSubject = payload.abTest?.enabled
        ? (payload.abTest.subjectA || payload.campaignName || 'New Campaign')
        : (initialStep?.subject || payload.campaignName || 'New Campaign');
      const initialBody = payload.abTest?.enabled
        ? (payload.abTest.bodyHtmlA || '')
        : (initialStep?.body || (payload as any).bodyHtml || (payload as any).body || '');

      const formattedSteps = (payload.dripSteps || []).map((st: any, idx: number) => ({
        id: st.id || `step-${idx + 1}-${Date.now()}`,
        stepNumber: st.stepNumber || idx + 1,
        subject: st.subject || st.title || `Email ${idx + 1}`,
        delayDays: typeof st.delayDays === 'number' ? st.delayDays : (idx === 0 ? 0 : 2),
        delayHours: typeof st.delayHours === 'number' ? st.delayHours : 0,
        body: st.body || st.bodyHtml || st.html || st.content || st.text || '',
        threadWithPrevious: st.threadWithPrevious ?? (idx > 0),
        stopOnReply: st.stopOnReply ?? true,
      }));

      const blockJson = {
        campaignType: isDrip ? 'drip' : 'broadcast',
        type: isDrip ? 'drip' : 'broadcast',
        dripSteps: formattedSteps,
        strategySummary: payload.strategySummary,
        sequenceSummary: payload.sequenceSummary,
        deliverySettings: payload.deliverySettings,
        html: initialBody,
        bodyHtml: initialBody,
      };

      const res = await apiClient.post('/email-marketing/campaigns', {
        name: payload.campaignName || 'AI Generated Campaign',
        subject: initialSubject,
        blockJson,
        abTestConfig: payload.abTest?.enabled
          ? {
              enabled: true,
              hypothesis: payload.abTest.hypothesis || null,
              subjectA: payload.abTest.subjectA || initialSubject,
              subjectB: payload.abTest.subjectB || '',
              previewTextA: payload.abTest.previewTextA || '',
              previewTextB: payload.abTest.previewTextB || '',
              bodyHtmlA: payload.abTest.bodyHtmlA || initialBody,
              bodyHtmlB: payload.abTest.bodyHtmlB || '',
            }
          : null,
      });

      setShowAICopilotModal(false);
      qc.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] });
      toast('success', 'Campaign Created', 'Your AI campaign sequence is ready in the builder.');
      navigate(`/email-marketing/campaigns/${res.data.id}`);
    } catch (err: any) {
      toast('error', 'Error Creating Campaign', err?.response?.data?.error || err?.message || 'Could not create campaign.');
    }
  };

  const { data: rawCampaigns = [], isLoading, error, refetch } = useQuery({
    queryKey: ['email-marketing', 'campaigns'],
    queryFn: fetchCampaigns,
    staleTime: 15_000,
  });

  const campaigns = Array.isArray(rawCampaigns) ? rawCampaigns : [];

  const deleteMutation = useMutation({
    mutationFn: deleteCampaignApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] });
      toast('success', 'Campaign Deleted', 'The campaign has been removed.');
    },
    onError: (err: any) => {
      toast('error', 'Delete Failed', err?.message || 'Could not delete campaign.');
    }
  });

  const sendMutation = useMutation({
    mutationFn: sendCampaignApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] });
      toast('success', 'Campaign Triggered', 'Email send process started.');
    },
    onError: (err: any) => {
      toast('error', 'Send Failed', err?.message || 'Failed to send campaign.');
    }
  });

  const cloneMutation = useMutation({
    mutationFn: async (campaign: Campaign) => {
      const { data } = await apiClient.post('/email-marketing/campaigns', {
        name: `${campaign.name} (Copy)`,
        subject: campaign.subject,
        blockJson: campaign.blockJson,
        abTestConfig: campaign.abTestConfig,
        status: 'DRAFT',
      });
      return data;
    },
    onSuccess: (newCampaign: any) => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] });
      toast('success', 'Campaign Cloned', 'Created a draft duplicate of the campaign.');
      if (newCampaign?.id) {
        navigate(`/email-marketing/campaigns/${newCampaign.id}`);
      }
    },
    onError: (err: any) => {
      toast('error', 'Clone Failed', err?.message || 'Could not duplicate campaign.');
    }
  });

  const processedCampaigns = useMemo(() => {
    let result = [...campaigns];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q));
    }

    if (statusFilter !== 'ALL') {
      result = result.filter(c => c.status === statusFilter);
    }

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.field === 'createdAt' || sortConfig.field === 'updatedAt') {
          const timeA = new Date(a[sortConfig.field]).getTime();
          const timeB = new Date(b[sortConfig.field]).getTime();
          if (timeA < timeB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (timeA > timeB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }

        const valA = String(a[sortConfig.field] || '').toLowerCase();
        const valB = String(b[sortConfig.field] || '').toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [campaigns, searchQuery, statusFilter, sortConfig]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === processedCampaigns.length) setSelected(new Set());
    else setSelected(new Set(processedCampaigns.map(c => c.id)));
  };

  const handleConfirmDelete = async () => {
    if (campaignToDelete) {
      await deleteMutation.mutateAsync(campaignToDelete);
    } else {
      for (const id of Array.from(selected)) {
        await deleteMutation.mutateAsync(id);
      }
      setSelected(new Set());
    }
    setDeleteConfirmOpen(false);
    setCampaignToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full relative bg-bg">
        <div className="px-8 flex items-center justify-between border-b border-border bg-surface h-[73px]">
          <div className="flex items-center gap-2">
            <div className="skeleton h-7 w-10 rounded-lg" />
            <div className="skeleton h-7 w-28 rounded-lg" />
            <div className="skeleton h-7 w-16 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton h-7 w-40 rounded-full" />
            <div className="skeleton h-8 w-28 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 border border-border/50 shadow-luxury">
          <table className="w-full text-left">
            <thead className="border-b border-border/50 bg-surface/80">
              <tr>
                {[48, 200, 220, 110, 100, 140, 100].map((w, i) => (
                  <th key={i} className="p-3"><div className="skeleton h-3 rounded" style={{ width: w }} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-3"><div className="skeleton w-4 h-4 rounded" /></td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="skeleton w-7 h-7 rounded-full" />
                      <div className="skeleton h-3 w-32 rounded" />
                    </div>
                  </td>
                  <td className="p-3"><div className="skeleton h-3 w-40 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-16 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-28 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-7 w-16 rounded-lg ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0">
      {/* Full-tab frosted glass overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Header Portal for Top App Bar Controls */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search Campaigns..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface border border-border/60 text-text-main placeholder:text-text-muted text-[13px] rounded-full pl-8 pr-4 py-1.5 focus:outline-none focus:border-primary transition-all w-52 focus:w-64"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-text-muted hover:text-text-main"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* AI Campaign Copilot Button */}
          <button
            onClick={() => setShowAICopilotModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600/90 to-primary/90 hover:from-purple-600 hover:to-primary text-white border border-purple-400/30 rounded-full px-3.5 py-1.5 text-[13px] font-bold shadow-interactive transition-all shrink-0 cursor-pointer"
            title="Create Campaign with AI Strategy Consultant"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            <span>AI Copilot</span>
          </button>

          {/* New Campaign Button */}
          <button
            onClick={() => navigate('/email-marketing/campaigns/new')}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white rounded-full px-4 py-1.5 text-[13px] font-bold shadow-interactive transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>Create Campaign</span>
          </button>
        </div>
      </HeaderPortal>

      {/* Bulk actions floating action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-8 mt-4 px-4 py-3 bg-surface/90 backdrop-blur-md border border-primary/30 rounded-xl shadow-luxury flex items-center justify-between z-20"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-[6px]">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  <span className="text-[13px] font-bold text-primary">{selected.size} Selected</span>
                </div>
                <button onClick={() => setSelected(new Set())} className="text-[12px] font-medium text-text-muted hover:text-text-main transition-colors">
                  Clear selection
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setDeleteConfirmOpen(true)} 
                  className="flex items-center gap-2 px-4 py-2 border border-red-500/30 bg-red-500/10 rounded-[8px] text-[13px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors shadow-sm card-hover-lift"
                >
                  <Trash2 className="w-4 h-4" /> Delete Selected
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && (
        <div className="mx-8 mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between gap-3 text-[13px]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{(error as any)?.message || 'Failed to load campaigns. Please refresh or try again.'}</span>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Performance Overview & Filter Pills */}
      {!isLoading && !error && (
        <div className="mx-8 mt-5 mb-1 space-y-4 relative z-10">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-surface/50 border border-border/60 rounded-xl p-3.5 backdrop-blur-md shadow-card hover:border-border transition-all">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Delivered</span>
                <Send className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-xl font-bold text-text-main">
                {campaigns.reduce((acc, c) => acc + (c.stats?.sent || c._count?.recipients || 0), 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
                <span className="text-accent-green font-semibold">100% deliverability target</span>
              </div>
            </div>

            <div className="bg-surface/50 border border-border/60 rounded-xl p-3.5 backdrop-blur-md shadow-card hover:border-border transition-all">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Avg Open Rate</span>
                <Eye className="w-3.5 h-3.5 text-accent-green" />
              </div>
              <div className="text-xl font-bold text-accent-green">
                {(() => {
                  const sent = campaigns.filter(c => c.status === 'SENT' || c.status === 'SENDING');
                  if (sent.length === 0) return '0.0%';
                  const totalSent = sent.reduce((acc, c) => acc + (c.stats?.sent || c._count?.recipients || 0), 0);
                  const totalOpens = sent.reduce((acc, c) => acc + (c.stats?.uniqueOpens || (c.stats as any)?.totalOpens || 0), 0);
                  return totalSent > 0 ? `${((totalOpens / totalSent) * 100).toFixed(1)}%` : '0.0%';
                })()}
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                Industry avg: ~21.5%
              </div>
            </div>

            <div className="bg-surface/50 border border-border/60 rounded-xl p-3.5 backdrop-blur-md shadow-card hover:border-border transition-all">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Avg Click Rate</span>
                <MousePointer className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-indigo-400">
                {(() => {
                  const sent = campaigns.filter(c => c.status === 'SENT' || c.status === 'SENDING');
                  if (sent.length === 0) return '0.0%';
                  const totalSent = sent.reduce((acc, c) => acc + (c.stats?.sent || c._count?.recipients || 0), 0);
                  const totalClicks = sent.reduce((acc, c) => acc + (c.stats?.uniqueClicks || (c.stats as any)?.totalClicks || 0), 0);
                  return totalSent > 0 ? `${((totalClicks / totalSent) * 100).toFixed(1)}%` : '0.0%';
                })()}
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                High-intent conversions
              </div>
            </div>

            <div className="bg-surface/50 border border-border/60 rounded-xl p-3.5 backdrop-blur-md shadow-card hover:border-border transition-all">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Campaigns</span>
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-text-main">
                {campaigns.filter(c => c.status === 'SENT' || c.status === 'SENDING' || c.status === 'SCHEDULED').length}
                <span className="text-xs text-text-muted font-normal ml-2">/ {campaigns.length} total</span>
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                {campaigns.filter(c => c.status === 'DRAFT').length} in drafts
              </div>
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { key: 'ALL', label: 'All', count: campaigns.length },
                { key: 'SENT', label: 'Sent', count: campaigns.filter(c => c.status === 'SENT').length },
                { key: 'SENDING', label: 'Sending', count: campaigns.filter(c => c.status === 'SENDING').length },
                { key: 'SCHEDULED', label: 'Scheduled', count: campaigns.filter(c => c.status === 'SCHEDULED').length },
                { key: 'DRAFT', label: 'Drafts', count: campaigns.filter(c => c.status === 'DRAFT').length },
                { key: 'PAUSED', label: 'Paused', count: campaigns.filter(c => c.status === 'PAUSED').length },
              ].map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setStatusFilter(pill.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === pill.key
                      ? 'bg-primary text-white shadow-interactive font-bold'
                      : 'bg-surface/60 border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === pill.key ? 'bg-white/20 text-white' : 'bg-surface border border-border/60 text-text-muted'
                  }`}>
                    {pill.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-xs text-text-muted font-medium">
              Showing <span className="text-text-main font-bold">{processedCampaigns.length}</span> of {campaigns.length} campaigns
            </div>
          </div>
        </div>
      )}

      {/* Content Container — matches Contacts section 1:1 */}
      {!isLoading && !error && (
        <div className="flex-1 overflow-auto mx-8 mt-3 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex flex-col">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
              <tr>
                <th className="w-12 p-3 text-center">
                  <button 
                    onClick={toggleAll} 
                    className="w-4 h-4 border border-border bg-bg rounded flex items-center justify-center transition-colors hover:border-primary text-primary"
                  >
                    {selected.size === processedCampaigns.length && processedCampaigns.length > 0 ? (
                      <Check className="w-3 h-3" strokeWidth={3} />
                    ) : null}
                  </button>
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted cursor-pointer hover:text-text-main transition-colors" onClick={() => setSortConfig({ field: 'name', direction: sortConfig?.field === 'name' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                  <div className="flex items-center justify-between gap-2">
                    Campaign name 
                    <ChevronDown className={`w-3.5 h-3.5 transition-opacity ${sortConfig?.field === 'name' ? 'opacity-100 text-primary' : 'opacity-40 hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Subject line
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Status
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Recipients
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Opens
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Clicks
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted cursor-pointer hover:text-text-main transition-colors" onClick={() => setSortConfig({ field: 'createdAt', direction: sortConfig?.field === 'createdAt' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                  <div className="flex items-center justify-between gap-2">
                    Date (EDT) 
                    <ChevronDown className={`w-3.5 h-3.5 transition-opacity ${sortConfig?.field === 'createdAt' ? 'opacity-100 text-primary' : 'opacity-40 hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {processedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                        <Mail className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-text-main">No campaigns found</h3>
                      <p className="text-xs text-text-muted mt-1 mb-4">
                        {searchQuery.trim() || statusFilter !== 'ALL'
                          ? 'No campaigns match your active search and filter criteria.'
                          : 'Get started by creating your first email marketing campaign.'}
                      </p>
                      {searchQuery.trim() || statusFilter !== 'ALL' ? (
                        <button
                          onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
                          className="px-3 py-1.5 bg-surface-hover hover:bg-surface border border-border rounded-lg text-xs font-semibold text-text-main transition-all"
                        >
                          Clear Filters
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/email-marketing/campaigns/new')}
                          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Create Campaign
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                processedCampaigns.map((campaign) => {
                  const cfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
                  const StatusIcon = cfg.icon;
                  const isAb = campaign.abTestConfig?.enabled;
                  const winner = campaign.abTestConfig?.winnerVariant;

                  return (
                    <tr 
                      key={campaign.id} 
                      className={`border-b border-border/50 transition-colors cursor-pointer ${selected.has(campaign.id) ? 'bg-primary/10' : 'bg-black/5 hover:bg-black/10'}`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON' && !target.closest('button')) {
                          navigate(`/email-marketing/campaigns/${campaign.id}`);
                        }
                      }}
                    >
                      <td className="p-3 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleSelect(campaign.id); }} 
                          className="w-4 h-4 border border-border bg-bg rounded flex items-center justify-center transition-colors hover:border-primary text-primary"
                        >
                          {selected.has(campaign.id) ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                        </button>
                      </td>

                      {/* Campaign Name */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {isAb ? (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-purple-300 shadow-sm shrink-0 bg-purple-500/20 border border-purple-500/30" title="A/B Split Test">
                              <Split className="w-3.5 h-3.5" />
                            </div>
                          ) : campaign.blockJson?.campaignType === 'drip' || (Array.isArray(campaign.blockJson?.dripSteps) && campaign.blockJson?.dripSteps.length > 0) ? (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-amber-300 shadow-sm shrink-0 bg-amber-400/20 border border-amber-400/30">
                              <Flame className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-primary shadow-sm shrink-0 bg-primary/20 border border-primary/30">
                              <Mail className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-[13px] font-medium transition-colors text-text-main truncate hover:underline">
                              {campaign.name}
                            </span>
                            {isAb && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 shrink-0 flex items-center gap-1">
                                <Split className="w-2.5 h-2.5" />
                                {winner ? `Winner: Variant ${winner}` : 'A/B Split'}
                              </span>
                            )}
                            {(campaign.blockJson?.campaignType === 'drip' || (Array.isArray(campaign.blockJson?.dripSteps) && campaign.blockJson?.dripSteps.length > 0)) && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 shrink-0">
                                Drip · {campaign.blockJson?.dripSteps?.length || 2} Steps
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Subject Line */}
                      <td className="p-3">
                        <span className="text-[13px] font-medium text-text-muted truncate max-w-[240px] block">
                          {campaign.subject || '(no subject)'}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-sm ${cfg.badgeClass}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Recipients Count */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
                          <Users className="w-3.5 h-3.5 opacity-60" />
                          {campaign._count?.recipients ?? 0}
                        </div>
                      </td>

                      {/* Opens */}
                      <td className="p-3">
                        {campaign.status === 'SENT' ? (
                          <div className="flex items-center gap-1.5 text-[13px]">
                            <span className="font-semibold text-accent-green">{campaign.stats?.uniqueOpens ?? 0}</span>
                            <span className="text-[11px] text-text-muted">({((campaign.stats?.openRate || 0) * 100).toFixed(1)}%)</span>
                          </div>
                        ) : (
                          <span className="text-text-muted opacity-40 text-[13px]">—</span>
                        )}
                      </td>

                      {/* Clicks */}
                      <td className="p-3">
                        {campaign.status === 'SENT' ? (
                          <div className="flex items-center gap-1.5 text-[13px]">
                            <span className="font-semibold text-accent-purple">{campaign.stats?.uniqueClicks ?? 0}</span>
                            <span className="text-[11px] text-text-muted">({((campaign.stats?.clickRate || 0) * 100).toFixed(1)}%)</span>
                          </div>
                        ) : (
                          <span className="text-text-muted opacity-40 text-[13px]">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-3 text-[11px] font-medium whitespace-nowrap text-text-muted opacity-60">
                        {campaign.status === 'SENT' ? fmtDate(campaign.sentAtUtc) :
                         campaign.status === 'SCHEDULED' ? fmtDate(campaign.scheduledAtUtc) :
                         fmtDate(campaign.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                          {campaign.status === 'DRAFT' && (
                            <button
                              onClick={() => sendMutation.mutate(campaign.id)}
                              disabled={sendMutation.isPending}
                              className="flex items-center gap-1 px-2.5 py-1 bg-primary text-white hover:bg-primary-hover rounded-[6px] text-[11px] font-semibold transition-all shadow-sm"
                            >
                              <Send className="w-3 h-3" /> Send
                            </button>
                          )}

                          {campaign.status === 'SENT' && (
                            <button
                              onClick={() => navigate(`/email-marketing/analytics?campaign=${campaign.id}`)}
                              className="flex items-center gap-1 px-2.5 py-1 border border-border bg-surface-hover hover:bg-surface text-text-main rounded-[6px] text-[11px] font-semibold transition-all shadow-sm"
                            >
                              <BarChart2 className="w-3 h-3 text-primary" /> Analytics
                            </button>
                          )}

                          <button
                            onClick={() => cloneMutation.mutate(campaign)}
                            disabled={cloneMutation.isPending}
                            className="p-1 text-text-muted hover:text-primary hover:bg-surface-hover rounded-[6px] transition-colors"
                            title="Duplicate campaign"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {(campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') && (
                            <button
                              onClick={() => { setCampaignToDelete(campaign.id); setDeleteConfirmOpen(true); }}
                              className="p-1 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-[6px] transition-colors"
                              title="Delete campaign"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <ChevronRight className="w-4 h-4 text-text-muted opacity-40 hover:opacity-100" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Controls & Paginator */}
      <div 
        className="pr-8 pl-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
        style={{ 
          background: 'var(--sidebar-bg)', 
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          {/* Status & Type Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-hover/50 p-1 rounded-lg border border-border/50 flex-wrap">
            {[
              { id: 'ALL', label: 'All Campaigns' },
              { id: 'DRAFT', label: 'Drafts' },
              { id: 'SCHEDULED', label: 'Scheduled' },
              { id: 'SENT', label: 'Sent' },
              { id: 'AB_TEST', label: '⚡ A/B Tests' },
              { id: 'DRIP', label: '🔥 Drip Sequences' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1 rounded-[6px] text-[11px] font-bold transition-all ${
                  statusFilter === st.id ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button onClick={() => setSortDropdownOpen(!sortDropdownOpen)} className="btn-secondary">
              <ChevronDown className="w-4 h-4" /> Sort
            </button>
            <AnimatePresence>
              {sortDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortDropdownOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 bottom-full mb-2 w-[180px] bg-surface border border-border/50 shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5"
                  >
                    {[
                      { label: 'Name (A-Z)', field: 'name', dir: 'asc' },
                      { label: 'Name (Z-A)', field: 'name', dir: 'desc' },
                      { label: 'Newest First', field: 'createdAt', dir: 'desc' },
                      { label: 'Oldest First', field: 'createdAt', dir: 'asc' }
                    ].map((opt, i) => (
                      <button 
                        key={i} 
                        onClick={() => { 
                          setSortConfig({ field: opt.field as keyof Campaign, direction: opt.dir as 'asc' | 'desc' }); 
                          setSortDropdownOpen(false); 
                        }} 
                        className="w-full flex items-center px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Counter & Pagination */}
        <div className="flex items-center gap-5">
          <span className="text-[13px] font-medium text-text-muted">
            {processedCampaigns.length} Campaigns
          </span>
          <div className="flex items-center gap-3 font-semibold">
            <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Prev</button>
            <button className="px-3 py-0.5 rounded-[6px] shadow-sm bg-primary text-white font-bold text-[12px]">1</button>
            <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setDeleteConfirmOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl z-10 relative"
            >
              <div className="flex items-center gap-3 text-red-400 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-text-main">Delete Campaign</h3>
              </div>
              <p className="text-[13px] text-text-muted mb-6 leading-relaxed">
                Are you sure you want to delete {campaignToDelete ? 'this campaign' : `${selected.size} selected campaign(s)`}? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => { setDeleteConfirmOpen(false); setCampaignToDelete(null); }}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium border border-border bg-surface-hover text-text-main hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── AI CAMPAIGN COPILOT MODAL ────────────────────────────────────── */}
      <AICampaignCopilotModal
        isOpen={showAICopilotModal}
        onClose={() => setShowAICopilotModal(false)}
        onApplyCampaign={handleApplyAICampaignFromList}
      />
    </div>
  );
}
