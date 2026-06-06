import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { InvoiceModal } from '../../components/crm/InvoiceModal';
import { apiClient } from '../../lib/apiClient';
import {
  Plus, Search, ChevronDown, X,
  List, MessageSquare,
  Trash2, Edit2, GripVertical,
  ChevronLeft,
  AlertCircle, Check, Target,
  CheckCircle2,
  XCircle, LayoutGrid,
  Sparkles, UserPlus, User, Building2,
  Phone, Mail, CheckSquare, Calendar, GitBranch,
  TrendingUp, MoreVertical, Activity, PauseCircle,
  Zap, PlayCircle
} from 'lucide-react';
import KanbanBoard from '../../components/crm/KanbanBoard';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Stage { id: string; name: string; color: string; order: number; probability: number; }
interface Pipeline { id: string; name: string; isDefault: boolean; stages: Stage[]; updatedAt?: string; }
interface Deal {
  id: string; title: string; amount: number; priority: string; probability: number;
  closeDate?: string; pipelineStageId?: string;
  pipelineStage?: { id: string; name: string; color: string };
  contact?: { id: string; firstName: string; lastName: string; phone?: string; email?: string };
  company?: { id: string; name: string };
  source?: string; status?: string; createdAt?: string;
}
interface Contact { id: string; name: string; firstName: string; lastName: string; email?: string; phone?: string; }


// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

const TEXT_COLORS: Record<string, string> = {
  '#F8BBD0': '#880E4F', // Pink
  '#B3E5FC': '#01579B', // Blue
  '#E1BEE7': '#4A148C', // Purple
  '#C8E6C9': '#1B5E20', // Green
  '#FFCCBC': '#BF360C', // Orange
  '#FFF9C4': '#F57F17', // Yellow
  '#F5F5F5': '#424242',
  '#E0E0E0': '#212121',
};

function getDarkTextColor(hex: string) {
  if (!hex || !hex.startsWith('#')) return '#1e293b';
  const upper = hex.toUpperCase();
  if (TEXT_COLORS[upper]) return TEXT_COLORS[upper];
  
  // Fallback for custom colors
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  s = Math.min(1, s * 1.5);
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, 22%)`;
}

async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url); if (!r.ok) throw new Error('Failed'); return r.json();
}

// ─── Add Opportunity Modal ────────────────────────────────────────────────────

function AddOpportunityModal({ pipelines, contacts, onClose, onSave, defaultPipelineId }: {
  pipelines: Pipeline[]; contacts: Contact[]; onClose: () => void; onSave: () => void; defaultPipelineId?: string;
}) {
  const qc = useQueryClient();
  const [contactSearch, setContactSearch] = useState('');
  const [contactDropOpen, setContactDropOpen] = useState(false);
  const [form, setForm] = useState({ title: '', pipelineId: defaultPipelineId || pipelines[0]?.id || '', stageId: '', status: 'open', amount: '', source: '', contactId: '', phone: '', email: '' });
  const [error, setError] = useState('');

  const selectedPipeline = pipelines.find(p => p.id === form.pipelineId);
  const stages = (selectedPipeline?.stages ?? []).sort((a, b) => a.order - b.order);

  useEffect(() => { if (stages.length && !form.stageId) setForm(f => ({ ...f, stageId: stages[0].id })); }, [stages.length]);

  const filteredContacts = contacts.filter(c => (c.name || `${c.firstName} ${c.lastName}`).toLowerCase().includes(contactSearch.toLowerCase()));

  const mut = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch('/api/crm/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); onSave(); },
    onError: () => setError('Failed to create opportunity. Please try again.'),
  });

  const [isCreatingContact, setIsCreatingContact] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) { setError('Opportunity name is required.'); return; }
    if (!form.stageId) { setError('Please select a stage.'); return; }
    setError('');

    let finalContactId = form.contactId || null;

    if (!finalContactId && (contactSearch || form.email || form.phone)) {
      setIsCreatingContact(true);
      try {
        const contactReq = await fetch('/api/crm/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: contactSearch.trim() || (form.email ? form.email.split('@')[0] : 'Unknown'),
            email: form.email || null,
            phone: form.phone || null,
          }),
        });
        if (contactReq.ok) {
          const contactData = await contactReq.json();
          finalContactId = contactData.id;
          qc.invalidateQueries({ queryKey: ['contacts'] });
        }
      } catch (err) {
        console.error('Failed to auto-create contact', err);
      } finally {
        setIsCreatingContact(false);
      }
    }

    mut.mutate({
      title: form.title,
      amount: parseFloat(form.amount) || 0,
      pipelineStageId: form.stageId,
      contactId: finalContactId,
      source: form.source || null,
      status: form.status,
      priority: 'medium',
      probability: stages.find(s => s.id === form.stageId)?.probability ?? 30
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}
        className="relative w-[680px] max-h-[90vh] rounded-2xl flex flex-col overflow-hidden z-10 border border-white/20 ring-1 ring-white/5 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        style={{ background: 'rgba(15,26,43,0.62)', backdropFilter: 'blur(32px) saturate(200%) brightness(1.10)', WebkitBackdropFilter: 'blur(32px) saturate(200%) brightness(1.10)' }}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/10 bg-white/[0.06]">
          <div><h2 className="text-[16px] font-bold text-text-main">Add new opportunity</h2><p className="text-[12px] text-text-muted mt-0.5">Fill in the details and select a contact to get started.</p></div>
          <button onClick={onClose} className="p-1.5 rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[148px] border-r border-white/10 bg-white/[0.03] p-4 shrink-0 pt-5">
            <div className="text-[12px] font-bold text-primary border-l-2 border-primary pl-2.5 py-1 bg-primary/5 rounded-r-[4px]">Opportunity Details</div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Contact section */}
            <div>
              <p className="text-[13px] font-bold text-text-main mb-3">Contact details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative space-y-1.5">
                  <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Primary Contact Name</label>
                  <div className="relative">
                    <input type="text" placeholder="Select Contact" value={contactSearch}
                      onChange={e => { setContactSearch(e.target.value); setContactDropOpen(true); }}
                      onFocus={() => setContactDropOpen(true)}
                      className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
                    />
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                  </div>
                  <AnimatePresence>
                    {contactDropOpen && filteredContacts.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setContactDropOpen(false)} />
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="absolute top-[calc(100%+2px)] left-0 right-0 bg-surface border border-border rounded-[8px] shadow-xl z-20 max-h-[180px] overflow-y-auto"
                        >
                          {filteredContacts.slice(0, 20).map(c => (
                            <button key={c.id} onClick={() => { setContactSearch(c.name || `${c.firstName} ${c.lastName}`); setForm(f => ({ ...f, contactId: c.id, email: c.email || f.email, phone: c.phone || f.phone })); setContactDropOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-hover text-left transition-colors"
                            >
                              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                                {(c.name || c.firstName || '?').charAt(0).toUpperCase()}
                              </div>
                              <div><div className="text-[12px] font-semibold text-text-main">{c.name || `${c.firstName} ${c.lastName}`}</div>{c.email && <div className="text-[11px] text-text-muted">{c.email}</div>}</div>
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Primary Email</label>
                  <input type="email" placeholder="Enter Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Primary Phone</label>
                  <input type="tel" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-border" />
            {/* Opportunity section */}
            <div>
              <p className="text-[13px] font-bold text-text-main mb-3">Opportunity Details</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Opportunity Name <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="Enter opportunity name" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Pipeline</label>
                    <select value={form.pipelineId} onChange={e => { const p = pipelines.find(x => x.id === e.target.value); setForm(f => ({ ...f, pipelineId: e.target.value, stageId: p?.stages?.[0]?.id || '' })); }}
                      className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
                    >
                      {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Stage</label>
                    <select value={form.stageId} onChange={e => setForm(f => ({ ...f, stageId: e.target.value }))}
                      className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
                    >
                      {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
                    >
                      <option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option><option value="abandoned">Abandoned</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Opportunity Value</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px] font-semibold">$</span>
                      <input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full pl-7 pr-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
                      />
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Opportunity Source</label>
                    <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                      className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
                    >
                      <option value="">None</option>
                      {['Referral', 'Email Campaign', 'Inbound', 'Outbound', 'Google', 'LinkedIn', 'Conference', 'Cold Call'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {error && <div className="flex items-center gap-2 px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-[6px] text-[12px] text-red-400"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-hover/30 shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={mut.isPending || isCreatingContact} className="btn-primary disabled:opacity-50">
            {mut.isPending || isCreatingContact ? 'Creating...' : 'Create'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Create/Edit Pipeline Modal ───────────────────────────────────────────────

function PipelineModal({ pipeline, onClose, onSave }: { pipeline?: Pipeline | null; onClose: () => void; onSave: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(pipeline?.name || '');
  const [stages, setStages] = useState<{ id: string; name: string; color: string; order: number; probability: number; isNew?: boolean }[]>(
    pipeline?.stages?.length
      ? [...pipeline.stages].sort((a, b) => a.order - b.order)
      : [
          { id: 'ns1', name: 'New Lead', color: '#64748b', order: 0, probability: 10, isNew: true },
          { id: 'ns2', name: 'Contacted', color: '#818cf8', order: 1, probability: 30, isNew: true },
          { id: 'ns3', name: 'Proposal Sent', color: '#fbbf24', order: 2, probability: 60, isNew: true },
          { id: 'ns4', name: 'Closed', color: '#34d399', order: 3, probability: 100, isNew: true },
        ]
  );
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { setNameError('Pipeline name is required'); return; }
    setNameError(''); setSaving(true);
    try {
      if (pipeline) {
        await fetch(`/api/crm/pipelines/${pipeline.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        for (const s of stages.filter(s => !s.isNew)) {
          await fetch(`/api/crm/pipelines/${pipeline.id}/stages/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: s.name, order: s.order }) });
        }
      } else {
        const r = await fetch('/api/crm/pipelines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, stages: stages.map((s, i) => ({ name: s.name, color: s.color, order: i, probability: s.probability })) }) });
        if (!r.ok) throw new Error('Failed');
      }
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      onSave();
    } catch { setNameError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const STAGE_COLORS = ['#64748b','#818cf8','#fbbf24','#a78bfa','#34d399','#ef4444','#f97316','#06b6d4','#8b5cf6','#ec4899'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}
        className="relative w-[600px] max-h-[85vh] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-[16px] font-bold text-text-main">{pipeline ? 'Edit Pipeline' : 'Create Pipeline'}</h2>
            <p className="text-[12px] text-text-muted mt-0.5">Configure your pipeline stages and display settings.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-text-muted">Pipeline name <span className="text-red-400">*</span></label>
            <input type="text" placeholder="e.g. Standard Sales" value={name} onChange={e => { setName(e.target.value); setNameError(''); }}
              className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
            />
            {nameError && <p className="text-[11px] text-red-400">{nameError}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-bold text-text-main">Pipeline stages ({stages.length})</h3>
                <p className="text-[11px] text-text-muted mt-0.5">Drag to reorder · Click color to change</p>
              </div>
              <button onClick={() => setStages(s => [...s, { id: `ns_${Date.now()}`, name: '', color: STAGE_COLORS[s.length % STAGE_COLORS.length], order: s.length, probability: 50, isNew: true }])}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:opacity-80 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" /> Add stage
              </button>
            </div>

            <div className="rounded-[8px] border border-border overflow-hidden">
              <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center px-4 py-2.5 bg-surface-hover/60 border-b border-border gap-3">
                <div className="w-4" />
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider w-5">Color</div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Stage Name</div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider w-16 text-center">Win %</div>
                <div className="w-6" />
              </div>
              {stages.map((stage, i) => (
                <div key={stage.id} className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center px-4 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-surface-hover/20 transition-colors gap-3">
                  <GripVertical className="w-4 h-4 text-text-muted cursor-grab" />
                  <div className="relative w-5 h-5 rounded-full cursor-pointer shrink-0" style={{ backgroundColor: stage.color }}>
                    <input type="color" value={stage.color} onChange={e => setStages(s => s.map((st, idx) => idx === i ? { ...st, color: e.target.value } : st))}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer rounded-full"
                    />
                  </div>
                  <input type="text" value={stage.name} onChange={e => setStages(s => s.map((st, idx) => idx === i ? { ...st, name: e.target.value } : st))}
                    placeholder="Stage name"
                    className="bg-transparent border-none text-[13px] font-medium text-text-main focus:outline-none focus:bg-surface-hover rounded px-1 py-0.5 placeholder:text-text-muted/50"
                  />
                  <div className="flex items-center gap-1 w-16">
                    <input type="number" min="0" max="100" value={stage.probability}
                      onChange={e => setStages(s => s.map((st, idx) => idx === i ? { ...st, probability: parseInt(e.target.value) || 0 } : st))}
                      className="w-10 bg-surface-hover border border-border rounded-[4px] text-[12px] text-text-main text-center focus:outline-none focus:border-primary px-1 py-0.5"
                    />
                    <span className="text-[11px] text-text-muted">%</span>
                  </div>
                  <button onClick={() => setStages(s => s.filter((_, idx) => idx !== i))}
                    className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {stages.length === 0 && (
                <div className="px-4 py-8 text-center text-[12px] text-text-muted">No stages yet. Add one above.</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-hover/30 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-muted border border-border hover:bg-surface-hover transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !name.trim()} className="px-5 py-2 rounded-[6px] text-[13px] font-semibold text-white bg-primary hover:opacity-90 disabled:opacity-40 transition-opacity">
            {saving ? 'Saving...' : pipeline ? 'Save Changes' : 'Create Pipeline'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

const DealCard: React.FC<{ deal: Deal; index: number; onDelete: () => void; onEdit: () => any; }> = ({ deal, index, onDelete, onEdit }) => {
  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onEdit}
          className={`p-3 mb-2.5 bg-surface border border-border rounded-[8px] shadow-sm hover:shadow-md cursor-pointer hover:border-primary/40 transition-all group ${
            snapshot.isDragging
              ? 'border-primary shadow-lg shadow-primary/10 rotate-[1deg] bg-surface'
              : 'border-border/60 hover:border-border hover:shadow-md'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-[12px] font-semibold text-text-main leading-snug pr-1 flex-1">{deal.title}</h4>
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1 mb-2.5">
            {deal.company && (
              <div className="flex text-[11px]"><span className="text-text-muted w-[95px] shrink-0">Business Name:</span><span className="text-text-main font-medium truncate">{deal.company.name}</span></div>
            )}
            {deal.source && (
              <div className="flex text-[11px]"><span className="text-text-muted w-[95px] shrink-0">Source:</span><span className="text-text-main font-medium truncate">{deal.source}</span></div>
            )}
            <div className="flex text-[11px]"><span className="text-text-muted w-[95px] shrink-0">Value:</span><span className="text-text-main font-semibold">${(deal.amount || 0).toLocaleString()}</span></div>
          </div>

          <div className="flex items-center gap-1.5 pt-2 border-t border-border/40">
            {[Phone, MessageSquare, Mail, CheckSquare, Calendar].map((Icon, j) => (
              <button key={j} onClick={e => e.stopPropagation()} className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                <Icon className="w-2.5 h-2.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── Edit Deal Modal ──────────────────────────────────────────────────────────

function EditDealModal({ deal, pipelines, onClose, onSave }: { deal: Deal; pipelines: Pipeline[]; onClose: () => void; onSave: () => void }) {
  const qc = useQueryClient();
  const allStages = pipelines.flatMap(p => (p.stages || []).map(s => ({ ...s, pipelineName: p.name })));
  const [form, setForm] = useState({ title: deal.title, amount: String(deal.amount || ''), pipelineStageId: deal.pipelineStageId || deal.pipelineStage?.id || '', source: deal.source || '', status: deal.status || 'open' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/crm/deals/${deal.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, amount: parseFloat(form.amount) || 0, pipelineStageId: form.pipelineStageId, source: form.source, status: form.status }) });
      if (!r.ok) throw new Error('Failed');
      qc.invalidateQueries({ queryKey: ['deals'] });
      onSave();
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        className="relative w-[480px] rounded-2xl z-10 border border-white/20 ring-1 ring-white/5 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        style={{ background: 'rgba(15,26,43,0.62)', backdropFilter: 'blur(32px) saturate(200%) brightness(1.10)', WebkitBackdropFilter: 'blur(32px) saturate(200%) brightness(1.10)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.06]">
          <h2 className="text-[15px] font-bold text-text-main">Edit Opportunity</h2>
          <button onClick={onClose} className="p-1.5 rounded-full text-text-muted hover:bg-surface-hover transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5"><label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Name</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Value</label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">$</span>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full pl-7 pr-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div className="space-y-1.5"><label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary">
                <option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option><option value="abandoned">Abandoned</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5"><label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Stage</label>
            <select value={form.pipelineStageId} onChange={e => setForm(f => ({ ...f, pipelineStageId: e.target.value }))} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary">
              {allStages.map(s => <option key={s.id} value={s.id}>{s.pipelineName} → {s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Source</label>
            <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary">
              <option value="">None</option>{['Referral','Email Campaign','Inbound','Outbound','Google','LinkedIn','Conference','Cold Call'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-hover/30">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Pipelines Tab ────────────────────────────────────────────────────────────

// Icon aliases
const GitBranch2 = GitBranch;

function PipelinesTab({ pipelines, onRefresh, onBack }: { pipelines: Pipeline[]; onRefresh: () => void; onBack: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = pipelines.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const del = async (id: string) => {
    if (!confirm('Delete this pipeline? Deals will lose their stage assignment.')) return;
    await fetch(`/api/crm/pipelines/${id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['pipelines'] });
  };

  return (
    <div className="flex-1 overflow-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-[22px] font-bold text-text-main">Pipelines</h2>
            <p className="text-[13px] text-text-muted mt-1 max-w-xl">Manage your sales pipelines and configure stages. Each pipeline can have its own stages, colors, and win probabilities.</p>
          </div>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Create Pipeline
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Pipelines', value: pipelines.length, icon: GitBranch2, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total Stages', value: pipelines.reduce((s, p) => s + (p.stages?.length || 0), 0), icon: GitBranch, color: 'text-violet-400', bg: 'bg-violet-400/10' },
          { label: 'Default Pipeline', value: pipelines.find(p => p.isDefault)?.name || '—', icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface border border-border rounded-[10px] px-5 py-4 flex items-center gap-4 shadow-sm">
            <div className={`w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 ${stat.bg}`}>
              <TrendingUp className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{stat.label}</div>
              <div className="text-[18px] font-bold text-text-main">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-[10px] overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <h3 className="text-[13px] font-bold text-text-main">All Pipelines</h3>
          <div className="relative w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input type="text" placeholder="Search pipelines..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-[6px] text-[12px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_120px_200px_80px] items-center px-5 py-3 bg-surface-hover/20 border-b border-border">
          {['Pipeline Name', 'No. of Stages', 'Updated On', 'Actions'].map(h => (
            <div key={h} className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{h}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-hover border border-border flex items-center justify-center mx-auto mb-3"><Target className="w-6 h-6 text-text-muted" /></div>
            <p className="text-[14px] font-semibold text-text-main mb-1">No pipelines found</p>
            <p className="text-[12px] text-text-muted">Create your first pipeline to start tracking deals.</p>
          </div>
        ) : filtered.map(pipeline => (
          <div key={pipeline.id}
            className="grid grid-cols-[1fr_120px_200px_80px] items-center px-5 py-4 border-b border-border/40 last:border-b-0 hover:bg-surface-hover/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {(pipeline.stages || []).slice(0, 5).map(s => (
                  <div key={s.id} className="w-1.5 h-6 rounded-full" style={{ backgroundColor: s.color }} />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-main">{pipeline.name}</span>
                  {pipeline.isDefault && <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-[3px]">Default</span>}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">{(pipeline.stages || []).map(s => s.name).join(' → ')}</div>
              </div>
            </div>
            <div className="text-[13px] font-medium text-text-muted">{(pipeline.stages || []).length} stages</div>
            <div className="text-[12px] text-text-muted">
              {pipeline.updatedAt ? new Date(pipeline.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </div>
            <div className="relative flex justify-start">
              <button onClick={() => setMenuOpen(menuOpen === pipeline.id ? null : pipeline.id)}
                className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen === pipeline.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute left-0 top-[calc(100%+4px)] w-[160px] bg-surface border border-border rounded-[8px] shadow-xl z-20 py-1"
                    >
                      <button onClick={() => { setEditingPipeline(pipeline); setMenuOpen(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                        <Edit2 className="w-3.5 h-3.5" /> Edit Pipeline
                      </button>
                      <button onClick={() => { del(pipeline.id); setMenuOpen(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}

        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-[12px] text-text-muted">
          <span>{filtered.length} pipeline{filtered.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <span>1 - {filtered.length} of {filtered.length}</span>
            <button className="px-2.5 py-1 rounded-[4px] bg-primary text-white text-[11px] font-bold">1</button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {createOpen && <PipelineModal onClose={() => setCreateOpen(false)} onSave={() => { setCreateOpen(false); onRefresh(); }} />}
        {editingPipeline && <PipelineModal pipeline={editingPipeline} onClose={() => setEditingPipeline(null)} onSave={() => { setEditingPipeline(null); onRefresh(); }} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Bulk Actions Tab ─────────────────────────────────────────────────────────

const MOCK_BULK_ACTIONS = [
  { id: 'ba1', label: 'Update status → Active', operation: 'Update Field', status: 'completed', user: 'Jack Stone', created: '2026-04-22 11:30 AM', completed: '2026-04-22 11:31 AM', total: 45, done: 45 },
  { id: 'ba2', label: 'Add tag: enterprise', operation: 'Add Tag', status: 'completed', user: 'Jack Stone', created: '2026-04-21 09:15 AM', completed: '2026-04-21 09:16 AM', total: 28, done: 28 },
  { id: 'ba3', label: 'Send follow-up email', operation: 'Send Email', status: 'running', user: 'Jack Stone', created: '2026-04-22 11:45 AM', completed: null, total: 120, done: 67 },
  { id: 'ba4', label: 'Move to pipeline: Q2 Sales', operation: 'Update Pipeline', status: 'paused', user: 'Jack Stone', created: '2026-04-20 02:00 PM', completed: null, total: 15, done: 6 },
  { id: 'ba5', label: 'Export contacts CSV', operation: 'Export', status: 'failed', user: 'Jack Stone', created: '2026-04-19 10:00 AM', completed: '2026-04-19 10:02 AM', total: 200, done: 0 },
];

function BulkActionsTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [actions, setActions] = useState(MOCK_BULK_ACTIONS);

  const filtered = actions.filter(a => {
    const matchSearch = a.label.toLowerCase().includes(search.toLowerCase()) || a.operation.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || a.status === filter;
    return matchSearch && matchFilter;
  });

  const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    completed: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    running:   { label: 'Running',   icon: Activity,    color: 'text-blue-400',    bg: 'bg-blue-400/10' },
    paused:    { label: 'Paused',    icon: PauseCircle, color: 'text-amber-400',   bg: 'bg-amber-400/10' },
    failed:    { label: 'Failed',    icon: XCircle,     color: 'text-red-400',     bg: 'bg-red-400/10' },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border bg-surface flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-[20px] font-bold text-text-main">Bulk Actions</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Run and monitor operations on multiple contacts at once.</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> New Bulk Action
        </button>
      </div>

      {/* Stats */}
      <div className="px-8 py-4 border-b border-border bg-surface-hover/30 grid grid-cols-4 gap-4 shrink-0">
        {[
          { label: 'Total', value: actions.length, color: 'text-text-main' },
          { label: 'Running', value: actions.filter(a => a.status === 'running').length, color: 'text-blue-400' },
          { label: 'Completed', value: actions.filter(a => a.status === 'completed').length, color: 'text-emerald-400' },
          { label: 'Failed', value: actions.filter(a => a.status === 'failed').length, color: 'text-red-400' },
        ].map((s, i) => (
          <div key={i} className="bg-surface border border-border rounded-[8px] px-4 py-3">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{s.label}</div>
            <div className={`text-[22px] font-bold mt-0.5 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-8 py-3 border-b border-border bg-surface flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          {['all', 'running', 'completed', 'paused', 'failed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium capitalize transition-colors ${filter === f ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main hover:bg-surface-hover border border-border'}`}
            >
              {f === 'all' ? 'All Actions' : f}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input type="text" placeholder="Search actions..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 w-[240px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] focus:outline-none focus:border-primary placeholder:text-text-muted"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto mx-8 my-6 rounded-[10px] bg-surface/40 border border-border/60 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="sticky top-0 border-b border-border bg-surface/90 backdrop-blur-sm z-10">
            <tr>
              {['Action Label', 'Operation', 'Status', 'User', 'Created', 'Completed', 'Progress'].map(h => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center border border-border bg-surface-hover">
                    <Zap className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-[16px] font-bold text-text-main">No Bulk Actions</h2>
                  <p className="text-[13px] text-text-muted text-center max-w-sm">Select multiple contacts in the Contacts view to run a bulk action.</p>
                  <a href="/crm/contacts" className="mt-2 px-5 py-2 rounded-[6px] text-[13px] font-bold text-white bg-primary hover:opacity-90 transition-opacity shadow-sm">Go to Contacts</a>
                </div>
              </td></tr>
            ) : filtered.map(action => {
              const sc = statusConfig[action.status] || statusConfig.completed;
              const StatusIcon = sc.icon;
              const pct = Math.round((action.done / action.total) * 100);
              return (
                <tr key={action.id} className="hover:bg-surface-hover/30 transition-colors group">
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-semibold text-text-main">{action.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-surface-hover border border-border text-text-muted">{action.operation}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold w-fit ${sc.bg} ${sc.color}`}>
                      <StatusIcon className="w-3 h-3" /> {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-text-muted">{action.user}</td>
                  <td className="px-4 py-3 text-[12px] text-text-muted whitespace-nowrap">{action.created}</td>
                  <td className="px-4 py-3 text-[12px] text-text-muted whitespace-nowrap">{action.completed || '—'}</td>
                  <td className="px-4 py-3 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: action.status === 'failed' ? '#ef4444' : action.status === 'completed' ? '#34d399' : 'var(--primary)' }} />
                      </div>
                      <span className="text-[11px] font-semibold text-text-muted w-14 shrink-0">{action.done}/{action.total}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {action.status === 'running' && <button onClick={() => setActions(a => a.map(x => x.id === action.id ? { ...x, status: 'paused' } : x))} className="w-6 h-6 rounded flex items-center justify-center text-amber-400 hover:bg-amber-400/10 transition-colors"><PauseCircle className="w-3.5 h-3.5" /></button>}
                      {action.status === 'paused' && <button onClick={() => setActions(a => a.map(x => x.id === action.id ? { ...x, status: 'running' } : x))} className="w-6 h-6 rounded flex items-center justify-center text-blue-400 hover:bg-blue-400/10 transition-colors"><PlayCircle className="w-3.5 h-3.5" /></button>}
                      <button onClick={() => setActions(a => a.filter(x => x.id !== action.id))} className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-8 py-3 border-t border-border bg-surface flex items-center justify-between text-[12px] text-text-muted shrink-0">
        <span>Page 1 of 1</span>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 text-text-muted hover:text-text-main transition-colors font-medium">Prev</button>
          <button className="px-3 py-1 rounded-[4px] bg-primary text-white font-bold shadow-sm">1</button>
          <button className="px-3 py-1 text-text-muted hover:text-text-main transition-colors font-medium">Next</button>
        </div>
      </div>
    </div>
  );
}

export default function Opportunities() {
  const qc = useQueryClient();
  const [pipelinesOpen, setPipelinesOpen] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const [invoiceDeal, setInvoiceDeal] = useState<{ id: string; amount: number } | null>(null);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  
  // Inline editing state
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  
  const PASTEL_COLORS = [
    '#FFF59D', '#FFCC80', '#FFCDD2', '#F48FB1', '#F8BBD0', '#E1BEE7',
    '#E6EE9C', '#C5E1A5', '#A5D6A7', '#80CBC4', '#80DEEA', '#B2DFDB',
    '#C5CAE9', '#D1C4E9', '#E1BEE7', '#CE93D8', '#9FA8DA', '#90CAF9',
    '#81D4FA', '#B3E5FC', '#4DD0E1', '#90CAF9', '#CFD8DC', '#B0BEC5'
  ];

  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery<Pipeline[]>({ queryKey: ['pipelines'], queryFn: () => apiFetch('/api/crm/pipelines') });
  const { data: rawDeals = [], isLoading: loadingDeals } = useQuery<Deal[]>({ queryKey: ['deals'], queryFn: () => apiFetch('/api/crm/deals') });
  const { data: contacts = [] } = useQuery<Contact[]>({ queryKey: ['contacts'], queryFn: () => apiFetch('/api/crm/contacts').then((res: any) => res.contacts || []) });

  const allStages = pipelines.flatMap(p => p.stages || []);
  const stageMap = new Map(allStages.map(s => [s.id, { ...s, pipeline: pipelines.find(p => p.stages?.some(ps => ps.id === s.id)) }]));

  const deals = rawDeals.filter(d => {
    const stageId = (d as any).pipelineStageId || d.pipelineStage?.id;
    const pipelineMatch = selectedPipelineId === 'all' || pipelines.find(p => p.stages?.some(s => s.id === stageId))?.id === selectedPipelineId;
    const searchMatch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || (d.company?.name || '').toLowerCase().includes(search.toLowerCase());
    return pipelineMatch && searchMatch;
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/crm/deals/${id}`, { method: 'DELETE' }); if (!r.ok) throw new Error('Failed'); return r.json(); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });

  const updateStage = async (stageId: string, updates: any) => {
    try {
      let pId = selectedPipelineId;
      if (pId === 'all') {
        const p = pipelines.find(p => p.stages?.some(s => s.id === stageId));
        if (p) pId = p.id;
      }
      if (!pId || pId === 'all') return;
      await apiClient.put(`/crm/pipelines/${pId}/stages/${stageId}`, updates);
      qc.invalidateQueries({ queryKey: ['pipelines'] });
    } catch (e) { console.error(e); }
  };

  const addNewGroup = async () => {
    setAddingGroup(true);
    try {
      let pId = selectedPipelineId;
      if (pId === 'all') pId = pipelines[0]?.id;
      if (!pId || pId === 'all') return;
      
      const newColor = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
      await apiClient.post(`/crm/pipelines/${pId}/stages`, {
        name: 'New Group',
        color: newColor,
        order: 99,
        probability: 50
      });
      qc.invalidateQueries({ queryKey: ['pipelines'] });
    } catch (e) { console.error(e); }
    finally { setAddingGroup(false); }
  };

  const moveDealToStage = useCallback(async (dealId: string, stageId: string) => {
    try {
      await fetch(`/api/crm/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStageId: stageId }),
      });
      qc.invalidateQueries({ queryKey: ['deals'] });
    } catch (e) { console.error(e); }
  }, [qc]);

  const onDragEnd = useCallback((result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const targetStageId = destination.droppableId;
    const deal = rawDeals.find(d => d.id === draggableId) as any;
    const currentStageId = deal?.pipelineStageId || deal?.pipelineStage?.id;
    if (targetStageId !== currentStageId) {
      moveDealToStage(draggableId, targetStageId);
    }
  }, [rawDeals, moveDealToStage]);

  const toggleSelect = (id: string) => { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleAll = () => { if (selected.size === deals.length && deals.length > 0) setSelected(new Set()); else setSelected(new Set(deals.map(d => d.id))); };

  const isLoading = loadingPipelines || loadingDeals;
  const AVATAR_COLORS = ['#4F8EF7', '#52C27E', '#F5A623', '#9B59B6', '#E74C3C', '#1ABC9C', '#3498DB', '#E67E22'];

  const groupedDeals = allStages.map(stage => {
    const stageDeals = deals.filter(deal => {
      const raw = rawDeals.find(d => d.id === deal.id) as any;
      const stageId = raw?.pipelineStageId || raw?.pipelineStage?.id;
      return stageId === stage.id;
    });
    return { stage, deals: stageDeals };
  });
  
  const unassignedDeals = deals.filter(deal => {
    const raw = rawDeals.find(d => d.id === deal.id) as any;
    const stageId = raw?.pipelineStageId || raw?.pipelineStage?.id;
    return !allStages.find(s => s.id === stageId);
  });
  
  if (unassignedDeals.length > 0) {
    groupedDeals.push({ stage: { id: 'unassigned', name: 'Unassigned', color: '#888888', order: 999, probability: 0 }, deals: unassignedDeals });
  }

  return (
    <div className="flex flex-col h-full w-full bg-bg relative">

      {/* ── Top Header ── */}
      <div className="flex-none px-8 py-5 border-b border-border bg-surface flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold text-text-main flex items-center">
              Opportunities
            </h1>
            <span className="text-text-muted text-[13px] font-medium ml-1">
              Manage your sales pipeline and track deal progress.
            </span>
          </div>
          {pipelines.length > 1 && (
            <div className="relative group ml-4">
              <select
                value={selectedPipelineId}
                onChange={e => setSelectedPipelineId(e.target.value)}
                className="appearance-none bg-surface-hover/50 border border-border rounded-lg pl-3 pr-8 py-1.5 text-[13px] font-medium text-text-main focus:outline-none focus:border-primary cursor-pointer hover:bg-surface-hover transition-colors"
              >
                <option value="all">All Pipelines</option>
                {pipelines.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none group-hover:text-text-main transition-colors" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => setPipelinesOpen(true)} className="btn-secondary">
             Pipeline Settings
           </button>
           <button onClick={() => setAddModalOpen(true)} className="btn-primary">
             <Plus className="w-4 h-4 mr-1" /> Create Opportunity
           </button>
           <div className="flex items-center border border-border rounded-lg bg-surface-hover/30 p-1 ml-2 shadow-sm">
             <button onClick={() => setView('list')} className={`p-1.5 rounded-[6px] transition-all duration-200 ${view === 'list' ? 'bg-surface shadow-sm text-text-main border border-border/50' : 'text-text-muted hover:text-text-main'}`}>
               <List className="w-4 h-4" />
             </button>
             <button onClick={() => setView('kanban')} className={`p-1.5 rounded-[6px] transition-all duration-200 ${view === 'kanban' ? 'bg-surface shadow-sm text-text-main border border-border/50' : 'text-text-muted hover:text-text-main'}`}>
               <LayoutGrid className="w-4 h-4" />
             </button>
           </div>
        </div>
      </div>

      {/* ── Table — matches Contacts container + row style ── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        <div className="flex-1 overflow-hidden mx-8 mt-4 mb-6 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 relative">
          <KanbanBoard
            deals={deals.map(d => {
              const raw = rawDeals.find(rd => rd.id === d.id) as any;
              const stageId = raw?.pipelineStageId || raw?.pipelineStage?.id;
              const stage = stageMap.get(stageId);
              return { ...d, stage: stage?.name || 'Unknown' } as any;
            })}
            stages={selectedPipelineId === 'all' ? allStages : (pipelines.find(p => p.id === selectedPipelineId)?.stages || [])}
            onDealMove={(dealId, stageName) => {
              const stage = allStages.find(s => s.name === stageName);
              if (stage) {
                fetch(`/api/crm/deals/${dealId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pipelineStageId: stage.id })
                }).then(() => qc.invalidateQueries({ queryKey: ['deals'] }));
              }
            }}
            onDealDelete={(dealId) => deleteDeal.mutate(dealId)}
            onDealEdit={(dealId) => setEditingDeal(rawDeals.find(d => d.id === dealId) as Deal)}
            onAddDeal={(stageName) => setAddModalOpen(true)}
          />
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 relative">
            <div className="flex flex-col gap-10">
            {groupedDeals.map(group => {
              const groupTotal = group.deals.reduce((sum, d) => sum + (d.amount || 0), 0);
              return (
                <div key={group.stage.id} className="flex flex-col">
                  {/* Group Header */}
                  <div className="flex items-center gap-2 mb-2 ml-1 relative">
                    <ChevronDown className="w-5 h-5 transition-transform cursor-pointer" style={{ color: group.stage.color }} />
                    <div className="relative">
                      {editingStageId === group.stage.id ? (
                        <input
                          autoFocus
                          defaultValue={group.stage.name}
                          onBlur={(e) => {
                            if (e.target.value !== group.stage.name) updateStage(group.stage.id, { name: e.target.value });
                            setEditingStageId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (e.currentTarget.value !== group.stage.name) updateStage(group.stage.id, { name: e.currentTarget.value });
                              setEditingStageId(null);
                            } else if (e.key === 'Escape') {
                              setEditingStageId(null);
                            }
                          }}
                          className="text-[18px] font-semibold bg-surface-hover border border-border rounded px-1 -ml-1 focus:outline-none focus:border-primary"
                          style={{ color: group.stage.color, width: '200px' }}
                        />
                      ) : (
                        <h3 
                          className="text-[18px] font-semibold cursor-text hover:opacity-80 transition-opacity" 
                          style={{ color: group.stage.color }}
                          onClick={() => setEditingStageId(group.stage.id)}
                        >
                          {group.stage.name}
                        </h3>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => setActiveColorPicker(activeColorPicker === group.stage.id ? null : group.stage.id)}
                      className="w-5 h-5 rounded-full border-2 border-surface ml-2 shadow-sm cursor-pointer hover:scale-110 transition-transform relative"
                      style={{ backgroundColor: group.stage.color }}
                    />
                    
                    {/* Inline Color Picker Popover */}
                    <AnimatePresence>
                      {activeColorPicker === group.stage.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActiveColorPicker(null)} />
                          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute left-[calc(100%+8px)] top-0 bg-surface border border-border shadow-luxury rounded-xl p-3 z-20 w-[220px]"
                          >
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Stage Color</div>
                            <div className="grid grid-cols-6 gap-2">
                              {PASTEL_COLORS.map(color => (
                                <button key={color} onClick={() => { updateStage(group.stage.id, { color }); setActiveColorPicker(null); }}
                                  className="w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform border border-black/10"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Table Wrapper */}
                  <div className="bg-surface/40 backdrop-blur-2xl border border-border/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[12px] overflow-hidden">
                    <table className="w-full text-left text-[13px] border-collapse">
                      <thead className="border-b border-border bg-surface-hover/50">
                        <tr>
                          <th className="w-8 text-center border-r border-border relative"><div className="w-[6px] h-full absolute left-0 top-0 bottom-0" style={{ backgroundColor: group.stage.color }} /></th>
                          <th className="w-10 text-center border-r border-border"><input type="checkbox" className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5" /></th>
                          <th className="p-2 border-r border-border font-medium text-text-main w-[240px]">Deal</th>
                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[120px]">Activities time...</th>
                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[140px]">Stage</th>
                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[100px]">Owner</th>
                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[120px]">Deal Value</th>
                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[160px]">Contacts</th>
                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[160px]">Accounts</th>
                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-8"><Plus className="w-4 h-4 inline-block opacity-50" /></th>
                        </tr>
                      </thead>
                      <Droppable droppableId={group.stage.id}>
                        {(provided, snapshot) => (
                          <tbody
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`transition-colors duration-150 ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                          >
                            {group.deals.map((deal, index) => {
                              const raw = rawDeals.find(d => d.id === deal.id) as any;
                              const contactName = raw?.contact ? `${raw.contact.firstName || ''} ${raw.contact.lastName || ''}`.trim() : '—';
                              return (
                                <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                  {(drag, dragSnapshot) => (
                                    <tr
                                      ref={drag.innerRef}
                                      {...drag.draggableProps}
                                      style={{ 
                                        ...drag.draggableProps.style, 
                                        display: dragSnapshot.isDragging ? 'table' : '',
                                        tableLayout: dragSnapshot.isDragging ? 'fixed' : '',
                                        width: dragSnapshot.isDragging ? '1144px' : '',
                                        background: dragSnapshot.isDragging ? 'var(--surface)' : '',
                                        zIndex: dragSnapshot.isDragging ? 9999 : 'auto'
                                      }}
                                      className={`border-b border-border group/row cursor-pointer transition-colors ${dragSnapshot.isDragging ? 'shadow-2xl ring-1 ring-border shadow-black/20' : 'hover:bg-surface-hover/30'}`}
                                      onClick={() => setEditingDeal(raw as Deal)}
                                    >
                                      <td className="w-8 text-center border-r border-border relative" onClick={e => e.stopPropagation()}>
                                        <div className="w-[6px] absolute left-0 top-0 bottom-0" style={{ backgroundColor: group.stage.color }} />
                                        <div
                                          {...drag.dragHandleProps}
                                          className="flex items-center justify-center h-full min-h-[36px] cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-60 hover:opacity-100 transition-opacity"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          <GripVertical className="w-3.5 h-3.5 text-text-muted" />
                                        </div>
                                      </td>
                                      <td className="w-10 text-center border-r border-border" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5" />
                                      </td>
                                      <td className="p-2 border-r border-border w-[240px]">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-text-main group-hover/row:underline truncate">{deal.title}</span>
                                          <div className="flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                                            <Sparkles className="w-3.5 h-3.5 text-primary cursor-pointer hover:scale-110 transition-transform" />
                                            <MessageSquare className="w-3.5 h-3.5 text-text-muted hover:text-primary cursor-pointer" />
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-0 border-r border-border align-middle w-[120px]">
                                        <div className="flex items-center justify-center gap-1 px-4">
                                          <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden flex">
                                            <div className="w-1/4 h-full bg-border/40 border-r border-bg"></div>
                                            <div className="w-1/4 h-full bg-border/40 border-r border-bg"></div>
                                            <div className="w-1/4 h-full bg-border/40 border-r border-bg"></div>
                                            <div className="w-1/4 h-full bg-surface-hover"></div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-0 border-r border-border text-center w-[140px]">
                                        <div className="w-full h-full min-h-[36px] flex items-center justify-center text-[12px] font-medium px-2" style={{ backgroundColor: group.stage.color, color: getDarkTextColor(group.stage.color) }}>
                                          {group.stage.name}
                                        </div>
                                      </td>
                                      <td className="p-0 border-r border-border align-middle w-[100px]">
                                        <div className="flex justify-center items-center h-full min-h-[36px]">
                                          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-surface border border-border shadow-sm">
                                            <User className="w-4 h-4 text-text-muted" />
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-2 border-r border-border text-center text-text-main w-[120px]">
                                        ${(deal.amount || 0).toLocaleString()}
                                      </td>
                                      <td className="p-0 border-r border-border text-center align-middle relative group/cell w-[160px]">
                                        <div className="absolute inset-0 bg-[#B3E5FC]/10 transition-colors group-hover/cell:bg-[#B3E5FC]/20 pointer-events-none" />
                                        {contactName !== '—' ? (
                                          <div className="w-full h-full min-h-[36px] flex items-center justify-center text-[#01579B] bg-[#B3E5FC] text-[12px] font-medium">
                                            <div className="flex items-center gap-1.5 truncate px-1">
                                              <UserPlus className="w-3.5 h-3.5 shrink-0" />
                                              <span className="truncate">{contactName}</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="w-full h-full min-h-[36px] flex items-center justify-center">
                                            <span className="text-[12px] text-text-muted opacity-50">—</span>
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-0 border-r border-border text-center align-middle relative group/cell w-[160px]">
                                        <div className="absolute inset-0 bg-[#F8BBD0]/10 transition-colors group-hover/cell:bg-[#F8BBD0]/20 pointer-events-none" />
                                        <div className="w-full h-full min-h-[36px] flex items-center justify-center text-[#880E4F] bg-[#F8BBD0] text-[12px] font-medium">
                                          <div className="flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5" />
                                            Account
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-2 border-r border-border text-center w-8"></td>
                                    </tr>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                            {/* Add deal inline */}
                            <tr className="group/add">
                              <td colSpan={10} className="p-0 relative">
                                <div className="w-[6px] absolute left-0 top-0 bottom-0" style={{ backgroundColor: group.stage.color }} />
                                <div className="py-2.5 px-12 text-[13px] text-text-muted hover:text-text-main cursor-pointer transition-colors bg-surface/50 hover:bg-surface-hover flex items-center gap-1.5 border-t border-border/50" onClick={() => setAddModalOpen(true)}>
                                  <Plus className="w-4 h-4 opacity-70 group-hover/add:opacity-100" /> Add deal
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        )}
                      </Droppable>
                      {/* Summary Row */}
                      <tfoot>
                        <tr className="border-t border-border bg-surface-hover/20">
                          <td colSpan={6} className="border-r border-border relative h-[40px]">
                            <div className="w-[6px] absolute left-0 top-0 bottom-0" style={{ backgroundColor: group.stage.color }} />
                          </td>
                          <td className="p-1 border-r border-border text-center">
                            <div className="text-text-main font-semibold">${groupTotal.toLocaleString()}</div>
                            <div className="text-[10px] text-text-muted font-medium">sum</div>
                          </td>
                          <td colSpan={3} className="border-r border-border"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}
            
            {/* Add New Group Button */}
            <button 
              onClick={addNewGroup}
              disabled={addingGroup}
              className="mt-2 ml-1 px-4 py-2 bg-surface text-text-main border border-border rounded shadow-sm font-medium text-[13px] hover:bg-surface-hover hover:border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-fit"
            >
              {addingGroup ? 'Adding group...' : '+ Add new group'}
            </button>
          </div>
        </div>
        </DragDropContext>
      )}

      {/* ── Footer — exact Contacts layout ── */}
      <div className="px-8 py-4 border-t border-border bg-surface flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0">
        <div className="font-semibold text-text-muted flex items-center gap-3">
          Page 1 of 1
          <div className="w-[1px] h-4 bg-border" />
          <span className="px-2.5 py-0.5 rounded-lg text-[13px] font-medium bg-bg text-text-main shadow-sm border border-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/60" />
            {deals.length} Opportunities
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5 cursor-pointer font-semibold hover:border-primary/50 transition-colors bg-bg text-text-main">
            20 <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="flex items-center gap-1.5 font-semibold">
            <button className="px-3 py-1.5 transition-colors text-text-muted hover:text-text-main">Prev</button>
            <button className="px-3.5 py-1.5 rounded-lg shadow-sm text-bg font-bold" style={{ backgroundColor: 'var(--primary)' }}>1</button>
            <button className="px-3 py-1.5 transition-colors text-text-muted hover:text-text-main">Next</button>
          </div>
        </div>
      </div>

      {/* ── Pipeline Config slide-over ── */}
      <AnimatePresence>
        {pipelinesOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[2px]"
              onClick={() => setPipelinesOpen(false)} />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[640px] bg-surface shadow-luxury z-50 flex flex-col border-l border-border overflow-hidden"
            >
              <div className="flex-1 overflow-auto">
                <PipelinesTab pipelines={pipelines} onRefresh={() => qc.invalidateQueries({ queryKey: ['pipelines'] })} onBack={() => setPipelinesOpen(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {addModalOpen && (
          <AddOpportunityModal pipelines={pipelines} contacts={contacts} defaultPipelineId={selectedPipelineId === 'all' ? (pipelines[0]?.id || '') : selectedPipelineId} onClose={() => setAddModalOpen(false)} onSave={() => setAddModalOpen(false)} />
        )}
        {editingDeal && (
          <EditDealModal deal={editingDeal} pipelines={pipelines} onClose={() => setEditingDeal(null)} onSave={() => setEditingDeal(null)} />
        )}
        {invoiceDeal && (
          <InvoiceModal isOpen={true} onClose={() => setInvoiceDeal(null)} dealId={invoiceDeal.id} amount={invoiceDeal.amount} />
        )}
      </AnimatePresence>
    </div>
  );
}
