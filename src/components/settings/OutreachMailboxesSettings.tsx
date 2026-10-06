import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail, Shield, Plus, AlertCircle, CheckCircle2,
  RefreshCw, PauseCircle, PlayCircle, Unlink, Settings2,
  Info, Sparkles, Check, Globe
} from 'lucide-react';
import { channelConnectionsApi } from '../../lib/api/conversations';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../ui/Toast';
import type { ChannelConnection } from '../../types/conversation';

export function OutreachMailboxesSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [editingLimitVal, setEditingLimitVal] = useState<number>(40);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);

  // Queries
  const { data: connections = [], isLoading: loadingConns } = useQuery<ChannelConnection[]>({
    queryKey: ['channel-connections'],
    queryFn: () => channelConnectionsApi.list(),
  });

  const { data: capacityData, isLoading: loadingCapacity } = useQuery({
    queryKey: ['email-marketing', 'outreach-capacity'],
    queryFn: () => apiClient.get('/email-marketing/outreach/capacity').then(r => r.data),
  });

  // Filter email inboxes only (Gmail & Outlook)
  const mailboxes = connections.filter(
    c => c.provider === 'gmail' || c.provider === 'outlook'
  );

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ChannelConnection> }) =>
      channelConnectionsApi.update(id, data),
    onSuccess: () => {
      toast('success', 'Mailbox settings updated');
      qc.invalidateQueries({ queryKey: ['channel-connections'] });
      qc.invalidateQueries({ queryKey: ['email-marketing', 'outreach-capacity'] });
      setEditingLimitId(null);
    },
    onError: (err: any) => {
      toast('error', err?.response?.data?.error || err?.message || 'Failed to update mailbox');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => channelConnectionsApi.disconnect(id),
    onSuccess: () => {
      toast('info', 'Mailbox disconnected');
      qc.invalidateQueries({ queryKey: ['channel-connections'] });
      qc.invalidateQueries({ queryKey: ['email-marketing', 'outreach-capacity'] });
      setConfirmDisconnectId(null);
    },
    onError: (err: any) => {
      toast('error', err?.response?.data?.error || err?.message || 'Failed to disconnect mailbox');
    },
  });

  const activeCount = capacityData?.activeMailboxesCount ?? mailboxes.filter(m => m.isActive && m.status !== 'PAUSED').length;
  const totalCapacity = capacityData?.totalCapacity ?? mailboxes.reduce((acc, m) => acc + (m.dailySendLimit || 40), 0);
  const sentToday = capacityData?.totalSentToday ?? mailboxes.reduce((acc, m) => acc + (m.sentTodayCount || 0), 0);
  const remainingToday = capacityData?.remainingCapacity ?? Math.max(0, totalCapacity - sentToday);
  const capacityPct = totalCapacity > 0 ? Math.min(100, Math.round((sentToday / totalCapacity) * 100)) : 0;

  const handleSaveLimit = (id: string) => {
    const val = Number(editingLimitVal);
    if (isNaN(val) || val < 1 || val > 50) {
      toast('error', 'Daily send limit must be between 1 and 50 emails');
      return;
    }
    updateMutation.mutate({ id, data: { dailySendLimit: val } });
  };

  const handleToggleStatus = (mailbox: ChannelConnection) => {
    const isCurrentlyActive = mailbox.isActive && mailbox.status !== 'PAUSED';
    const nextStatus = isCurrentlyActive ? 'PAUSED' : 'ACTIVE';
    updateMutation.mutate({
      id: mailbox.id,
      data: { status: nextStatus, isActive: !isCurrentlyActive }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-[18px] font-bold text-text-main">Email Outreach Mailboxes</h2>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Native Outreach Engine
          </span>
        </div>
        <p className="text-[13px] text-text-muted leading-relaxed">
          Connect your authentic Google Workspace / Gmail and Microsoft Outlook inboxes. Campaigns send directly from your connected mailboxes with round-robin rotation, safe daily limits (up to 40/day per inbox), human jitter pacing, and automated stop-on-reply.
        </p>
      </div>

      {/* Aggregate Capacity & Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Capacity */}
        <div className="p-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-text-muted">Total Daily Capacity</span>
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Mail className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[22px] font-bold text-text-main tracking-tight">
            {totalCapacity} <span className="text-[13px] font-normal text-text-muted">emails/day</span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {activeCount > 0 ? `Across ${activeCount} active mailbox${activeCount === 1 ? '' : 'es'}` : 'No active mailboxes'}
          </div>
        </div>

        {/* Sent Today */}
        <div className="p-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-text-muted">Sent Today</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[22px] font-bold text-text-main tracking-tight">
            {sentToday} <span className="text-[13px] font-normal text-text-muted">/ {totalCapacity}</span>
          </div>
          <div className="w-full bg-surface-hover h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${capacityPct}%` }}
            />
          </div>
          <div className="text-[11px] text-text-muted mt-1.5 flex justify-between">
            <span>{capacityPct}% used</span>
            <span>{remainingToday} remaining</span>
          </div>
        </div>

        {/* Active Inboxes */}
        <div className="p-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-text-muted">Active Inboxes</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[22px] font-bold text-text-main tracking-tight">
            {activeCount}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {mailboxes.length > activeCount ? `${mailboxes.length - activeCount} paused or disconnected` : 'All mailboxes healthy'}
          </div>
        </div>

        {/* Deliverability Mode */}
        <div className="p-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-text-muted">Outreach Protection</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[14px] font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
            <Check className="w-4 h-4" /> 100% White-Labeled
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            90–180s jitter • Stop-on-reply • Business hours only
          </div>
        </div>
      </div>

      {/* Connected Mailboxes List */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-surface-hover/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold text-text-main">Connected Mailboxes</h3>
            <p className="text-[12px] text-text-muted">Manage daily send limits and monitor individual inbox quota usage.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => channelConnectionsApi.connectGmail()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20"
            >
              <Plus className="w-3.5 h-3.5" /> Connect Gmail
            </button>
            <button
              onClick={() => channelConnectionsApi.connectOutlook()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border text-text-main rounded-lg text-[12px] font-semibold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Connect Outlook
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {loadingConns || loadingCapacity ? (
            <div className="p-8 text-center text-text-muted flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading connected mailboxes...
            </div>
          ) : mailboxes.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <div className="text-[14px] font-bold text-text-main">No outreach mailboxes connected yet</div>
              <p className="text-[12px] text-text-muted max-w-md mx-auto">
                Connect your Google Workspace / Gmail or Microsoft Outlook account to launch campaigns and automations directly from your authentic domain.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => channelConnectionsApi.connectGmail()}
                  className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                >
                  Connect Google Workspace / Gmail
                </button>
                <button
                  onClick={() => channelConnectionsApi.connectOutlook()}
                  className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-text-main text-[12px] font-bold rounded-lg transition-all shadow-sm"
                >
                  Connect Microsoft Outlook
                </button>
              </div>
            </div>
          ) : (
            mailboxes.map(conn => {
              const isGmail = conn.provider === 'gmail';
              const limit = conn.dailySendLimit ?? 40;
              const sent = conn.sentTodayCount ?? 0;
              const remaining = Math.max(0, limit - sent);
              const isPaused = conn.status === 'PAUSED' || !conn.isActive;
              const isError = conn.status === 'ERROR' || conn.status === 'DISCONNECTED';
              const isWarmup = conn.status === 'WARMUP';
              const isEditingLimit = editingLimitId === conn.id;

              return (
                <div key={conn.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Mailbox Info */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-[260px]">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isGmail ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {isGmail ? <Globe className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-text-main">
                          {conn.email || conn.label || 'Connected Account'}
                        </span>
                        {/* Status Badge */}
                        {isError ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Reconnect Required
                          </span>
                        ) : isPaused ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1">
                            <PauseCircle className="w-2.5 h-2.5" /> Paused
                          </span>
                        ) : isWarmup ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> Warmup Mode
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Active & Healthy
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                        <span>{isGmail ? 'Google Workspace / Gmail' : 'Microsoft 365 / Outlook'}</span>
                        <span>•</span>
                        <span>{conn.consecutiveBounces ?? 0} bounces recorded</span>
                      </div>
                    </div>
                  </div>

                  {/* Quota & Progress */}
                  <div className="flex-1 max-w-sm">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-text-main">Daily Volume: {sent} / {limit} sent</span>
                      <span className="text-text-muted">{remaining} remaining today</span>
                    </div>
                    <div className="w-full bg-surface-hover h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${isPaused ? 'bg-text-muted' : 'bg-primary'}`}
                        style={{ width: `${limit > 0 ? Math.min(100, Math.round((sent / limit) * 100)) : 0}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-text-muted mt-1 flex items-center gap-2">
                      <span>Pacing: 90–180s delay</span>
                      <span>•</span>
                      <span>Resets nightly at 00:00 UTC</span>
                    </div>
                  </div>

                  {/* Settings & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Daily Limit Config */}
                    {isEditingLimit ? (
                      <div className="flex items-center gap-1.5 bg-bg p-1 rounded-lg border border-border">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={editingLimitVal}
                          onChange={e => setEditingLimitVal(Number(e.target.value))}
                          className="w-14 px-2 py-1 bg-surface border border-border rounded text-[12px] text-text-main text-center font-bold"
                        />
                        <button
                          onClick={() => handleSaveLimit(conn.id)}
                          disabled={updateMutation.isPending}
                          className="px-2.5 py-1 bg-primary text-white rounded text-[11px] font-bold hover:opacity-90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingLimitId(null)}
                          className="px-2 py-1 text-text-muted hover:text-text-main text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingLimitId(conn.id);
                          setEditingLimitVal(limit);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-bg hover:bg-surface-hover text-[11px] font-semibold text-text-main transition-colors"
                        title="Configure safe daily limit (1-50)"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-text-muted" /> {limit}/day limit
                      </button>
                    )}

                    {/* Pause / Resume Button */}
                    <button
                      onClick={() => handleToggleStatus(conn)}
                      disabled={updateMutation.isPending}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                        isPaused
                          ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                          : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                      }`}
                    >
                      {isPaused ? (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" /> Resume
                        </>
                      ) : (
                        <>
                          <PauseCircle className="w-3.5 h-3.5" /> Pause
                        </>
                      )}
                    </button>

                    {/* Disconnect Button */}
                    {confirmDisconnectId === conn.id ? (
                      <div className="flex items-center gap-1 bg-red-500/10 p-1 rounded-lg border border-red-500/30">
                        <span className="text-[10px] text-red-400 font-bold px-1">Disconnect?</span>
                        <button
                          onClick={() => disconnectMutation.mutate(conn.id)}
                          disabled={disconnectMutation.isPending}
                          className="px-2 py-1 bg-red-500 text-white rounded text-[10px] font-bold hover:bg-red-600"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDisconnectId(null)}
                          className="px-1.5 py-1 text-text-muted hover:text-text-main text-[10px]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDisconnectId(conn.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Disconnect mailbox"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Educational Architecture Callout */}
      <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary shrink-0" />
          <h4 className="text-[13px] font-bold text-text-main">
            Why Native Multi-Inbox Outreach Outperforms Third-Party SMTP / Resend
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px] text-text-muted">
          <div className="p-3 rounded-lg bg-surface/50 border border-border/50 space-y-1">
            <div className="font-bold text-text-main flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% Authentic Deliverability
            </div>
            <p>
              Sent directly through your connected Google Workspace or Outlook account. Avoids "via third-party mailer" red flags and lands right in the Primary Inbox.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-surface/50 border border-border/50 space-y-1">
            <div className="font-bold text-text-main flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Safe 40 Emails/Day Limit
            </div>
            <p>
              Stone AIO enforces a strict 40/day limit per inbox with random human pacing (90–180 seconds) during business hours to protect your domain reputation.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-surface/50 border border-border/50 space-y-1">
            <div className="font-bold text-text-main flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Multi-Inbox Scaling
            </div>
            <p>
              Connect 2 inboxes for 80/day, 5 inboxes for 200/day, or 10 inboxes for 400/day. The system automatically round-robins across all healthy mailboxes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
