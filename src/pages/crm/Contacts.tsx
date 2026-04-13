import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MondayGroup, MondayHeaderRow, MondayHeaderCell, MondayRow, MondayCell,
  StatusPill, MondayAddBlock, TagsCell, LeadScoreBar
} from '../../components/crm/MondayTable';
import ContactHealthScore from '../../components/crm/ContactHealthScore';
import DuplicateDetectionModal from '../../components/crm/DuplicateDetectionModal';
import {
  Building2, ChevronDown, Grid, MoreHorizontal, Plus, X, Upload,
  Search, Filter, SortAsc, List, LayoutGrid, Download, CheckSquare, Square,
  Users, Mail, Phone, Sparkles, Table2, LayoutDashboard, AlignJustify, Settings2, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  priority: 'High' | 'Medium' | 'Low' | '';
  status: string; // Acts as groupId
  leadScore: number;
  tags: { label: string; color?: string }[];
  lastActivity: string;
  title?: string;
  location?: string;
  linkedin?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  High: '#ff5ac4', Medium: '#ffcb00', Low: '#00c875', '': '#e0e0e0',
};

const INITIAL_CONTACTS: Contact[] = [];

// ── Table Configuration ─────────────────────────────────────────────
export type TableLayout = 'table' | 'card' | 'compact';

export interface TableConfig {
  layout: TableLayout;
  columns: string[];
}

// Email is always shown — not in the wizard selector
const WIZARD_COLUMNS = [
  { id: 'company',  label: 'Company',       icon: Building2 },
  { id: 'phone',    label: 'Phone',          icon: Phone },
  { id: 'tags',     label: 'Tags',           icon: AlignJustify },
  { id: 'health',   label: 'Health Score',   icon: Sparkles },
  { id: 'activity', label: 'Last Activity',  icon: SortAsc },
];

const ALL_COLUMNS = [
  { id: 'company',  label: 'Company',       icon: Building2 },
  { id: 'phone',    label: 'Phone',          icon: Phone },
  { id: 'tags',     label: 'Tags',           icon: AlignJustify },
  { id: 'health',   label: 'Health Score',   icon: Sparkles },
  { id: 'activity', label: 'Last Activity',  icon: SortAsc },
];

const DEFAULT_COLUMNS = ['company', 'phone', 'tags', 'health', 'activity'];
const CONFIG_KEY = 'crm_contacts_config';

// ── Setup Wizard ─────────────────────────────────────────────────────
function SetupWizard({ onDone }: { onDone: (cfg: TableConfig) => void }) {
  const [step, setStep] = useState(0);
  const [layout, setLayout] = useState<TableLayout>('table');
  const [cols, setCols] = useState<string[]>(DEFAULT_COLUMNS);

  const toggleCol = (id: string) =>
    setCols(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const layouts: { id: TableLayout; icon: React.FC<any>; label: string; desc: string }[] = [
    { id: 'table',   icon: Table2,       label: 'Smart Table',    desc: 'Row-based grid with inline editing' },
    { id: 'card',    icon: LayoutDashboard, label: 'Card Board',    desc: 'Visual profile cards, great for outreach' },
    { id: 'compact', icon: AlignJustify, label: 'Compact List',   desc: 'Dense list for high-volume contacts' },
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(16px)' }}>
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-[620px] mx-4 rounded-3xl border border-border shadow-luxury bg-surface/90 backdrop-blur-xl overflow-hidden">

        {/* Progress */}
        <div className="h-1 bg-surface-hover">
          <motion.div className="h-full bg-primary rounded-full" initial={{ width: '0%' }}
            animate={{ width: step === 0 ? '50%' : '100%' }} transition={{ duration: 0.4 }} />
        </div>

        <div className="p-10">
          {step === 0 ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-[20px] font-bold text-text-main">Set up your Contacts table</h1>
                  <p className="text-[13px] text-text-muted mt-0.5">Choose how you'd like to view your contacts.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {layouts.map(l => (
                  <button key={l.id} onClick={() => setLayout(l.id)}
                    className={`group p-5 rounded-2xl border-2 text-left transition-all ${
                      layout === l.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/40 hover:bg-surface-hover'
                    }`}>
                    <l.icon className={`w-7 h-7 mb-3 transition-colors ${layout === l.id ? 'text-primary' : 'text-text-muted group-hover:text-primary'}`} />
                    <p className={`font-bold text-[14px] mb-1 ${layout === l.id ? 'text-primary' : 'text-text-main'}`}>{l.label}</p>
                    <p className="text-[12px] text-text-muted leading-relaxed">{l.desc}</p>
                    {layout === l.id && (
                      <div className="mt-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center ml-auto">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex justify-end mt-8">
                <button onClick={() => setStep(1)}
                  className="btn-primary px-8 py-2.5 text-[14px]">
                  Choose Columns →
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-[20px] font-bold text-text-main">Pick your columns</h1>
                  <p className="text-[13px] text-text-muted mt-0.5">Select the data points you want to track. You can change these anytime.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {ALL_COLUMNS.map(col => {
                  const active = cols.includes(col.id);
                  return (
                    <button key={col.id} onClick={() => toggleCol(col.id)}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        active
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40 hover:bg-surface-hover'
                      }`}>
                      <col.icon className={`w-5 h-5 shrink-0 ${active ? 'text-primary' : 'text-text-muted'}`} />
                      <span className={`font-bold text-[13px] flex-1 ${active ? 'text-primary' : 'text-text-muted'}`}>{col.label}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        active ? 'bg-primary border-primary' : 'border-border'
                      }`}>
                        {active && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-8">
                <button onClick={() => setStep(0)} className="text-[13px] font-bold text-text-muted hover:text-text-main transition-colors px-3 py-2">← Back</button>
                <button onClick={() => onDone({ layout, columns: cols.length > 0 ? cols : DEFAULT_COLUMNS })}
                  disabled={cols.length === 0}
                  className="btn-primary px-8 py-2.5 text-[14px] disabled:opacity-50">
                  Build My CRM Table ✦
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function EditableCell({ value, onChange, width, placeholder = '' }: { value: string; onChange: (v: string) => void; width: string; placeholder?: string; }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const commit = () => { onChange(draft); setEditing(false); };
  return (
    <MondayCell width={width}>
      {editing ? (
        <input ref={ref} className="w-full bg-transparent outline-none text-[13px] text-text-main font-medium" value={draft}
          placeholder={placeholder} onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }} />
      ) : (
        <span className={`truncate cursor-text w-full block ${!value ? 'text-slate-300 italic text-[12px]' : ''}`}
          onDoubleClick={() => { setDraft(value); setEditing(true); }}>
          {value || placeholder}
        </span>
      )}
    </MondayCell>
  );
}

function PriorityCell({ value, onChange, width }: { value: string; onChange: (v: string) => void; width: string; }) {
  const [open, setOpen] = useState(false);
  const color = PRIORITY_COLORS[value] || '#e0e0e0';
  return (
    <MondayCell isStatusPill statusColor={color} width={width}>
      <div className="relative w-full h-full flex items-center justify-center cursor-pointer" onClick={() => setOpen(!open)}>
        <StatusPill color={color} label={value || '—'} />
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 z-[100] mt-1 bg-surface border border-border rounded-xl shadow-xl min-w-[140px] py-1.5"
              onClick={e => e.stopPropagation()}>
              {(['High', 'Medium', 'Low', ''] as const).map(opt => (
                <button key={opt || 'none'} className="w-full px-3 py-2 text-[12px] text-left hover:bg-surface-hover flex items-center gap-2.5 font-medium transition-colors"
                  onClick={() => { onChange(opt); setOpen(false); }}>
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PRIORITY_COLORS[opt] || '#e0e0e0' }} />
                  {opt || 'None'}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MondayCell>
  );
}

function NewContactSlideOver({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (c: Omit<Contact, 'id'>) => void; }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', location: '', priority: '' as Contact['priority'], status: 'Active' as Contact['status'] });
  const [saving, setSaving] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim()) return;
    setSaving(true);
    setTimeout(() => {
      onSave({ ...form, leadScore: 0, tags: [], lastActivity: 'Just now' });
      setForm({ firstName: '', lastName: '', email: '', phone: '', company: '', title: '', location: '', priority: '', status: 'Active' });
      setSaving(false); onClose();
    }, 400);
  };
  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{label}</label>
      <input type={type} value={form[key] as string} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-text-muted" />
    </div>
  );
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={onClose} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed inset-y-0 right-0 w-[480px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div>
                <h2 className="text-[16px] font-bold text-text-main">Create Contact</h2>
                <p className="text-[12px] text-text-muted mt-0.5">Add a new person to your CRM.</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-main hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">{field('First Name *', 'firstName', 'text', 'Jane')}</div>
                  <div className="flex-1">{field('Last Name', 'lastName', 'text', 'Doe')}</div>
                </div>
                {field('Job Title', 'title', 'text', 'VP Sales')}
                {field('Email Address', 'email', 'email', 'jane@company.com')}
                {field('Phone Number', 'phone', 'tel', '+1 (555) 000-0000')}
                {field('Company', 'company', 'text', 'Acme Corp')}
                {field('Location', 'location', 'text', 'New York, NY')}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Priority</label>
                  <div className="flex gap-2">
                    {(['High', 'Medium', 'Low'] as const).map(p => (
                      <button key={p} type="button" onClick={() => setForm(f => ({ ...f, priority: f.priority === p ? '' : p }))}
                        className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-all ${form.priority === p ? 'border-transparent text-white shadow-sm' : 'border-border text-text-muted bg-surface-hover hover:bg-slate-100'}`}
                        style={form.priority === p ? { background: PRIORITY_COLORS[p] } : {}}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Status</label>
                  <div className="flex gap-2">
                    {(['Active', 'Inactive'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                        className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-all ${form.status === s ? 'bg-slate-800 text-white border-slate-800' : 'border-border text-text-muted bg-surface-hover hover:bg-slate-100'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-border flex items-center justify-end gap-3 bg-surface-hover">
                <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:bg-slate-100 transition-colors">Cancel</button>
                <button type="submit" disabled={saving || !form.firstName.trim()}
                  className="px-6 py-2 rounded-xl text-[13px] font-semibold bg-primary text-white hover:bg-[#0060c2] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                  {saving ? 'Saving...' : 'Create Contact'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ImportModal({ isOpen, onClose, onImport }: { isOpen: boolean; onClose: () => void; onImport: (contacts: Omit<Contact, 'id'>[]) => void; }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<Omit<Contact, 'id'>[]>([]);
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return { firstName: obj['firstname'] || obj['first name'] || obj['first'] || '', lastName: obj['lastname'] || obj['last name'] || '', email: obj['email'] || '', phone: obj['phone'] || '', company: obj['company'] || '', priority: '' as Contact['priority'], status: 'Active' as Contact['status'], leadScore: 0, tags: [], lastActivity: 'Imported' };
    }).filter(r => r.firstName || r.email);
  };
  const handleFile = (file: File) => {
    setError(''); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => { try { setParsed(parseCSV(e.target?.result as string)); } catch { setError('Could not parse CSV.'); } };
    reader.readAsText(file);
  };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-[500px]">
              <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                <div><h2 className="text-[16px] font-bold text-text-main">Import Contacts</h2><p className="text-[12px] text-text-muted mt-0.5">Upload a CSV file.</p></div>
                <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-primary bg-[#e5f0ff]' : 'border-border hover:border-primary/50 hover:bg-surface-hover'}`}>
                  <Upload className="w-8 h-8 text-text-muted" />
                  <p className="text-[13px] font-medium text-text-main">{fileName ? `✓ ${fileName} — ${parsed.length} contacts found` : 'Drag & drop CSV or click to browse'}</p>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                </div>
                {error && <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                {parsed.length > 0 && (
                  <div className="bg-surface-hover rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-2 border-b border-border"><span className="text-[12px] font-semibold text-text-main">{parsed.length} contacts ready</span></div>
                    <div className="max-h-[120px] overflow-y-auto divide-y divide-slate-100">
                      {parsed.slice(0, 5).map((c, i) => (<div key={i} className="px-4 py-2 text-[12px] text-text-main flex gap-4"><span className="font-medium">{c.firstName} {c.lastName}</span><span className="text-text-muted">{c.email}</span></div>))}
                      {parsed.length > 5 && <div className="px-4 py-2 text-[11px] text-text-muted">+{parsed.length - 5} more...</div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 pb-5 flex justify-end gap-3">
                <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:bg-slate-100">Cancel</button>
                <button disabled={parsed.length === 0} onClick={() => { onImport(parsed); onClose(); }}
                  className="px-6 py-2 rounded-xl text-[13px] font-semibold bg-primary text-white hover:bg-[#0060c2] disabled:opacity-40 flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" /> Import {parsed.length > 0 ? `${parsed.length} Contacts` : ''}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ContactCard({ c, onDelete }: { c: Contact; onDelete: () => void; key?: React.Key }) {
  const clr = PRIORITY_COLORS[c.priority] || 'var(--border)';
  const initials = `${c.firstName[0] || ''}${c.lastName[0] || ''}`.toUpperCase();
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="glass-card-hover p-5 group relative">
      <button onClick={onDelete} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red/10 text-text-muted hover:text-accent-red">
        <X className="w-4 h-4" />
      </button>
      <Link to={`/business/crm/contacts/${c.id}`} className="block">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[15px] text-white shadow-sm"
            style={{ background: clr === '#e0e0e0' ? '#94a3b8' : clr }}>
            {initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[14px] text-text-main group-hover:text-primary transition-colors truncate">{c.firstName} {c.lastName}</p>
            <p className="text-[12px] text-text-muted truncate">{c.title || c.company || 'No company'}</p>
          </div>
          <ContactHealthScore score={c.leadScore} size="sm" />
        </div>
        <div className="space-y-2 mb-4">
          {c.email && <div className="flex items-center gap-2 text-[12px] text-text-muted"><Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{c.email}</span></div>}
          {c.phone && <div className="flex items-center gap-2 text-[12px] text-text-muted"><Phone className="w-3.5 h-3.5 shrink-0" /><span>{c.phone}</span></div>}
          {c.company && <div className="flex items-center gap-2 text-[12px] text-primary"><Building2 className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{c.company}</span></div>}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex gap-1.5 flex-wrap">
            {c.tags.slice(0, 2).map(t => (
              <span key={t.label} className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white shadow-sm" style={{ background: t.color || 'var(--text-muted)' }}>{t.label}</span>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-text-muted bg-surface/50 px-2 py-0.5 rounded-md">{c.lastActivity}</span>
        </div>
      </Link>
    </motion.div>
  );
}

type ViewMode = 'table' | 'card' | 'compact';


const GROUP_COLORS = ['var(--primary)', 'var(--accent-green)', 'var(--accent-amber)', 'var(--accent-purple)', 'var(--accent-red)', 'var(--accent-teal)'];

function NewGroupForm({ onClose, onSave, initialName, initialColor }: { onClose: () => void; onSave: (name: string, color: string) => void; initialName?: string; initialColor?: string; }) {
  const [name, setName] = useState(initialName || '');
  const [color, setColor] = useState(initialColor || GROUP_COLORS[0]);
  return (
    <div>
      <div className="flex items-center justify-between px-6 py-5 border-b border-border">
        <div>
          <h2 className="text-[16px] font-bold text-text-main">{initialName ? 'Edit Group' : 'Create Group'}</h2>
          <p className="text-[12px] text-text-muted mt-0.5">{initialName ? 'Update group name or color.' : 'Organize contacts into a custom group.'}</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-hover transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Group Name *</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Enterprise Leads"
            className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-text-muted/50" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Color</label>
          <div className="flex gap-2.5">
            {GROUP_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
      <div className="px-6 pb-5 flex items-center justify-end gap-3">
        <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:bg-surface-hover transition-colors">Cancel</button>
        <button disabled={!name.trim()} onClick={() => onSave(name.trim(), color)}
          className="px-6 py-2 rounded-xl text-[13px] font-semibold bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition-colors">
          {initialName ? 'Save Changes' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem('crm_contacts');
    return saved ? JSON.parse(saved) : INITIAL_CONTACTS;
  });
  const [tableConfig, setTableConfig] = useState<TableConfig | null>(() => {
    const saved = localStorage.getItem(CONFIG_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem(CONFIG_KEY) ? JSON.parse(localStorage.getItem(CONFIG_KEY)!).layout : null) || 'table'
  );
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [inactiveCollapsed, setInactiveCollapsed] = useState(false);
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'priority' | 'score' | ''>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dupModal, setDupModal] = useState<{ contact: Contact; dupes: Contact[] } | null>(null);

  // Custom groups
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string; color: string; collapsed: boolean }[]>(() => {
    const saved = localStorage.getItem('crm_custom_groups');
    return saved ? JSON.parse(saved) : [
      { id: 'Active', name: 'Active Contacts', color: 'var(--accent-green)', collapsed: false },
      { id: 'Inactive', name: 'Inactive Contacts', color: 'var(--accent-red)', collapsed: false }
    ];
  });
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string; color: string } | null>(null);

  const saveGroups = (newGroups: any[]) => {
    setGroups(newGroups);
    localStorage.setItem('crm_custom_groups', JSON.stringify(newGroups));
  };

  const persist = (updated: Contact[]) => {
    setContacts(updated);
    localStorage.setItem('crm_contacts', JSON.stringify(updated));
  };

  const saveConfig = (cfg: TableConfig) => {
    setTableConfig(cfg);
    setViewMode(cfg.layout);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  };

  const setView = (v: ViewMode) => {
    setViewMode(v);
    if (tableConfig) {
      const updated = { ...tableConfig, layout: v };
      setTableConfig(updated);
      localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    }
  };

  const updateColumns = (cols: string[]) => {
    if (tableConfig) {
      const updated = { ...tableConfig, columns: cols };
      setTableConfig(updated);
      localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    }
  };

  const filtered = contacts
    .filter(c => {
      const q = searchQuery.toLowerCase();
      if (q && !`${c.firstName} ${c.lastName} ${c.email} ${c.company}`.toLowerCase().includes(q)) return false;
      if (filterPriority && !c.tags.some(t => t.label === filterPriority)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sortBy === 'priority') { const order = { High: 0, Medium: 1, Low: 2, '': 3 }; return (order[a.priority] ?? 3) - (order[b.priority] ?? 3); }
      if (sortBy === 'score') return b.leadScore - a.leadScore;
      return 0;
    }) as Contact[];

  // activeContacts / inactiveContacts variables removed -> fully dynamic now

  const updateContact = useCallback((id: string, field: keyof Contact, value: string) => {
    setContacts(prev => { const updated = prev.map(c => c.id === id ? { ...c, [field]: value } : c); localStorage.setItem('crm_contacts', JSON.stringify(updated)); return updated; });
  }, []);

  const addContact = (groupId: string) => {
    persist([...contacts, { id: `c-${Date.now()}`, firstName: '', lastName: '', company: '', email: '', phone: '', priority: '', status: groupId, leadScore: 0, tags: [], lastActivity: 'Just now' }]);
  };

  const saveNewContact = (data: Omit<Contact, 'id'>) => {
    const newContact = { ...data, id: `c-${Date.now()}` };
    const dupes = contacts.filter(c => c.email && c.email === data.email || `${c.firstName} ${c.lastName}`.trim() === `${data.firstName} ${data.lastName}`.trim());
    persist([...contacts, newContact]);
    if (dupes.length > 0) setTimeout(() => setDupModal({ contact: newContact, dupes }), 300);
  };

  const importContacts = (rows: Omit<Contact, 'id'>[]) => {
    persist([...contacts, ...rows.map(r => ({ ...r, id: `c-${Date.now()}-${Math.random()}` }))]);
  };

  const deleteContact = (id: string) => persist(contacts.filter(c => c.id !== id));

  const mergeContacts = (keepId: string, removeId: string, merged: Partial<Contact>) => {
    setContacts(prev => {
      const updated = prev.map(c => c.id === keepId ? { ...c, ...merged } : c).filter(c => c.id !== removeId);
      localStorage.setItem('crm_contacts', JSON.stringify(updated));
      return updated;
    });
    setDupModal(null);
  };

  const exportCSV = () => {
    const rows = [['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Priority', 'Status', 'Lead Score'], ...contacts.map(c => [c.firstName, c.lastName, c.email, c.phone, c.company, c.priority, c.status, c.leadScore.toString()])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'contacts.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAll = () => setSelected(new Set(filtered.map(c => c.id)));
  const clearSelect = () => setSelected(new Set());
  const deleteSelected = () => { persist(contacts.filter(c => !selected.has(c.id))); clearSelect(); };

  useEffect(() => {
    const onImport = () => setImportOpen(true);
    const onNew = () => setSlideOverOpen(true);
    window.addEventListener('crm:import', onImport);
    window.addEventListener('crm:new-contact', onNew);
    return () => { window.removeEventListener('crm:import', onImport); window.removeEventListener('crm:new-contact', onNew); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'n' || e.key === 'N') setSlideOverOpen(true);
      if (e.key === '/') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setFilterOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeCols = tableConfig?.columns ?? DEFAULT_COLUMNS;

  const cols = (
    <MondayHeaderRow>
      <MondayHeaderCell width="w-[32px]"> </MondayHeaderCell>
      <MondayHeaderCell width="flex-1 min-w-[200px]">Contact</MondayHeaderCell>
      {activeCols.includes('company')  && <MondayHeaderCell width="w-[160px]">Company</MondayHeaderCell>}
      {/* Email always shown */}
      <MondayHeaderCell width="w-[200px]">Email</MondayHeaderCell>
      {activeCols.includes('phone')    && <MondayHeaderCell width="w-[130px]">Phone</MondayHeaderCell>}
      {activeCols.includes('tags')     && <MondayHeaderCell width="w-[200px]">Tags</MondayHeaderCell>}
      {activeCols.includes('health')   && <MondayHeaderCell width="w-[80px]">Health</MondayHeaderCell>}
      {activeCols.includes('activity') && <MondayHeaderCell width="w-[110px]">Last Activity</MondayHeaderCell>}
      <MondayHeaderCell width="w-[50px]"> </MondayHeaderCell>
    </MondayHeaderRow>
  );

  const renderRow = (c: Contact, groupColor: string) => {
    const isSelected = selected.has(c.id);
    return (
      <MondayRow key={c.id} groupColorClass={groupColor}>
        <MondayCell width="w-[32px]">
          <button onClick={() => toggleSelect(c.id)} className="flex items-center justify-center w-5 h-5 text-text-muted hover:text-primary transition-colors">
            {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
          </button>
        </MondayCell>
        <MondayCell width="flex-1 min-w-[200px]">
          <Link to={`/business/crm/contacts/${c.id}`} className="font-bold text-[13px] text-text-main hover:text-primary truncate transition-colors">
            {c.firstName}{c.lastName ? ' ' + c.lastName : ''}{!c.firstName && <span className="text-text-muted italic">Unnamed</span>}
          </Link>
        </MondayCell>
        {activeCols.includes('company') && (
          <MondayCell width="w-[160px]">
            {c.company ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/[0.06] rounded-md text-primary/80 text-[11px] font-semibold max-w-full">
                <Building2 className="w-3 h-3 shrink-0" /><span className="truncate">{c.company}</span>
              </div>
            ) : <span className="text-text-muted/40 text-[12px]">—</span>}
          </MondayCell>
        )}
        {/* Email always shown */}
        <EditableCell width="w-[200px]" placeholder="email@example.com" value={c.email} onChange={v => updateContact(c.id, 'email', v)} />
        {activeCols.includes('phone')    && <EditableCell width="w-[130px]" placeholder="+1 555-0000" value={c.phone} onChange={v => updateContact(c.id, 'phone', v)} />}
        {activeCols.includes('tags')     && <MondayCell width="w-[200px]"><TagsCell tags={c.tags} /></MondayCell>}
        {activeCols.includes('health')   && (
          <MondayCell width="w-[80px]">
            <ContactHealthScore score={c.leadScore} size="sm"
              activityBreakdown={{ recency: Math.round(c.leadScore * 0.3), emailOpens: Math.round(c.leadScore * 0.25), calls: Math.round(c.leadScore * 0.25), meetings: Math.round(c.leadScore * 0.2) }} />
          </MondayCell>
        )}
        {activeCols.includes('activity') && <EditableCell width="w-[110px]" placeholder="—" value={c.lastActivity} onChange={v => updateContact(c.id, 'lastActivity', v)} />}
        <MondayCell width="w-[50px]">
          <button onClick={() => deleteContact(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg flex items-center justify-center text-text-muted hover:text-accent-red hover:bg-red/[0.06]">
            <X className="w-3.5 h-3.5" />
          </button>
        </MondayCell>
      </MondayRow>
    );
  };

  // ── Gate on config wizard ──────────────────────────────────────────
  if (!tableConfig) return <SetupWizard onDone={saveConfig} />;

  // ── Column Toggle Panel ────────────────────────────────────────────
  const ColumnPanel = (
    <AnimatePresence>
      {showConfigPanel && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="absolute top-full right-0 mt-2 z-50 bg-surface/90 backdrop-blur-xl border border-border rounded-2xl shadow-luxury p-4 w-[260px]">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Visible Columns</p>
          <p className="text-[11px] text-text-muted/60 mb-3">Email is always shown.</p>
          <div className="space-y-1">
            {ALL_COLUMNS.map(col => {
              const active = activeCols.includes(col.id);
              return (
                <button key={col.id} onClick={() => updateColumns(
                  active ? activeCols.filter(c => c !== col.id) : [...activeCols, col.id]
                )} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                  active ? 'bg-primary/[0.06] text-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                }`}>
                  <col.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{col.label}</span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'bg-primary border-primary' : 'border-border'}`}>
                    {active && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={() => { localStorage.removeItem(CONFIG_KEY); setTableConfig(null); setShowConfigPanel(false); }}
            className="mt-3 w-full text-[12px] font-semibold text-text-muted/70 hover:text-accent-red py-2 rounded-lg transition-colors text-left px-3">
            Reset & Re-configure
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="flex flex-col h-full w-full bg-bg relative styled-scrollbar">
      {/* Board Header */}
      <div className="flex flex-col pt-6 pb-2 px-8 bg-surface/90 backdrop-blur-xl shrink-0 border-b border-border sticky top-0 z-10 transition-all duration-300 shadow-sm">
        <div className="flex items-center gap-2 text-2xl font-bold text-text-main mb-4">
          Contacts <ChevronDown className="w-5 h-5 text-text-muted cursor-pointer hover:text-primary transition-colors" />
          <span className="ml-3 px-2 py-0.5 bg-surface rounded-full text-[12px] text-text-muted font-bold border border-border">{contacts.length} contacts</span>
        </div>
        <div className="flex items-center gap-6 text-[14px] font-semibold text-text-muted">
          <div className="flex items-center gap-2 pb-2.5 border-b-[3px] border-primary text-primary cursor-pointer">
            <Grid className="w-4 h-4" /> Main table <MoreHorizontal className="w-4 h-4 opacity-50" />
          </div>
          <div className="flex items-center pb-2.5 cursor-pointer hover:text-text-main transition-colors"><Plus className="w-4 h-4 mr-1" /> New View</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-5 px-8 py-4 bg-surface border-b border-border shrink-0 flex-wrap">
        <div className="flex shadow-luxury rounded-lg">
          <button onClick={() => setSlideOverOpen(true)} className="bg-primary hover:bg-primary-hover text-white text-[13px] font-bold px-5 py-2 rounded-l-lg transition-all">
            New contact
          </button>
          <button className="bg-primary hover:bg-primary-hover text-white px-2.5 py-2 rounded-r-lg border-l border-white/20 transition-all flex items-center justify-center">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[13px] text-text-muted font-bold flex-1 ml-2">
          {/* Search */}
          <div className="relative">
            <button onClick={() => setSearchOpen(o => !o)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent transition-all ${searchOpen || searchQuery ? 'bg-primary/10 text-primary border-primary/20' : 'hover:text-text-main hover:bg-surface-hover hover:border-border/50'}`}>
              <Search className="w-4 h-4" /> Search
              {searchQuery && <span className="text-[11px] text-white bg-primary px-1.5 py-0.5 rounded-md font-bold ml-1">{searchQuery.length}</span>}
            </button>
            <AnimatePresence>
              {searchOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute top-full left-0 mt-2 z-50 bg-surface border border-border rounded-xl shadow-luxury p-2 min-w-[240px]">
                  <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search contacts… (press /)" className="input-luxury w-full" />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="mt-2 text-[11px] font-bold text-text-muted hover:text-accent-red px-1 transition-colors">Clear all</button>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Filter by Tag */}
          <div className="relative">
            <button onClick={() => setFilterOpen(o => !o)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent transition-all ${filterOpen || filterPriority ? 'bg-primary/[0.06] text-primary border-primary/20' : 'hover:text-text-main hover:bg-surface-hover hover:border-border/50'}`}>
              <Filter className="w-4 h-4" /> Filter
              {filterPriority && <span className="text-[11px] text-white/90 px-2 py-0.5 rounded-md font-semibold ml-1" style={{ background: 'var(--primary)', opacity: 0.85 }}>{filterPriority}</span>}
            </button>
            <AnimatePresence>
              {filterOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute top-full left-0 mt-2 z-50 bg-surface/90 border border-border rounded-xl shadow-luxury p-2 min-w-[200px]">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 py-1 mb-1">Filter by Tag</p>
                  <button key="all" onClick={() => { setFilterPriority(''); setFilterOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${filterPriority === '' ? 'bg-primary/[0.06] text-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'}`}>
                    All contacts
                  </button>
                  {contacts.flatMap(c => c.tags).reduce((acc: string[], t) => acc.includes(t.label) ? acc : [...acc, t.label], []).map(tag => (
                    <button key={tag} onClick={() => { setFilterPriority(tag); setFilterOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${filterPriority === tag ? 'bg-primary/[0.06] text-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'}`}>
                      <div className="w-2 h-2 rounded-full bg-primary/50" />
                      {tag}
                    </button>
                  ))}
                  {contacts.flatMap(c => c.tags).length === 0 && <p className="px-3 py-2 text-[12px] text-text-muted/60">No tags yet</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sort */}
          <button onClick={() => setSortBy(s => s === '' ? 'name' : s === 'name' ? 'score' : '')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent transition-all ${sortBy ? 'bg-primary/[0.06] text-primary border-primary/20' : 'hover:text-text-main hover:bg-surface-hover hover:border-border/50'}`}>
            <SortAsc className="w-4 h-4" /> {sortBy === 'name' ? 'By Name' : sortBy === 'score' ? 'By Score' : 'Sort'}
          </button>

          {/* Export / Import */}
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent hover:text-text-main hover:bg-surface-hover hover:border-border/50 transition-all">
            <Download className="w-4 h-4 pl-0.5" /> Export
          </button>
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent hover:text-text-main hover:bg-surface-hover hover:border-border/50 transition-all">
            <Upload className="w-4 h-4 pl-0.5" /> Import
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-surface-hover p-1.5 rounded-xl border border-border shadow-inner">
          {([['table', Table2], ['card', LayoutDashboard], ['compact', AlignJustify]] as [ViewMode, any][]).map(([mode, Icon]) => (
            <button key={mode} onClick={() => setView(mode)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                viewMode === mode ? 'bg-surface text-primary shadow-[0_2px_8px_rgba(0,0,0,0.08)] scale-105' : 'text-text-muted hover:text-text-main hover:bg-surface/90'
              }`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Column/Config toggle */}
        <div className="relative">
          <button onClick={() => setShowConfigPanel(o => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent text-[13px] font-bold transition-all ${
              showConfigPanel ? 'bg-primary/10 text-primary border-primary/20' : 'text-text-muted hover:text-text-main hover:bg-surface-hover hover:border-border/50'
            }`}>
            <Settings2 className="w-4 h-4" /> Customize
          </button>
          {ColumnPanel}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-3 px-8 py-2 bg-primary/5 border-b border-primary/20 shrink-0">
            <span className="text-[13px] font-bold text-primary">{selected.size} selected</span>
            <button onClick={deleteSelected} className="text-[13px] font-bold text-accent-red hover:bg-red/10 px-3 py-1.5 rounded-lg transition-colors">Delete</button>
            <button onClick={exportCSV} className="text-[13px] font-bold text-primary px-3 py-1.5 hover:bg-primary/10 rounded-lg transition-colors">Export selected</button>
            <button onClick={clearSelect} className="ml-auto text-[12px] font-bold text-text-muted hover:text-text-main flex items-center gap-1"><X className="w-3.5 h-3.5" /> Clear</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-auto pb-24">
        {viewMode === 'card' ? (
          <div className="p-6">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <Users className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-medium text-[14px]">No contacts found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(c => <ContactCard key={c.id} c={c} onDelete={() => deleteContact(c.id)} />)}
              </div>
            )}
          </div>
        ) : viewMode === 'compact' ? (
          <div className="divide-y divide-border bg-surface rounded-xl border border-border shadow-sm mx-4 my-4">
            {filtered.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-6 py-3 hover:bg-surface-hover transition-colors group">
                <button onClick={() => toggleSelect(c.id)} className="text-text-muted hover:text-primary shrink-0">
                  {selected.has(c.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                </button>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[13px] text-white shrink-0 shadow-md"
                  style={{ background: PRIORITY_COLORS[c.priority] || 'var(--border)' }}>
                  {`${c.firstName[0] || ''}${c.lastName[0] || ''}`.toUpperCase()}
                </div>
                <Link to={`/business/crm/contacts/${c.id}`} className="flex-1 min-w-0 flex flex-col">
                  <span className="font-bold text-[14px] text-text-main group-hover:text-primary transition-colors">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="text-[12px] text-text-muted">{c.company || 'No company'}</span>
                </Link>
                <span className="text-[13px] font-semibold text-text-muted w-[200px] truncate hidden md:block px-4">{c.email}</span>
                <ContactHealthScore score={c.leadScore} size="sm" />
                <span className="text-[12px] font-semibold text-text-muted w-[120px] text-right shrink-0 bg-bg px-2 py-1 rounded-md ml-4">{c.lastActivity}</span>
                <button onClick={() => deleteContact(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-accent-red shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red/10 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-32 px-12">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 shadow-inner">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-[22px] font-bold text-text-main mb-2">Your contacts list is empty</h2>
            <p className="text-[14px] text-text-muted text-center max-w-sm mb-8">Get started by adding your first contact manually or importing from a CSV file.</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setSlideOverOpen(true)} className="btn-primary px-6 py-2.5 text-[14px] flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add First Contact
              </button>
              <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl border-2 border-border text-[14px] font-bold text-text-muted hover:text-text-main hover:border-primary/30 hover:bg-primary/5 transition-all">
                <Upload className="w-4 h-4" /> Import CSV
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Dynamic Groups */}
            {groups.map((grp) => {
              const groupContacts = filtered.filter(c => c.status === grp.id);
              if (grp.id === 'Inactive' && groupContacts.length === 0 && contacts.filter(c => c.status === 'Inactive').length === 0) return null; // Auto-hide empty default inactive

              return (
                <React.Fragment key={grp.id}>
                  <MondayGroup
                    title={`${grp.name} (${groupContacts.length})`}
                    color={grp.color}
                    isCollapsed={grp.collapsed}
                    onToggle={() => saveGroups(groups.map(g => g.id === grp.id ? { ...g, collapsed: !g.collapsed } : g))}
                    onEdit={() => { setEditingGroup(grp); setNewGroupOpen(true); }}
                    onDelete={() => {
                      if (window.confirm(`Delete group "${grp.name}"? Contacts will be kept as ungrouped.`)) {
                        saveGroups(groups.filter(g => g.id !== grp.id));
                        persist(contacts.map(c => c.status === grp.id ? { ...c, status: 'Ungrouped' } : c));
                      }
                    }}
                  >
                    {cols}
                    {groupContacts.map(c => renderRow(c, grp.color))}
                    <div className="flex border-b border-border bg-bg hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => addContact(grp.id)}>
                      <div className="border-r border-border flex items-center justify-center p-2.5 w-[44px] shrink-0 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-r-sm" style={{ background: grp.color }} />
                      </div>
                      <div className="flex items-center p-2.5 text-[13px] text-text-muted gap-2 hover:text-text-main font-semibold">
                        <Plus className="w-4 h-4" /> Add contact
                      </div>
                    </div>
                  </MondayGroup>
                  <div className="h-5" />
                </React.Fragment>
              );
            })}

            <div className="mt-8 px-8">
              <button onClick={() => setNewGroupOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-text-muted hover:text-text-main hover:border-primary/40 hover:bg-primary/[0.03] transition-all text-[13px] font-semibold">
                <Plus className="w-4 h-4" /> Add New Group
              </button>
            </div>
          </>
        )}
      </div>

      <NewContactSlideOver isOpen={slideOverOpen} onClose={() => setSlideOverOpen(false)} onSave={saveNewContact} />
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImport={importContacts} />
      {dupModal && (
        <DuplicateDetectionModal isOpen={true} onClose={() => setDupModal(null)}
          contact={dupModal.contact} duplicates={dupModal.dupes} onMerge={mergeContacts} />
      )}

      {/* New Group Modal */}
      <AnimatePresence>
        {newGroupOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-40" onClick={() => setNewGroupOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-6 pointer-events-none">
              <div className="bg-surface/90 backdrop-blur-xl rounded-2xl border border-border shadow-luxury w-full max-w-[420px] pointer-events-auto">
                <NewGroupForm 
                  initialName={editingGroup?.name} initialColor={editingGroup?.color}
                  onClose={() => { setNewGroupOpen(false); setEditingGroup(null); }}
                  onSave={(name, color) => {
                    if (editingGroup) {
                      saveGroups(groups.map(g => g.id === editingGroup.id ? { ...g, name, color } : g));
                    } else {
                      saveGroups([...groups, { id: `g-${Date.now()}`, name, color, collapsed: false }]);
                    }
                    setNewGroupOpen(false);
                    setEditingGroup(null);
                  }} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
