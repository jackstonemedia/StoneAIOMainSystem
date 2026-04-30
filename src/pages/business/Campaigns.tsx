import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Mail, Phone, Send, Edit2, Trash2, BarChart3, Users,
  CheckCircle2, Clock, PenLine, MoreVertical, Copy, X,
  Search, Filter, ArrowUpRight, Eye, AlertCircle, RefreshCw, Zap
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  sent:      { label: 'Sent',      color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle2 },
  sending:   { label: 'Sending',   color: 'text-blue-400',    bg: 'bg-blue-400/10',    icon: RefreshCw },
  scheduled: { label: 'Scheduled', color: 'text-amber-400',   bg: 'bg-amber-400/10',   icon: Clock },
  draft:     { label: 'Draft',     color: 'text-text-muted',  bg: 'bg-surface-hover',  icon: PenLine },
};

function parseJSON(s: any) { try { return JSON.parse(s); } catch { return {}; } }

function ConfirmDeleteModal({ name, onConfirm, onClose, loading }: { name: string; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.15 }}
        className="relative z-10 bg-surface border border-border rounded-[14px] shadow-2xl w-[400px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-[8px] bg-red-400/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-text-main">Delete Campaign</h3>
            <p className="text-[12px] text-text-muted">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-[13px] text-text-muted mb-6">Are you sure you want to delete <strong className="text-text-main">"{name}"</strong>? All data including metrics will be permanently removed.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-[7px] border border-border text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 rounded-[7px] bg-red-500 text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Campaigns() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'email', subject: '', previewText: '', content: '' });
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<any[]>({
    queryKey: ['campaigns'],
    queryFn: () => fetch('/api/business/campaigns').then(r => r.ok ? r.json() : []),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch('/api/business/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); setNewOpen(false); setForm({ name: '', type: 'email', subject: '', previewText: '', content: '' }); toast('success', 'Campaign created!'); },
    onError: () => toast('error', 'Failed to create campaign'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/business/campaigns/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); setDeleteTarget(null); toast('success', 'Campaign deleted'); },
    onError: () => toast('error', 'Failed to delete'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/business/campaigns/${id}/duplicate`, { method: 'POST' }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast('success', 'Campaign duplicated'); },
    onError: () => toast('error', 'Failed to duplicate'),
  });

  const sendCampaign = async (campaign: any) => {
    setSendingId(campaign.id);
    try {
      const r = await fetch(`/api/business/campaigns/${campaign.id}/send`, { method: 'POST' });
      if (!r.ok) throw new Error();
      const data = await r.json();
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast('success', `Campaign sent!`, `Delivered to ${data.sent || 0} contacts`);
    } catch {
      toast('error', 'Failed to send campaign');
    } finally {
      setSendingId(null);
    }
  };

  const filtered = campaigns.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalSent = campaigns.filter(c => c.status === 'sent').length;
  const totalDraft = campaigns.filter(c => c.status === 'draft').length;
  const totalScheduled = campaigns.filter(c => c.status === 'scheduled').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      {/* Header */}
      <div className="px-8 border-b border-border bg-surface flex items-center justify-between shrink-0 h-[68px]">
        <div>
          <h1 className="text-[20px] font-bold text-text-main">Campaigns</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Email and SMS campaigns for your contacts</p>
        </div>
        <button onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="px-8 py-4 border-b border-border bg-surface-hover/20 grid grid-cols-4 gap-4 shrink-0">
        {[
          { label: 'Total', value: campaigns.length, color: 'text-text-main' },
          { label: 'Sent', value: totalSent, color: 'text-emerald-400' },
          { label: 'Scheduled', value: totalScheduled, color: 'text-amber-400' },
          { label: 'Draft', value: totalDraft, color: 'text-text-muted' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-surface border border-border rounded-[10px] px-4 py-3">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{s.label}</div>
            <div className={`text-[22px] font-bold mt-0.5 ${s.color}`}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-8 py-3 border-b border-border bg-surface flex items-center gap-3 shrink-0">
        <div className="flex gap-1">
          {['all', 'sent', 'scheduled', 'draft'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium capitalize transition-colors ${statusFilter === f ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main hover:bg-surface-hover border border-border'}`}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input type="text" placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 w-[240px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] focus:outline-none focus:border-primary placeholder:text-text-muted" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-border bg-surface/90 backdrop-blur-sm z-10">
            <tr>
              {['Campaign', 'Type', 'Audience', 'Open Rate', 'Click Rate', 'Status', 'Updated', ''].map(h => (
                <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-6 py-4">
                  <div className="h-4 bg-surface-hover rounded animate-pulse w-1/2" />
                </td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-14 h-14 rounded-full bg-surface-hover border border-border flex items-center justify-center">
                    <Mail className="w-7 h-7 text-text-muted" />
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-bold text-text-main mb-1">No campaigns yet</p>
                    <p className="text-[13px] text-text-muted">Create your first email or SMS campaign to reach your contacts.</p>
                  </div>
                  <button onClick={() => setNewOpen(true)}
                    className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" /> Create Campaign
                  </button>
                </div>
              </td></tr>
            ) : filtered.map(c => {
              const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
              const StatusIcon = sc.icon;
              const metrics = parseJSON(c.metrics || c.metricsJson);
              const audience = parseJSON(c.audience || c.audienceJson);
              const isSending = sendingId === c.id;
              return (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="hover:bg-surface-hover/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-semibold text-text-main">{c.name}</div>
                    {c.subject && <div className="text-[11px] text-text-muted mt-0.5 truncate max-w-[220px]">{c.subject}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-[12px] text-text-muted">
                      {c.type === 'email' ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                      {c.type === 'email' ? 'Email' : 'SMS'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-[12px] text-text-muted">
                      <Users className="w-3.5 h-3.5" />
                      {(audience.count || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {metrics.openRate > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(metrics.openRate, 100)}%` }} />
                        </div>
                        <span className="text-[12px] font-semibold text-text-main">{metrics.openRate}%</span>
                      </div>
                    ) : <span className="text-[12px] text-text-muted">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    {metrics.clickRate > 0
                      ? <span className="text-[12px] font-semibold text-text-main">{metrics.clickRate}%</span>
                      : <span className="text-[12px] text-text-muted">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.color}`}>
                      <StatusIcon className={`w-3 h-3 ${sc.color === 'text-blue-400' ? 'animate-spin' : ''}`} />
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-text-muted whitespace-nowrap">
                    {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {/* Row actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Send button for drafts/scheduled */}
                      {(c.status === 'draft' || c.status === 'scheduled') && (
                        <button onClick={() => sendCampaign(c)} disabled={isSending}
                          className="w-7 h-7 rounded-[5px] flex items-center justify-center text-text-muted hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-50">
                          {isSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {/* Duplicate */}
                      <button onClick={() => duplicateMutation.mutate(c.id)}
                        className="w-7 h-7 rounded-[5px] flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete */}
                      <button onClick={() => setDeleteTarget(c)}
                        className="w-7 h-7 rounded-[5px] flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-[12px] text-text-muted">
            <span>{filtered.length} campaign{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      <AnimatePresence>
        {newOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setNewOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }}
              className="relative z-10 bg-surface border border-border rounded-[16px] shadow-2xl w-[520px] max-h-[85vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-hover/20">
                <div>
                  <h2 className="text-[16px] font-bold text-text-main">Create Campaign</h2>
                  <p className="text-[12px] text-text-muted mt-0.5">Set up your email or SMS campaign</p>
                </div>
                <button onClick={() => setNewOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Type */}
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Campaign Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['email', 'sms'] as const).map(t => (
                      <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`p-4 rounded-[10px] border flex flex-col items-center gap-2 transition-all ${form.type === t ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                        {t === 'email' ? <Mail className={`w-5 h-5 ${form.type === t ? 'text-primary' : 'text-text-muted'}`} /> : <Phone className={`w-5 h-5 ${form.type === t ? 'text-primary' : 'text-text-muted'}`} />}
                        <span className={`text-[13px] font-semibold capitalize ${form.type === t ? 'text-primary' : 'text-text-muted'}`}>{t}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Campaign Name <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="e.g. Black Friday Promo" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted" />
                </div>

                {/* Email-only fields */}
                {form.type === 'email' && (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Subject Line</label>
                      <input type="text" placeholder="What's this email about?" value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Preview Text</label>
                      <input type="text" placeholder="Short summary shown in inbox..." value={form.previewText}
                        onChange={e => setForm(f => ({ ...f, previewText: e.target.value }))}
                        className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted" />
                    </div>
                  </>
                )}

                {/* Content */}
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                    {form.type === 'email' ? 'Email Body' : 'SMS Message'}
                  </label>
                  <textarea rows={4} placeholder={form.type === 'email' ? 'Write your email content here...' : 'Your SMS message (160 chars max)'}
                    value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted resize-none" />
                  {form.type === 'sms' && (
                    <p className={`text-[11px] mt-1 ${form.content.length > 160 ? 'text-red-400' : 'text-text-muted'}`}>
                      {form.content.length}/160 characters
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-hover/20 shrink-0">
                <button onClick={() => setNewOpen(false)} className="px-4 py-2 rounded-[7px] border border-border text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">Cancel</button>
                <button onClick={() => form.name.trim() && createMutation.mutate(form)} disabled={!form.name.trim() || createMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-[7px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {createMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create Campaign
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDeleteModal
            name={deleteTarget.name}
            onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
            onClose={() => setDeleteTarget(null)}
            loading={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
