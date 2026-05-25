import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Mail, Phone, Clock, Send, Edit2, Trash2, Users,
  CheckCircle2, ArrowRight, MoreVertical, Copy, X, Eye,
  AlertCircle, RefreshCw, Zap, ArrowUpRight, Play, Pause
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

const STEP_TYPE_ICONS: Record<string, any> = {
  email: Mail,
  sms: Phone,
  wait: Clock,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:     { label: 'Active',    color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  paused:     { label: 'Paused',    color: 'text-amber-400',   bg: 'bg-amber-400/10' },
  draft:      { label: 'Draft',     color: 'text-text-muted',  bg: 'bg-surface-hover' },
};

function parseJSON(s: any) { try { return JSON.parse(s); } catch { return {}; } }

function ConfirmDeleteModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-surface border border-border rounded-[14px] shadow-2xl w-[400px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-[8px] bg-red-400/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-text-main">Delete Sequence</h3>
            <p className="text-[12px] text-text-muted">This cannot be undone</p>
          </div>
        </div>
        <p className="text-[13px] text-text-muted mb-6">Delete <strong className="text-text-main">"{name}"</strong>?</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-[7px] border border-border text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-[7px] bg-red-500 text-white text-[13px] font-semibold hover:opacity-90 transition-opacity">Delete</button>
        </div>
      </div>
    </div>
  );
}

function SequenceStepEditor({ step, onChange }: { step: any; onChange: (s: any) => void }) {
  return (
    <div className="space-y-3">
      {/* Type selector */}
      <div className="flex gap-2">
        {(['email', 'sms', 'wait'] as const).map(t => {
          const Icon = STEP_TYPE_ICONS[t];
          return (
            <button key={t}
              onClick={() => onChange({ ...step, type: t })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border transition-colors ${step.type === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:border-primary/30'}`}>
              <Icon className="w-3.5 h-3.5" />
              {t === 'wait' ? 'Wait' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Delay */}
      <div>
        <label className="text-[11px] font-semibold text-text-muted block mb-1">Wait before sending (minutes, 0 = immediately)</label>
        <input type="number" min="0" value={step.delayMinutes || 0}
          onChange={e => onChange({ ...step, delayMinutes: parseInt(e.target.value) || 0 })}
          className="w-20 px-2 py-1 bg-surface-hover border border-border rounded-[5px] text-[12px] text-text-main focus:outline-none focus:border-primary" />
      </div>

      {/* Email/SMS content */}
      {step.type === 'email' && (
        <>
          <div>
            <label className="text-[11px] font-semibold text-text-muted block mb-1">Subject Line</label>
            <input type="text" value={step.subject || ''}
              onChange={e => onChange({ ...step, subject: e.target.value })}
              placeholder="e.g. Following up on my last email"
              className="w-full px-3 py-1.5 bg-surface-hover border border-border rounded-[5px] text-[12px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-text-muted block mb-1">Body</label>
            <p className="text-[11px] text-text-muted/50 mb-1">Use {'{{first_name}}'}, {'{{last_name}}'}, {'{{email}}'}, {'{{company_name}}'}</p>
            <textarea rows={3} value={step.body || ''}
              onChange={e => onChange({ ...step, body: e.target.value })}
              placeholder="Hey {{first_name}}, I wanted to follow up..."
              className="w-full px-3 py-1.5 bg-surface-hover border border-border rounded-[5px] text-[12px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted resize-none" />
          </div>
        </>
      )}

      {step.type === 'sms' && (
        <div>
          <label className="text-[11px] font-semibold text-text-muted block mb-1">Message</label>
          <textarea rows={2} value={step.body || ''}
            onChange={e => onChange({ ...step, body: e.target.value })}
            placeholder="Hi {{first_name}}! Just following up..."
            className="w-full px-3 py-1.5 bg-surface-hover border border-border rounded-[5px] text-[12px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted resize-none" />
        </div>
      )}

      {step.type === 'wait' && (
        <div className="p-2 bg-amber-400/5 border border-amber-400/20 rounded-[6px]">
          <p className="text-[11px] text-amber-400">⏳ Pauses the sequence for {step.delayMinutes} minutes before continuing to the next step.</p>
        </div>
      )}
    </div>
  );
}

export default function Sequences() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [editingSeq, setEditingSeq] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formSteps, setFormSteps] = useState<any[]>([{
    id: `step_${Date.now()}`,
    type: 'email',
    delayMinutes: 0,
    subject: 'Initial Outreach',
    body: '',
  }]);

  // Query params: view enrollments for a specific sequence
  const urlParams = new URLSearchParams(window.location.search);
  const viewingSeqId = urlParams.get('view');

  // Fetch sequences
  const { data: sequences = [], isLoading } = useQuery<any[]>({
    queryKey: ['sequences'],
    queryFn: () => fetch('/api/business/sequences').then(r => r.ok ? r.json() : []),
  });

  // Create
  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch('/api/business/sequences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }).then(r => { if (!r.ok) throw new Error('Failed to create sequence'); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sequences'] });
      setNewOpen(false);
      setFormName('');
      setFormSteps([]);
      toast('success', 'Sequence created!');
    },
    onError: (e: Error) => toast('error', e.message || 'Failed'),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/business/sequences/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences'] }); setDeleteTarget(null); toast('success', 'Sequence deleted'); },
    onError: () => toast('error', 'Failed to delete'),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetch(`/api/business/sequences/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }).then(r => { if (!r.ok) throw new Error('Failed to update'); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences'] }); setEditingSeq(null); toast('success', 'Sequence updated'); },
    onError: () => toast('error', 'Failed to update'),
  });

  // Status toggle
  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/business/sequences/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => { if (!r.ok) throw new Error('Failed to update'); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences'] }); toast('success', 'Sequence status updated'); },
    onError: () => toast('error', 'Failed to update status'),
  });

  // Enrollments for viewing a sequence
  const { data: enrollments = [] } = useQuery<any[]>({
    queryKey: ['sequence-enrollments', viewingSeqId],
    queryFn: () => fetch(`/api/business/sequences/${viewingSeqId}/enrollments`).then(r => r.ok ? r.json() : []),
    enabled: !!viewingSeqId,
  });

  // View enrollments detail
  if (viewingSeqId) {
    const seq = sequences.find(s => s.id === viewingSeqId);
    if (!seq && !enrollments.length) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-muted">Sequence not found</p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
        <div className="px-8 border-b border-border bg-surface flex items-center gap-4 shrink-0 h-[68px]">
          <button onClick={() => window.history.replaceState({}, '', window.location.pathname)} className="text-text-muted hover:text-text-main transition-colors">
            ← Sequences
          </button>
          <div className="border-l border-border h-6 mx-2" />
          <h1 className="text-[18px] font-bold text-text-main">{seq?.name}</h1>
        </div>
        <div className="flex-1 overflow-auto">
          {enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="w-10 h-10 text-text-muted/30 mb-3" />
              <p className="text-text-muted">No contacts enrolled yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 border-b border-border bg-surface/90 backdrop-blur-sm">
                <tr>
                  {['Contact', 'Email', 'Status', 'Current Step', 'Enrolled', 'Completed'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {enrollments.map(e => {
                  const progress = JSON.parse(e.sequenceData || '{}');
                  return (
                    <tr key={e.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="px-6 py-4 text-[13px] font-semibold text-text-main">
                        {e.contact?.firstName || ''} {e.contact?.lastName || ''}
                      </td>
                      <td className="px-6 py-4 text-[12px] text-text-muted">{e.contact?.email || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CONFIG[e.status]?.bg || ''} ${STATUS_CONFIG[e.status]?.color || 'text-text-muted'}`}>
                          {STATUS_CONFIG[e.status]?.label || e.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[12px] text-text-muted">Step {(progress.currentStepIndex || 0) + 1}</td>
                      <td className="px-6 py-4 text-[12px] text-text-muted">{new Date(e.enrolledAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-[12px] text-text-muted">{e.completedAt ? new Date(e.completedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Total stats
  const totalActive = sequences.filter(s => s.status === 'active').length;
  const totalSteps = sequences.reduce((sum, s) => sum + (parseJSON(s.stepsJson)?.length || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      <div className="px-8 border-b border-border bg-surface flex items-center justify-between shrink-0 h-[68px]">
        <div>
          <h1 className="text-[20px] font-bold text-text-main">Sequences</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Automated follow-up campaigns for contacts</p>
        </div>
        <button onClick={() => { setNewOpen(true); setEditingSeq(null); setFormName(''); setFormSteps([{ id: `step_${Date.now()}`, type: 'email', delayMinutes: 0, subject: '', body: '' }]); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20">
          <Plus className="w-4 h-4" /> New Sequence
        </button>
      </div>

      <div className="px-8 py-4 border-b border-border bg-surface-hover/20 grid grid-cols-3 gap-4 shrink-0">
        {[
          { label: 'Total', value: sequences.length, color: 'text-text-main' },
          { label: 'Active', value: totalActive, color: 'text-emerald-400' },
          { label: 'Total Steps', value: totalSteps, color: 'text-primary' },
        ].map((s, i) => (
          <div key={i} className="bg-surface border border-border rounded-[10px] px-4 py-3">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{s.label}</div>
            <div className={`text-[22px] font-bold mt-0.5 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-border bg-surface/90 backdrop-blur-sm z-10">
            <tr>
              {['Sequence', 'Status', 'Steps', 'Enrolled', 'Updated', ''].map(h => (
                <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-6 py-4">
                  <div className="h-4 bg-surface-hover rounded animate-pulse w-1/2" />
                </td></tr>
              ))
            ) : sequences.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-14 h-14 rounded-full bg-surface-hover border border-border flex items-center justify-center">
                    <Zap className="w-7 h-7 text-text-muted" />
                  </div>
                  <p className="text-[15px] font-bold text-text-main mb-1">No sequences yet</p>
                  <p className="text-[13px] text-text-muted">Create automated follow-up sequences to nurture your contacts.</p>
                  <button onClick={() => { setNewOpen(true); setFormName(''); setFormSteps([{ id: `step_1`, type: 'email', delayMinutes: 0, subject: '', body: '' }]); }}
                    className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" /> Create Sequence
                  </button>
                </div>
              </td></tr>
            ) : sequences.map(s => {
              const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.draft;
              const steps = parseJSON(s.stepsJson) || [];
              return (
                <tr key={s.id} className="hover:bg-surface-hover/30 transition-colors group cursor-pointer" onClick={() => window.location.search = `?view=${s.id}`}>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-semibold text-text-main">{s.name}</div>
                    <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                      {steps.slice(0, 3).map((st: any) => {
                        const Icon = STEP_TYPE_ICONS[st.type] || Zap;
                        return <Icon key={st.id} className="w-3 h-3" />;
                      })}
                      {steps.length > 3 && <span>+{steps.length - 3} more</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-text-muted">{steps.length} steps</td>
                  <td className="px-6 py-4 text-[12px] text-text-muted">—</td>
                  <td className="px-6 py-4 text-[12px] text-text-muted whitespace-nowrap">{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      {/* View enrollments */}
                      <button onClick={() => window.location.search = `?view=${s.id}`}
                        className="w-7 h-7 rounded-[5px] flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {/* Toggle active/pause */}
                      <button onClick={() => toggleStatus.mutate({ id: s.id, status: s.status === 'active' ? 'paused' : 'active' })}
                        className="w-7 h-7 rounded-[5px] flex items-center justify-center text-text-muted hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                        {s.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      {/* Edit */}
                      <button onClick={() => { setEditingSeq(s); setFormName(s.name); setFormSteps(parseJSON(s.stepsJson) || []); setNewOpen(true); }}
                        className="w-7 h-7 rounded-[5px] flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete */}
                      <button onClick={() => setDeleteTarget(s)}
                        className="w-7 h-7 rounded-[5px] flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {newOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setNewOpen(false); setEditingSeq(null); }} />
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }}
              className="relative z-10 bg-surface border border-border rounded-[16px] shadow-2xl w-[580px] max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-hover/20">
                <div>
                  <h2 className="text-[16px] font-bold text-text-main">{editingSeq ? 'Edit Sequence' : 'Create Sequence'}</h2>
                  <p className="text-[12px] text-text-muted mt-0.5">Define your follow-up steps</p>
                </div>
                <button onClick={() => { setNewOpen(false); setEditingSeq(null); }} className="w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Name */}
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Sequence Name <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="e.g. 7-Day Cold Outreach" value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted" />
                </div>

                {/* Steps */}
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Sequence Steps</label>
                  <div className="space-y-4">
                    {formSteps.map((step, idx) => (
                      <div key={step.id} className="relative">
                        {idx > 0 && (
                          <div className="flex items-center justify-center mb-2">
                            <ArrowDownIcon className="w-3.5 h-3.5 text-primary/50" />
                          </div>
                        )}
                        <div className="border border-border rounded-[8px] p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[12px] font-bold text-text-muted">Step {idx + 1}</span>
                            <button onClick={() => setFormSteps(s => s.filter((_, i) => i !== idx))}
                              className="w-5 h-5 flex items-center justify-center rounded-full text-text-muted/40 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <SequenceStepEditor
                            step={step}
                            onChange={s => setFormSteps(ss => ss.map((item, i) => i === idx ? s : item))}
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => setFormSteps(s => [...s, { id: `step_${Date.now()}`, type: 'email', delayMinutes: 0, subject: '', body: '' }])}
                      className="w-full py-2 border border-dashed border-border rounded-[8px] text-[12px] font-semibold text-text-muted hover:text-primary hover:border-primary/30 transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Step
                    </button>
                  </div>
                </div>

                {/* Preview */}
                {formSteps.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Preview Flow</label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {formSteps.map((step, idx) => (
                        <React.Fragment key={step.id}>
                          {idx > 0 && <ArrowRight className="w-3.5 h-3.5 text-text-muted/40" />}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            step.type === 'email' ? 'bg-blue-400/10 text-blue-400' :
                            step.type === 'sms' ? 'bg-emerald-400/10 text-emerald-400' :
                            'bg-amber-400/10 text-amber-400'
                          }`}>
                            {step.type === 'wait' ? `Wait ${step.delayMinutes}m` : step.type}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-hover/20 shrink-0">
                <button onClick={() => { setNewOpen(false); setEditingSeq(null); }} className="px-4 py-2 rounded-[7px] border border-border text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">Cancel</button>
                <button
                  onClick={() => {
                    if (!formName.trim() || formSteps.length === 0) {
                      toast('error', 'Name and at least one step are required');
                      return;
                    }
                    const data = { name: formName, steps: formSteps };
                    if (editingSeq) {
                      updateMutation.mutate({ id: editingSeq.id, data });
                    } else {
                      createMutation.mutate(data);
                    }
                  }}
                  disabled={!formName.trim() || formSteps.length === 0 || createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-[7px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {editingSeq ? (updateMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Edit2 className="w-3.5 h-3.5" />) : (createMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />)}
                  {editingSeq ? 'Update' : 'Create'} Sequence
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
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const ArrowDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
);
