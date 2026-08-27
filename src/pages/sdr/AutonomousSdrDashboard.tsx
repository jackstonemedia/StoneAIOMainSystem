/**
 * Autonomous AI SDR Dashboard & Control Center
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { NewSdrAgentModal } from '../../components/sdr/NewSdrAgentModal';
import {
  Target, Sparkles, Bot, Play, Pause, Plus,
  RefreshCw, CheckCircle2, Calendar, TrendingUp,
  ExternalLink, Check, X, Send, Terminal,
  Building2, Globe, Flame, Loader2, CheckSquare,
  Square, Eye, ChevronDown,
} from 'lucide-react';

interface SdrAgent {
  id: string;
  name: string;
  targetIcp: any;
  valueProposition: string;
  primaryOffer: string;
  calendarUrl?: string;
  mode: 'COPILOT' | 'AUTOPILOT';
  status: 'ACTIVE' | 'PAUSED';
  dailyLimit: number;
  sequenceConfig: any;
  createdAt: string;
}

interface SdrDossier {
  id: string;
  agentId: string;
  contactId?: string;
  businessName: string;
  websiteUrl?: string;
  contactEmail?: string;
  contactName?: string;
  websiteSummary: string;
  hookAngle: string;
  draftedSubject: string;
  draftedBody: string;
  sequenceSteps: Array<{ stepNumber: number; delayDays: number; subject: string; body: string }>;
  status: 'DRAFTED' | 'APPROVED' | 'SENDING' | 'ENGAGED' | 'MEETING_BOOKED' | 'BOUNCED' | 'DECLINED';
  metrics?: { opens: number; clicks: number; replies: number };
  createdAt: string;
}

/** Extract error message from axios or plain Error */
function getErrMsg(err: any): string {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || 'An error occurred';
}

export default function AutonomousSdrDashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isNewAgentModalOpen, setIsNewAgentModalOpen] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<SdrDossier | null>(null);
  const [activeStepTab, setActiveStepTab] = useState<number>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFTED' | 'APPROVED' | 'ENGAGED' | 'MEETING_BOOKED'>('ALL');

  // ── Fetch Agents
  const { data: agents = [], isLoading: isLoadingAgents } = useQuery<SdrAgent[]>({
    queryKey: ['sdr', 'agents'],
    queryFn: async () => {
      const { data } = await apiClient.get('/sdr/agents');
      return data;
    },
  });

  const activeAgent = useMemo(() => {
    if (!agents.length) return null;
    return agents.find(a => a.id === selectedAgentId) || agents[0];
  }, [agents, selectedAgentId]);

  const activeAgentId = activeAgent?.id;

  // ── Fetch Dossiers & Stats
  const { data: dossierData, isLoading: isLoadingDossiers, refetch } = useQuery({
    queryKey: ['sdr', 'dossiers', activeAgentId],
    queryFn: async () => {
      if (!activeAgentId) return { dossiers: [], stats: null };
      const { data } = await apiClient.get(`/sdr/agents/${activeAgentId}/dossiers`);
      return data;
    },
    enabled: !!activeAgentId,
  });

  const dossiers: SdrDossier[] = dossierData?.dossiers || [];
  const stats = dossierData?.stats || {
    totalResearched: 0,
    pendingApproval: 0,
    approvedAndSending: 0,
    engagedReplies: 0,
    meetingsBooked: 0,
    positiveReplyRate: '0.0',
  };

  const filteredDossiers = useMemo(() => {
    if (statusFilter === 'ALL') return dossiers;
    return dossiers.filter(d => d.status === statusFilter);
  }, [dossiers, statusFilter]);

  // ── Mutations
  const triggerCycleMutation = useMutation({
    mutationFn: async () => {
      if (!activeAgentId) throw new Error('No active agent selected');
      const { data } = await apiClient.post(`/sdr/agents/${activeAgentId}/trigger-cycle`, { limit: 4 });
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sdr', 'dossiers', activeAgentId] });
      if (data?.mode === 'AUTOPILOT') {
        toast('success', 'Autopilot Cycle Complete', `Scraped, drafted, and dispatched outreach to ${data?.processedCount ?? 0} leads.`);
      } else {
        toast('success', 'Prospecting Cycle Complete', `Scraped and drafted personalized sequences for ${data?.processedCount ?? 0} leads.`);
      }
    },
    onError: (err: any) => {
      toast('error', 'Cycle Failed', getErrMsg(err));
    },
  });

  const approveBatchMutation = useMutation({
    mutationFn: async (ids?: string[]) => {
      if (!activeAgentId) throw new Error('No active agent selected');
      const { data } = await apiClient.post(`/sdr/agents/${activeAgentId}/approve-batch`, { dossierIds: ids });
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sdr', 'dossiers', activeAgentId] });
      setSelectedIds([]);
      toast('success', 'Outreach Dispatched', `${data?.dispatchedCount ?? data?.approvedCount ?? 0} sequences approved and dispatched.`);
    },
    onError: (err: any) => {
      toast('error', 'Approval Failed', getErrMsg(err));
    },
  });

  const toggleModeMutation = useMutation({
    mutationFn: async (newMode: 'COPILOT' | 'AUTOPILOT') => {
      if (!activeAgentId) throw new Error('No active agent selected');
      const { data } = await apiClient.patch(`/sdr/agents/${activeAgentId}`, { mode: newMode });
      return data;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['sdr', 'agents'] });
      const label = updated?.mode === 'AUTOPILOT' ? 'Autopilot (Full Auto)' : 'Copilot (Review Mode)';
      toast('success', 'Mode Updated', `Switched to ${label}.`);
    },
    onError: (err: any) => {
      toast('error', 'Mode Switch Failed', getErrMsg(err));
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: 'ACTIVE' | 'PAUSED') => {
      if (!activeAgentId) throw new Error('No active agent selected');
      const { data } = await apiClient.patch(`/sdr/agents/${activeAgentId}`, { status: newStatus });
      return data;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['sdr', 'agents'] });
      toast('success', 'Status Updated', `Agent is now ${updated?.status ?? 'updated'}.`);
    },
    onError: (err: any) => {
      toast('error', 'Status Update Failed', getErrMsg(err));
    },
  });

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredDossiers.length && filteredDossiers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDossiers.map(d => d.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };


  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-bg text-text-main">
      {/* Frosted Glass Backdrop */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 space-y-5">

        {/* ── Page Header ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-main tracking-tight">Autonomous AI SDR</h1>
              <p className="text-[11px] text-text-muted">Self-driving outbound prospecting engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {agents.length > 1 && (
              <div className="relative">
                <select
                  value={activeAgentId || ''}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="appearance-none bg-surface border border-border/60 text-text-main rounded-full pl-3 pr-8 py-1.5 text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id} className="bg-surface text-text-main">
                      🎯 {a.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            <button
              onClick={() => refetch()}
              disabled={isLoadingDossiers}
              className="p-1.5 rounded-full bg-surface border border-border text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDossiers ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsNewAgentModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-xs font-bold text-text-main hover:bg-surface-hover transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-primary" /> New Agent
            </button>
          </div>
        </div>

        {/* Empty State if No Agents Exist */}
        {!isLoadingAgents && agents.length === 0 && (
          <div className="bg-surface/40 border border-border/60 rounded-3xl p-12 text-center max-w-xl mx-auto backdrop-blur-md shadow-card space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-white mx-auto shadow-luxury">
              <Target className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-text-main">No Autonomous SDR Agents Deployed</h2>
              <p className="text-xs text-text-muted leading-relaxed">
                Deploy an AI SDR to automatically research prospect websites, craft bespoke 1-to-1 cold outreach sequences, and book qualified meetings on your calendar.
              </p>
            </div>
            <button
              onClick={() => setIsNewAgentModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 text-white rounded-2xl text-xs font-bold transition-all shadow-interactive inline-flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" /> Deploy Your First AI SDR
            </button>
          </div>
        )}

        {/* Active Agent Command Header */}
        {activeAgent && (
          <div className="bg-surface/40 border border-border/50 rounded-2xl p-6 backdrop-blur-md shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  activeAgent.status === 'ACTIVE'
                    ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                    : 'bg-text-muted/10 text-text-muted border border-text-muted/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${activeAgent.status === 'ACTIVE' ? 'bg-accent-green animate-pulse' : 'bg-text-muted'}`} />
                  {activeAgent.status === 'ACTIVE' ? 'Autonomous Active' : 'Paused'}
                </span>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  activeAgent.mode === 'AUTOPILOT'
                    ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                    : 'bg-primary/10 text-primary border border-primary/30'
                }`}>
                  {activeAgent.mode === 'AUTOPILOT' ? '⚡ Autopilot Mode' : '🛡️ Copilot (Review Queue)'}
                </span>

                <span className="text-xs text-text-muted">
                  Target: <strong className="text-text-main">{activeAgent.targetIcp?.niche || 'General'}</strong>
                </span>
              </div>

              <h1 className="text-2xl font-black text-text-main tracking-tight flex items-center gap-2">
                <Target className="w-6 h-6 text-primary" /> {activeAgent.name}
              </h1>

              <p className="text-xs text-text-muted max-w-2xl">
                Offer: <span className="text-text-main font-medium">{activeAgent.primaryOffer}</span>
              </p>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Autopilot / Copilot Mode Toggle Button */}
              <div className="flex items-center p-1 bg-surface-hover/80 rounded-xl border border-border/60 text-xs">
                <button
                  onClick={() => toggleModeMutation.mutate('COPILOT')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    activeAgent.mode === 'COPILOT' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  Copilot
                </button>
                <button
                  onClick={() => toggleModeMutation.mutate('AUTOPILOT')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    activeAgent.mode === 'AUTOPILOT' ? 'bg-purple-600 text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  Autopilot
                </button>
              </div>

              {/* Pause / Resume */}
              <button
                onClick={() => toggleStatusMutation.mutate(activeAgent.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')}
                className="p-2 rounded-xl bg-surface border border-border hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors"
                title={activeAgent.status === 'ACTIVE' ? 'Pause SDR' : 'Resume SDR'}
              >
                {activeAgent.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-accent-green" />}
              </button>

              {/* Run Prospecting Cycle Trigger */}
              <button
                onClick={() => triggerCycleMutation.mutate()}
                disabled={triggerCycleMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-interactive flex items-center gap-2 cursor-pointer"
              >
                {triggerCycleMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Run Prospecting Cycle
              </button>
            </div>
          </div>
        )}

        {/* ── 4 Top KPI Cards ── */}
        {activeAgent && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface/40 border border-border/50 rounded-2xl p-5 backdrop-blur-md shadow-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Prospects Researched</span>
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-black text-text-main">{stats.totalResearched}</div>
              <p className="text-[11px] text-text-muted">Deep website dossiers generated</p>
            </div>

            <div className="bg-surface/40 border border-border/50 rounded-2xl p-5 backdrop-blur-md shadow-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Outreach Dispatched</span>
                <Send className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-text-main">{stats.approvedAndSending}</div>
              <p className="text-[11px] text-text-muted">Multi-touch sequences in flight</p>
            </div>

            <div className="bg-surface/40 border border-border/50 rounded-2xl p-5 backdrop-blur-md shadow-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Positive Reply Rate</span>
                <TrendingUp className="w-4 h-4 text-accent-green" />
              </div>
              <div className="text-2xl font-black text-accent-green">{stats.positiveReplyRate}%</div>
              <p className="text-[11px] text-text-muted">{stats.engagedReplies} engaged prospect conversations</p>
            </div>

            <div className="bg-surface/40 border border-border/50 rounded-2xl p-5 backdrop-blur-md shadow-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Meetings Booked</span>
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400">{stats.meetingsBooked}</div>
              <p className="text-[11px] text-text-muted">Calendar opportunities secured</p>
            </div>
          </div>
        )}

        {/* ── Main Lead Table & Filter Bar ── */}
        {activeAgent && (
          <div className="bg-surface/40 border border-border/50 rounded-2xl backdrop-blur-md shadow-card overflow-hidden">
            {/* Table Filter Tabs & Batch Bar */}
            <div className="p-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1 bg-surface-hover/60 p-1 rounded-xl border border-border/50 text-xs">
                {[
                  { id: 'ALL', label: 'All Leads', count: dossiers.length },
                  { id: 'DRAFTED', label: 'Review Queue', count: stats.pendingApproval },
                  { id: 'APPROVED', label: 'In Flight', count: stats.approvedAndSending },
                  { id: 'ENGAGED', label: 'Engaged', count: stats.engagedReplies },
                  { id: 'MEETING_BOOKED', label: 'Booked', count: stats.meetingsBooked },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      statusFilter === tab.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-surface text-text-muted'
                    }`}>{tab.count}</span>
                  </button>
                ))}
              </div>

              {/* Batch Action Bar */}
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 animate-fade-in">
                  <span className="text-xs font-bold text-text-main">
                    {selectedIds.length} leads selected
                  </span>
                  <button
                    onClick={() => approveBatchMutation.mutate(selectedIds)}
                    disabled={approveBatchMutation.isPending}
                    className="px-4 py-1.5 bg-accent-green hover:bg-accent-green/90 text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve & Dispatch Selected ({selectedIds.length})
                  </button>
                </div>
              )}
            </div>

            {/* Leads Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-surface-hover/30 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5 w-10 text-center">
                      <button onClick={handleToggleSelectAll} className="text-text-muted hover:text-text-main">
                        {selectedIds.length === filteredDossiers.length && filteredDossiers.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">Prospect Business</th>
                    <th className="p-3.5">Detected Value Hook</th>
                    <th className="p-3.5">Subject Line Draft</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredDossiers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-text-muted">
                        <div className="max-w-sm mx-auto space-y-2">
                          <Bot className="w-8 h-8 text-primary mx-auto opacity-60" />
                          <p className="font-bold text-text-main">No leads in this view</p>
                          <p className="text-xs">Click "Run Prospecting Cycle" above to discover and research new leads matching your ICP.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDossiers.map(dossier => {
                      const isSelected = selectedIds.includes(dossier.id);

                      return (
                        <tr
                          key={dossier.id}
                          className={`hover:bg-surface-hover/40 transition-colors cursor-pointer ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => setSelectedDossier(dossier)}
                        >
                          <td className="p-3.5 text-center" onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleToggleSelect(dossier.id)} className="text-text-muted hover:text-text-main">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>

                          {/* Business & Contact */}
                          <td className="p-3.5">
                            <div className="space-y-0.5">
                              <div className="font-bold text-text-main text-[13px] flex items-center gap-1.5">
                                <span>{dossier.businessName}</span>
                                {dossier.websiteUrl && (
                                  <a
                                    href={dossier.websiteUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-text-muted hover:text-primary"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              <div className="text-[11px] text-text-muted">
                                Contact: <span className="text-text-main font-medium">{dossier.contactName || dossier.contactEmail || 'Team'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Detected Hook */}
                          <td className="p-3.5 max-w-xs">
                            <div className="truncate font-medium text-purple-300 text-xs flex items-center gap-1">
                              <Flame className="w-3 h-3 shrink-0 text-amber-400" />
                              <span className="truncate">{dossier.hookAngle}</span>
                            </div>
                          </td>

                          {/* Draft Subject */}
                          <td className="p-3.5 max-w-xs truncate text-text-muted">
                            <span className="font-medium text-text-main">{dossier.draftedSubject}</span>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              dossier.status === 'MEETING_BOOKED'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : dossier.status === 'ENGAGED'
                                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                                : dossier.status === 'APPROVED' || dossier.status === 'SENDING'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}>
                              {dossier.status === 'DRAFTED' ? 'Review Queue' : dossier.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {dossier.status === 'DRAFTED' && (
                                <button
                                  onClick={() => approveBatchMutation.mutate([dossier.id])}
                                  disabled={approveBatchMutation.isPending}
                                  className="px-3 py-1 bg-accent-green/10 hover:bg-accent-green text-accent-green hover:text-black font-bold rounded-lg text-[11px] border border-accent-green/30 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Approve & Dispatch Outreach"
                                >
                                  <Send className="w-3 h-3" /> Approve & Send
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedDossier(dossier)}
                                className="p-1.5 rounded-lg bg-surface border border-border/60 text-text-muted hover:text-text-main hover:bg-surface-hover"
                                title="Inspect Lead Dossier"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Live Activity Terminal Stream ── */}
        {activeAgent && (
          <div className="bg-surface/40 border border-border/50 rounded-2xl p-5 backdrop-blur-md shadow-card space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-text-main flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-primary" /> Autonomous AI SDR Activity Stream
              </span>
              <span className="text-[11px] font-mono text-accent-green flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent-green animate-ping" /> Real-time active
              </span>
            </div>

            <div className="bg-black/60 border border-border/60 rounded-xl p-4 font-mono text-xs text-text-muted space-y-1.5 max-h-36 overflow-y-auto">
              <div className="text-purple-300">[Autonomous SDR Engine] Listening on ICP target: {activeAgent.targetIcp?.niche || 'All B2B'}...</div>
              <div className="text-text-muted">[Research Bot] Website scraper initialized with dynamic header rotation.</div>
              {dossiers.slice(0, 3).map((d, i) => (
                <div key={i} className="text-emerald-400">
                  [Dossier Verified] {d.businessName} &rarr; Hook angle: "{d.hookAngle.slice(0, 45)}..." &rarr; 3-step sequence generated.
                </div>
              ))}
              <div className="text-primary">[Scheduler] Daily volume cap: {activeAgent.dailyLimit} sends / day. Jitter: 45s-180s randomized.</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Slide-Over Lead Dossier Inspector Drawer ── */}
      {selectedDossier && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border-l border-border/80 w-full max-w-xl h-full shadow-luxury flex flex-col overflow-hidden animate-slide-left">
            {/* Drawer Header */}
            <div className="p-6 border-b border-border/60 flex items-center justify-between bg-surface-hover/30">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase text-primary tracking-wider">Prospect Dossier</span>
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> {selectedDossier.businessName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDossier(null)}
                className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Website Breakdown Card */}
              <div className="bg-surface-hover/40 border border-border/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-text-main">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" /> Website AI Research
                  </span>
                  {selectedDossier.websiteUrl && (
                    <a
                      href={selectedDossier.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                    >
                      {selectedDossier.websiteUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {selectedDossier.websiteSummary}
                </p>
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-1">
                  <span className="text-[10px] font-black uppercase text-purple-300 tracking-wider flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" /> Selected Personalization Hook
                  </span>
                  <p className="text-xs text-purple-200 font-medium">
                    {selectedDossier.hookAngle}
                  </p>
                </div>
              </div>

              {/* Multi-Touch Sequence Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-main uppercase tracking-wider">
                    3-Touch Bespoke Sequence
                  </span>
                  <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-xl border border-border/50 text-xs">
                    {[1, 2, 3].map(stepNum => (
                      <button
                        key={stepNum}
                        onClick={() => setActiveStepTab(stepNum)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          activeStepTab === stepNum
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        Step {stepNum}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Step Copy Card */}
                {selectedDossier.sequenceSteps && (
                  <div className="bg-surface border border-border/80 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Subject Line</label>
                      <input
                        value={selectedDossier.sequenceSteps[activeStepTab - 1]?.subject || selectedDossier.draftedSubject}
                        readOnly
                        className="w-full px-3 py-2 bg-surface-hover/50 border border-border/60 rounded-xl text-xs font-bold text-text-main outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Email Body</label>
                      <textarea
                        rows={8}
                        value={selectedDossier.sequenceSteps[activeStepTab - 1]?.body || selectedDossier.draftedBody}
                        readOnly
                        className="w-full px-3 py-2.5 bg-surface-hover/50 border border-border/60 rounded-xl text-xs text-text-main font-mono leading-relaxed outline-none resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>Schedule: <strong>Day {selectedDossier.sequenceSteps[activeStepTab - 1]?.delayDays || 0}</strong></span>
                      <span className="text-accent-green">✓ Stop on prospect reply</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-border/60 flex items-center justify-between bg-surface-hover/30">
              <button
                onClick={() => setSelectedDossier(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main"
              >
                Close Drawer
              </button>

              {selectedDossier.status === 'DRAFTED' && (
                <button
                  onClick={() => {
                    approveBatchMutation.mutate([selectedDossier.id]);
                    setSelectedDossier(null);
                  }}
                  disabled={approveBatchMutation.isPending}
                  className="px-5 py-2.5 bg-accent-green hover:bg-accent-green/90 text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Approve & Dispatch Email
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Deploy New SDR Modal ── */}
      <NewSdrAgentModal
        isOpen={isNewAgentModalOpen}
        onClose={() => setIsNewAgentModalOpen(false)}
        onSuccess={(newAgent) => {
          if (newAgent?.id) setSelectedAgentId(newAgent.id);
        }}
      />
    </div>
  );
}
