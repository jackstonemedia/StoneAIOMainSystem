import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Target, DollarSign, Calendar, TrendingUp,
  Users, Building2, CheckCircle2, XCircle, Search,
  Loader2, Pencil
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../ui/Toast';

interface DealSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  dealId?: string | null;
  defaultStage?: string;
  onSave?: () => void;
}

interface Stage { id: string; name: string; color: string; probability?: number; }
interface Pipeline { id: string; name: string; stages: Stage[]; }
interface ContactOption { id: string; firstName: string; lastName?: string; email?: string; }
interface CompanyOption { id: string; name: string; }

const PRIORITIES = ['low', 'medium', 'high'] as const;
type Priority = typeof PRIORITIES[number];

function PriorityColor(p: Priority) {
  if (p === 'high') return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (p === 'medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
}

export default function DealSlideOver({ isOpen, onClose, dealId, defaultStage, onSave }: DealSlideOverProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!dealId;

  const [form, setForm] = useState({
    title: '',
    amount: '',
    closeDate: '',
    priority: 'medium' as Priority,
    probability: 50,
    pipelineStageId: '',
    contactId: '',
    companyId: '',
    notes: '',
  });

  const [contactSearch, setContactSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [contactDropOpen, setContactDropOpen] = useState(false);
  const [companyDropOpen, setCompanyDropOpen] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: () => apiClient.get('/crm/pipelines').then(r => r.data),
    enabled: isOpen,
  });

  const stages: Stage[] = pipelines.flatMap(p => p.stages ?? []);

  const { data: existingDeal, isLoading: loadingDeal } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => apiClient.get(`/crm/deals/${dealId}`).then(r => r.data),
    enabled: isOpen && !!dealId,
  });

  const { data: contacts = [] } = useQuery<ContactOption[]>({
    queryKey: ['contacts'],
    queryFn: () => apiClient.get('/crm/contacts').then(r => r.data),
    enabled: isOpen,
  });

  const { data: companies = [] } = useQuery<CompanyOption[]>({
    queryKey: ['companies'],
    queryFn: () => apiClient.get('/crm/companies').then(r => r.data),
    enabled: isOpen,
  });

  // ── Populate form when editing ─────────────────────────────────────────────
  useEffect(() => {
    if (existingDeal) {
      setForm({
        title: existingDeal.title ?? '',
        amount: existingDeal.amount != null ? String(existingDeal.amount) : '',
        closeDate: existingDeal.closeDate ? existingDeal.closeDate.split('T')[0] : '',
        priority: existingDeal.priority ?? 'medium',
        probability: existingDeal.probability ?? 50,
        pipelineStageId: existingDeal.pipelineStageId ?? existingDeal.pipelineStage?.id ?? '',
        contactId: existingDeal.contactId ?? existingDeal.contact?.id ?? '',
        companyId: existingDeal.companyId ?? existingDeal.company?.id ?? '',
        notes: existingDeal.notes ?? '',
      });
      setContactSearch(existingDeal.contact ? `${existingDeal.contact.firstName} ${existingDeal.contact.lastName ?? ''}`.trim() : '');
      setCompanySearch(existingDeal.company?.name ?? '');
    }
  }, [existingDeal]);

  // ── Reset when creating new ────────────────────────────────────────────────
  useEffect(() => {
    if (!dealId && isOpen) {
      const defaultStageId = stages.find(s => s.name === defaultStage)?.id ?? stages[0]?.id ?? '';
      const defaultProb = stages.find(s => s.id === defaultStageId)?.probability ?? 50;
      setForm({
        title: '', amount: '', closeDate: '', priority: 'medium',
        probability: defaultProb, pipelineStageId: defaultStageId,
        contactId: '', companyId: '', notes: '',
      });
      setContactSearch('');
      setCompanySearch('');
    }
  }, [dealId, isOpen, stages.length]);

  // Auto-set probability from stage
  const handleStageChange = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    setForm(f => ({ ...f, pipelineStageId: stageId, probability: stage?.probability ?? f.probability }));
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (isEditing) {
        return apiClient.put(`/crm/deals/${dealId}`, data).then(r => r.data);
      }
      return apiClient.post('/crm/deals', data).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast('success', isEditing ? 'Deal updated' : 'Deal created');
      onSave?.();
      onClose();
    },
    onError: () => toast('error', 'Failed to save deal'),
  });

  const markWonMutation = useMutation({
    mutationFn: () => apiClient.put(`/crm/deals/${dealId}`, { status: 'won', probability: 100 }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast('success', '🎉 Deal marked as Won!');
      onSave?.();
      onClose();
    },
    onError: () => toast('error', 'Failed to update deal'),
  });

  const markLostMutation = useMutation({
    mutationFn: () => apiClient.put(`/crm/deals/${dealId}`, { status: 'lost', probability: 0 }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast('success', 'Deal marked as Lost');
      onSave?.();
      onClose();
    },
    onError: () => toast('error', 'Failed to update deal'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    saveMutation.mutate({
      title: form.title,
      amount: parseFloat(form.amount) || 0,
      closeDate: form.closeDate || undefined,
      priority: form.priority,
      probability: form.probability,
      pipelineStageId: form.pipelineStageId || undefined,
      contactId: form.contactId || undefined,
      companyId: form.companyId || undefined,
      notes: form.notes || undefined,
    });
  };

  // Filtered options
  const filteredContacts = contacts.filter(c =>
    `${c.firstName} ${c.lastName ?? ''} ${c.email ?? ''}`.toLowerCase().includes(contactSearch.toLowerCase())
  ).slice(0, 8);

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  ).slice(0, 8);

  const selectedContact = contacts.find(c => c.id === form.contactId);
  const selectedCompany = companies.find(c => c.id === form.companyId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed inset-y-0 right-0 w-[480px] bg-surface border-l border-border shadow-luxury z-50 flex flex-col font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg/50">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-surface-hover border border-border">
                  <Target className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="text-[14px] font-medium text-text-main">
                    {isEditing ? 'Edit Opportunity' : 'New Opportunity'}
                  </h2>
                  <p className="text-[11px] text-text-muted">
                    {isEditing ? 'Update deal details' : 'Add to your sales pipeline'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-[4px] hover:bg-surface-hover text-text-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDeal ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6 space-y-5">

                    {/* Deal Title */}
                    <div>
                      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1.5">
                        Deal Title *
                      </label>
                      <input
                        required
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Q4 Enterprise Retainer"
                        className="w-full px-3 py-2 bg-bg border border-border rounded-[4px] text-[13px] text-text-main placeholder-text-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                      />
                    </div>

                    {/* Amount + Close Date */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Amount
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">$</span>
                          <input
                            value={form.amount}
                            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                            type="number"
                            placeholder="0"
                            className="w-full pl-7 pr-3 py-2 bg-bg border border-border rounded-[4px] text-[13px] text-text-main placeholder-text-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Close Date
                        </label>
                        <input
                          value={form.closeDate}
                          onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
                          type="date"
                          className="w-full px-3 py-2 bg-bg border border-border rounded-[4px] text-[13px] text-text-main focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                        />
                      </div>
                    </div>

                    {/* Stage */}
                    <div>
                      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Stage
                      </label>
                      {stages.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {stages.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleStageChange(s.id)}
                              className={`px-3 py-1.5 rounded-[4px] text-[12px] font-medium border transition-colors ${
                                form.pipelineStageId === s.id
                                  ? 'bg-surface-hover border-border text-text-main'
                                  : 'bg-surface border-border/60 text-text-muted hover:border-border hover:text-text-main'
                              }`}
                            >
                              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <select
                          value={form.pipelineStageId}
                          onChange={e => setForm(f => ({ ...f, pipelineStageId: e.target.value }))}
                          className="w-full px-3 py-2 bg-bg border border-border rounded-[4px] text-[13px] text-text-main focus:outline-none focus:ring-1 focus:ring-primary/40"
                        >
                          <option value="">Select stage…</option>
                        </select>
                      )}
                    </div>

                    {/* Probability */}
                    <div>
                      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1.5">
                        Win Probability — <span className="text-text-main font-medium">{form.probability}%</span>
                      </label>
                      <input
                        type="range"
                        min={0} max={100} step={5}
                        value={form.probability}
                        onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))}
                        className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-text-muted mt-1">
                        <span>0%</span><span>50%</span><span>100%</span>
                      </div>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1.5">Priority</label>
                      <div className="flex gap-2">
                        {PRIORITIES.map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, priority: p }))}
                            className={`flex-1 py-1.5 text-[12px] font-medium capitalize rounded-[4px] border transition-colors ${
                              form.priority === p ? PriorityColor(p) : 'border-border bg-surface text-text-muted hover:border-border hover:bg-surface-hover'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border" />

                    {/* Contact */}
                    <div>
                      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Contact
                      </label>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                          <input
                            value={contactSearch}
                            onChange={e => { setContactSearch(e.target.value); setContactDropOpen(true); if (!e.target.value) setForm(f => ({ ...f, contactId: '' })); }}
                            onFocus={() => setContactDropOpen(true)}
                            onBlur={() => setTimeout(() => setContactDropOpen(false), 150)}
                            placeholder={selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName ?? ''}`.trim() : 'Search contacts…'}
                            className="w-full pl-8 pr-3 py-2 bg-bg border border-border rounded-[4px] text-[13px] text-text-main placeholder-text-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                          {form.contactId && (
                            <button type="button" onClick={() => { setForm(f => ({ ...f, contactId: '' })); setContactSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {contactDropOpen && filteredContacts.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-surface border border-border rounded-[4px] shadow-luxury overflow-hidden">
                            {filteredContacts.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onMouseDown={() => { setForm(f => ({ ...f, contactId: c.id })); setContactSearch(`${c.firstName} ${c.lastName ?? ''}`.trim()); setContactDropOpen(false); }}
                                className="w-full text-left px-3 py-2 text-[13px] text-text-main hover:bg-surface-hover transition-colors flex items-center gap-2"
                              >
                                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                                  {c.firstName[0]}
                                </div>
                                <span>{c.firstName} {c.lastName}</span>
                                {c.email && <span className="text-text-muted text-[11px] ml-auto">{c.email}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Company */}
                    <div>
                      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> Company
                      </label>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                          <input
                            value={companySearch}
                            onChange={e => { setCompanySearch(e.target.value); setCompanyDropOpen(true); if (!e.target.value) setForm(f => ({ ...f, companyId: '' })); }}
                            onFocus={() => setCompanyDropOpen(true)}
                            onBlur={() => setTimeout(() => setCompanyDropOpen(false), 150)}
                            placeholder={selectedCompany?.name ?? 'Search companies…'}
                            className="w-full pl-8 pr-3 py-2 bg-bg border border-border rounded-[4px] text-[13px] text-text-main placeholder-text-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                          {form.companyId && (
                            <button type="button" onClick={() => { setForm(f => ({ ...f, companyId: '' })); setCompanySearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {companyDropOpen && filteredCompanies.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-surface border border-border rounded-[4px] shadow-luxury overflow-hidden">
                            {filteredCompanies.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onMouseDown={() => { setForm(f => ({ ...f, companyId: c.id })); setCompanySearch(c.name); setCompanyDropOpen(false); }}
                                className="w-full text-left px-3 py-2 text-[13px] text-text-main hover:bg-surface-hover transition-colors flex items-center gap-2"
                              >
                                <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                {c.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Notes
                      </label>
                      <textarea
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        rows={3}
                        placeholder="Add notes about this opportunity…"
                        className="w-full px-3 py-2 bg-bg border border-border rounded-[4px] text-[13px] text-text-main placeholder-text-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                      />
                    </div>

                    {/* Win/Loss buttons for existing deals */}
                    {isEditing && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => markWonMutation.mutate()}
                          disabled={markWonMutation.isPending || markLostMutation.isPending}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-[4px] border border-emerald-500/30 bg-emerald-500/8 text-emerald-600 text-[12px] font-medium hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
                        >
                          {markWonMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Mark as Won
                        </button>
                        <button
                          type="button"
                          onClick={() => markLostMutation.mutate()}
                          disabled={markWonMutation.isPending || markLostMutation.isPending}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-[4px] border border-red-500/30 bg-red-500/8 text-red-500 text-[12px] font-medium hover:bg-red-500/15 transition-colors disabled:opacity-50"
                        >
                          {markLostMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Mark as Lost
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border bg-bg/50 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-[4px] text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors border border-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending || !form.title.trim()}
                    className="px-5 py-2 rounded-[4px] text-[13px] font-medium bg-surface border border-border text-text-main hover:bg-surface-hover transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {isEditing ? 'Save Changes' : 'Create Deal'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
