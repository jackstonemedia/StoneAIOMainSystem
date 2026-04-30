import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, FileText, Trash2, Eye, Copy, ExternalLink, X, GripVertical,
  Type, AlignLeft, Mail, Phone, ChevronDown, ToggleLeft, Calendar,
  RefreshCw, AlertCircle, CheckCircle2, Search, ArrowLeft, Save, Layers
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

type FieldType = 'text' | 'textarea' | 'email' | 'phone' | 'select' | 'checkbox' | 'date';

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

const FIELD_TYPES: { type: FieldType; label: string; icon: any; desc: string }[] = [
  { type: 'text',     label: 'Short Text',   icon: Type,        desc: 'Single-line text input' },
  { type: 'textarea', label: 'Long Text',    icon: AlignLeft,   desc: 'Multi-line text area' },
  { type: 'email',    label: 'Email',        icon: Mail,        desc: 'Email address field' },
  { type: 'phone',    label: 'Phone',        icon: Phone,       desc: 'Phone number field' },
  { type: 'select',   label: 'Dropdown',     icon: ChevronDown, desc: 'Select from options' },
  { type: 'checkbox', label: 'Checkbox',     icon: ToggleLeft,  desc: 'Boolean yes/no field' },
  { type: 'date',     label: 'Date',         icon: Calendar,    desc: 'Date picker field' },
];

function makeId() { return `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function FieldPreview({ field }: { field: FormField }) {
  switch (field.type) {
    case 'textarea':
      return <textarea rows={2} placeholder={field.placeholder || field.label} readOnly className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-muted resize-none" />;
    case 'select':
      return <select className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-muted">
        <option>Choose an option...</option>
        {(field.options || []).map((o, i) => <option key={i}>{o}</option>)}
      </select>;
    case 'checkbox':
      return <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4" /><span className="text-[13px] text-text-muted">{field.label}</span></label>;
    case 'date':
      return <input type="date" className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-muted" />;
    default:
      return <input type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'} placeholder={field.placeholder || field.label} readOnly className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-muted" />;
  }
}

function ConfirmDelete({ name, onConfirm, onClose, loading }: { name: string; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.15 }}
        className="relative z-10 bg-surface border border-border rounded-[14px] shadow-2xl w-[400px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-[8px] bg-red-400/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-text-main">Delete Form</h3>
            <p className="text-[12px] text-text-muted">All submissions will also be removed</p>
          </div>
        </div>
        <p className="text-[13px] text-text-muted mb-6">Delete <strong className="text-text-main">"{name}"</strong>? This action cannot be undone.</p>
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

export default function Forms() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [editingForm, setEditingForm] = useState<any>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [submissionsForm, setSubmissionsForm] = useState<any>(null);

  const { data: forms = [], isLoading } = useQuery<any[]>({
    queryKey: ['forms'],
    queryFn: () => fetch('/api/business/forms').then(r => r.ok ? r.json() : []),
  });

  const { data: submissions = [] } = useQuery<any[]>({
    queryKey: ['form-submissions', submissionsForm?.id],
    queryFn: () => fetch(`/api/business/forms/${submissionsForm.id}/submissions`).then(r => r.ok ? r.json() : []),
    enabled: !!submissionsForm,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch('/api/business/forms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: (form) => { qc.invalidateQueries({ queryKey: ['forms'] }); setEditingForm(form); toast('success', 'Form created!'); },
    onError: () => toast('error', 'Failed to create form'),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => fetch(`/api/business/forms/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }); toast('success', 'Form saved!'); },
    onError: () => toast('error', 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/business/forms/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }); setDeleteTarget(null); toast('success', 'Form deleted'); },
    onError: () => toast('error', 'Failed to delete'),
  });

  const openBuilder = (form?: any) => {
    if (form) {
      setEditingForm(form);
      setFormName(form.name || '');
      setFormDesc(form.description || '');
      const schema = (() => { try { return JSON.parse(form.schema || '[]'); } catch { return []; } })();
      setFields(schema);
    } else {
      setEditingForm(null);
      setFormName('');
      setFormDesc('');
      setFields([]);
    }
    setView('builder');
  };

  const addField = (type: FieldType) => {
    const def = FIELD_TYPES.find(f => f.type === type)!;
    const newField: FormField = { id: makeId(), type, label: def.label, placeholder: '', required: false, options: type === 'select' ? ['Option 1', 'Option 2'] : undefined };
    setFields(f => [...f, newField]);
    setSelectedField(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(f => f.map(field => field.id === id ? { ...field, ...updates } : field));
  };

  const removeField = (id: string) => {
    setFields(f => f.filter(field => field.id !== id));
    if (selectedField === id) setSelectedField(null);
  };

  const moveField = (id: string, dir: 'up' | 'down') => {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const saveForm = () => {
    if (!formName.trim()) { toast('warning', 'Please enter a form name'); return; }
    if (editingForm?.id) {
      saveMutation.mutate({ id: editingForm.id, name: formName, description: formDesc, schema: JSON.stringify(fields) });
    } else {
      createMutation.mutate({ name: formName, description: formDesc, schema: JSON.stringify(fields) });
    }
  };

  const selected = fields.find(f => f.id === selectedField);

  if (view === 'builder') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
        {/* Builder Header */}
        <div className="px-6 py-4 border-b border-border bg-surface flex items-center gap-4 shrink-0">
          <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-main transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex-1 flex items-center gap-3">
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Form name..."
              className="text-[16px] font-bold bg-transparent border-none text-text-main focus:outline-none placeholder:text-text-muted/40 flex-1" />
          </div>
          <div className="flex items-center gap-2">
            {editingForm?.id && (
              <button onClick={() => { const url = `${window.location.origin}/form/${editingForm.id}`; navigator.clipboard?.writeText(url); toast('success', 'Form URL copied!'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-[6px] text-[12px] font-semibold text-text-muted hover:text-primary hover:border-primary/40 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Copy URL
              </button>
            )}
            <button onClick={saveForm} disabled={saveMutation.isPending || createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-[7px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {(saveMutation.isPending || createMutation.isPending) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Form
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left — Field types */}
          <div className="w-[220px] shrink-0 border-r border-border bg-surface/50 overflow-y-auto p-4">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Add Field</div>
            <div className="space-y-1">
              {FIELD_TYPES.map(ft => {
                const Icon = ft.icon;
                return (
                  <button key={ft.type} onClick={() => addField(ft.type)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[7px] text-[13px] text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors group">
                    <div className="w-6 h-6 rounded-[5px] bg-surface-hover flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Icon className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{ft.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center — Canvas */}
          <div className="flex-1 overflow-y-auto bg-surface-hover/20 p-8">
            <div className="max-w-[600px] mx-auto space-y-4">
              {/* Form header */}
              <div className="bg-surface border border-border rounded-[12px] p-6 mb-6">
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Form title"
                  className="text-[20px] font-bold bg-transparent border-none text-text-main focus:outline-none w-full placeholder:text-text-muted/40 mb-2" />
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Form description (optional)"
                  className="text-[13px] bg-transparent border-none text-text-muted focus:outline-none w-full placeholder:text-text-muted/40" />
              </div>

              {fields.length === 0 ? (
                <div className="bg-surface border border-dashed border-border rounded-[12px] p-12 text-center">
                  <Layers className="w-10 h-10 text-border mx-auto mb-3" />
                  <p className="text-[14px] font-semibold text-text-main mb-1">No fields yet</p>
                  <p className="text-[12px] text-text-muted">Click a field type on the left to add it to your form.</p>
                </div>
              ) : (
                fields.map((field, idx) => (
                  <motion.div key={field.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedField(field.id)}
                    className={`bg-surface border rounded-[10px] p-5 cursor-pointer transition-all ${selectedField === field.id ? 'border-primary shadow-[0_0_0_2px_rgba(82,103,125,0.12)]' : 'border-border hover:border-primary/40'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[13px] font-semibold text-text-main">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      <div className="flex items-center gap-1">
                        <button onClick={e => { e.stopPropagation(); moveField(field.id, 'up'); }} disabled={idx === 0}
                          className="w-6 h-6 rounded text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-30 text-xs font-bold">↑</button>
                        <button onClick={e => { e.stopPropagation(); moveField(field.id, 'down'); }} disabled={idx === fields.length - 1}
                          className="w-6 h-6 rounded text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-30 text-xs font-bold">↓</button>
                        <button onClick={e => { e.stopPropagation(); removeField(field.id); }}
                          className="w-6 h-6 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                          <X className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </div>
                    </div>
                    <FieldPreview field={field} />
                  </motion.div>
                ))
              )}

              {fields.length > 0 && (
                <div className="pt-4">
                  <button className="w-full py-3 bg-primary text-white rounded-[8px] text-[14px] font-bold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20">
                    Submit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right — Field editor */}
          <div className="w-[260px] shrink-0 border-l border-border bg-surface/50 overflow-y-auto p-4">
            {selected ? (
              <>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4">Field Settings</div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Label</label>
                    <input value={selected.label} onChange={e => updateField(selected.id, { label: e.target.value })}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
                  </div>
                  {selected.type !== 'checkbox' && (
                    <div>
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Placeholder</label>
                      <input value={selected.placeholder || ''} onChange={e => updateField(selected.id, { placeholder: e.target.value })}
                        className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
                    </div>
                  )}
                  {selected.type === 'select' && (
                    <div>
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Options</label>
                      <textarea value={(selected.options || []).join('\n')}
                        onChange={e => updateField(selected.id, { options: e.target.value.split('\n').filter(Boolean) })}
                        rows={4} placeholder="One option per line"
                        className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary resize-none" />
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1">
                    <label className="text-[13px] font-semibold text-text-main">Required</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={selected.required}
                        onChange={e => updateField(selected.id, { required: e.target.checked })} className="sr-only peer" />
                      <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-surface after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                <Layers className="w-8 h-8 text-border" />
                <p className="text-[12px] text-text-muted text-center">Click a field on the canvas to edit its properties</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      {/* Header */}
      <div className="px-8 border-b border-border bg-surface flex items-center justify-between shrink-0 h-[68px]">
        <div>
          <h1 className="text-[20px] font-bold text-text-main">Forms</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Build forms and capture leads automatically</p>
        </div>
        <button onClick={() => openBuilder()}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-primary/20">
          <Plus className="w-4 h-4" /> New Form
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-[12px] p-5 h-[160px] animate-pulse">
                <div className="h-4 bg-surface-hover rounded w-1/2 mb-3" />
                <div className="h-3 bg-surface-hover rounded w-3/4 mb-5" />
                <div className="h-3 bg-surface-hover rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-hover border border-border flex items-center justify-center">
              <FileText className="w-8 h-8 text-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-[16px] font-bold text-text-main mb-1">No forms yet</p>
              <p className="text-[13px] text-text-muted">Create your first form to start capturing leads.</p>
            </div>
            <button onClick={() => openBuilder()}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> Create Form
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {forms.map((form: any) => {
              const schema = (() => { try { return JSON.parse(form.schema || '[]'); } catch { return []; } })();
              const subCount = form.submissions?.length ?? (form._count?.submissions ?? 0);
              return (
                <motion.div key={form.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-surface border border-border rounded-[12px] overflow-hidden hover:shadow-md hover:border-primary/20 transition-all group">
                  {/* Header strip */}
                  <div className="h-1.5 bg-gradient-to-r from-primary to-teal" />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-bold text-text-main truncate">{form.name}</h3>
                        <p className="text-[11px] text-text-muted mt-0.5 truncate">{form.description || `${schema.length} fields`}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => openBuilder(form)} className="w-7 h-7 flex items-center justify-center rounded-[5px] text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(form)} className="w-7 h-7 flex items-center justify-center rounded-[5px] text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
                      <div className="text-center">
                        <div className="text-[16px] font-bold text-text-main">{schema.length}</div>
                        <div className="text-[10px] text-text-muted">Fields</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[16px] font-bold text-text-main">{subCount}</div>
                        <div className="text-[10px] text-text-muted">Submissions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[16px] font-bold text-text-main">{form.visits || 0}</div>
                        <div className="text-[10px] text-text-muted">Views</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <button onClick={() => openBuilder(form)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-surface-hover rounded-[6px] text-[12px] font-semibold text-text-muted hover:text-primary hover:bg-primary/5 transition-colors border border-border">
                        <Eye className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => setSubmissionsForm(form)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-surface-hover rounded-[6px] text-[12px] font-semibold text-text-muted hover:text-primary hover:bg-primary/5 transition-colors border border-border">
                        <Layers className="w-3 h-3" /> Submissions
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submissions drawer */}
      <AnimatePresence>
        {submissionsForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSubmissionsForm(null)} />
            <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="relative z-10 h-full w-[480px] bg-surface border-l border-border shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                <div>
                  <h2 className="text-[15px] font-bold text-text-main">{submissionsForm.name}</h2>
                  <p className="text-[12px] text-text-muted mt-0.5">Form submissions</p>
                </div>
                <button onClick={() => setSubmissionsForm(null)} className="w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {submissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <Layers className="w-8 h-8 text-border" />
                    <p className="text-[13px] text-text-muted">No submissions yet</p>
                  </div>
                ) : submissions.map((sub: any, i: number) => (
                  <div key={sub.id || i} className="bg-surface-hover border border-border rounded-[10px] p-4">
                    <div className="text-[11px] text-text-muted mb-2">{new Date(sub.submittedAt).toLocaleString()}</div>
                    {Object.entries(sub.data || sub).filter(([k]) => !['id', 'formId'].includes(k)).map(([k, v]: any) => (
                      <div key={k} className="flex gap-2 py-1 border-b border-border/30 last:border-0">
                        <span className="text-[11px] font-semibold text-text-muted min-w-[80px] capitalize">{k.replace(/_/g, ' ')}:</span>
                        <span className="text-[12px] text-text-main">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDelete
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
