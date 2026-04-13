import React, { useState, useRef, useCallback } from 'react';
import {
  MondayGroup, MondayHeaderRow, MondayHeaderCell, MondayRow, MondayCell,
  StatusPill, MondayAddBlock
} from '../../components/crm/MondayTable';
import {
  Plus, X, Upload, Search, Filter, SortAsc, LayoutGrid, List, Grid,
  Download, CheckSquare, Square, ChevronDown, Users, TrendingUp, Star,
  RefreshCw, BarChart2 as Funnel
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  status: 'New Lead' | 'Contacted' | 'Qualified' | 'Disqualified';
  source: string;
  leadScore: number;
  assignedTo: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  'New Lead': '#ffcb00',
  'Contacted': '#ff7a59',
  'Qualified': '#00c875',
  'Disqualified': '#e2445c',
};

const SOURCES = ['Website Form', 'Cold Outreach', 'Referral', 'LinkedIn', 'Google Ads', 'Trade Show', 'Partner', 'Organic'];
const REPS = ['You', 'Sarah Kim', 'Mike Johnson', 'Unassigned'];

const INITIAL_LEADS: Lead[] = [
  { id: '1', name: 'Gordon Farrell', email: 'gordonf@wix.com', phone: '+1 555-9001', company: 'Wix', title: 'IT Director', status: 'Contacted', source: 'LinkedIn', leadScore: 72, assignedTo: 'You', createdAt: '2 days ago' },
  { id: '2', name: 'Donna Sege', email: 'donnas@microsoft.com', phone: '+1 555-9002', company: 'Microsoft', title: 'Sales Manager', status: 'New Lead', source: 'Website Form', leadScore: 45, assignedTo: 'Sarah Kim', createdAt: '1 week ago' },
  { id: '3', name: 'Tom Park', email: 'tom@startup.io', phone: '', company: 'StartupIO', title: 'CEO', status: 'New Lead', source: 'Referral', leadScore: 88, assignedTo: 'Unassigned', createdAt: 'Today' },
  { id: '4', name: 'Rachel Moore', email: 'rachel@agency.co', phone: '+1 555-9004', company: 'Agency Co', title: 'Marketing VP', status: 'Qualified', source: 'Google Ads', leadScore: 91, assignedTo: 'Mike Johnson', createdAt: '3 days ago' },
];

function LeadScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#00c875' : score >= 40 ? '#ffcb00' : '#e2445c';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.6 }} />
      </div>
      <span className="text-[11px] font-bold w-7 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

function BulkImportModal({ isOpen, onClose, onImport }: { isOpen: boolean; onClose: () => void; onImport: (leads: Omit<Lead, 'id'>[]) => void; }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'done'>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<Omit<Lead, 'id'>[]>([]);
  const [error, setError] = useState('');

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return {
        name: obj['name'] || obj['full name'] || `${obj['first name'] || ''} ${obj['last name'] || ''}`.trim(),
        email: obj['email'] || '', phone: obj['phone'] || '', company: obj['company'] || '',
        title: obj['title'] || obj['job title'] || '', status: 'New Lead' as Lead['status'],
        source: obj['source'] || 'Import', leadScore: parseInt(obj['score'] || '0') || 0,
        assignedTo: 'Unassigned', createdAt: 'Imported',
      };
    }).filter(r => r.name || r.email);
  };

  const handleFile = (file: File) => {
    setError(''); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => { try { const rows = parseCSV(e.target?.result as string); setParsed(rows); setStep('map'); } catch { setError('Could not parse file.'); } };
    reader.readAsText(file);
  };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };

  const reset = () => { setStep('upload'); setFileName(''); setParsed([]); setError(''); };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-[580px]">
              <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                <div>
                  <h2 className="text-[16px] font-bold text-text-main">Bulk Import Leads</h2>
                  <p className="text-[12px] text-text-muted mt-0.5">Upload CSV with columns: name, email, phone, company, title, source</p>
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6">
                {step === 'upload' && (
                  <>
                    <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-primary bg-[#e5f0ff]' : 'border-border hover:border-primary/50 hover:bg-surface-hover'}`}>
                      <Upload className="w-10 h-10 text-text-muted" />
                      <p className="text-[13px] font-medium text-text-main">{fileName || 'Drop CSV file here or click to browse'}</p>
                      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                    </div>
                    {error && <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
                  </>
                )}

                {step === 'map' && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[13px] font-semibold text-text-main">{parsed.length} leads ready to import from <span className="text-primary">{fileName}</span></p>
                      <button onClick={reset} className="text-[12px] text-text-muted hover:text-text-main flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Change file</button>
                    </div>
                    <div className="bg-surface-hover rounded-xl border border-border overflow-hidden mb-4 max-h-[200px] overflow-y-auto">
                      <div className="grid grid-cols-4 px-3 py-2 bg-surface-hover text-[11px] font-bold text-text-muted uppercase tracking-wider">
                        <span>Name</span><span>Email</span><span>Company</span><span>Source</span>
                      </div>
                      {parsed.slice(0, 8).map((l, i) => (
                        <div key={i} className="grid grid-cols-4 px-3 py-2 text-[12px] text-text-main border-t border-border">
                          <span className="font-medium truncate">{l.name}</span>
                          <span className="text-text-muted truncate">{l.email}</span>
                          <span className="text-text-muted truncate">{l.company}</span>
                          <span className="text-text-muted truncate">{l.source}</span>
                        </div>
                      ))}
                      {parsed.length > 8 && <div className="px-3 py-2 text-[11px] text-text-muted">+{parsed.length - 8} more rows...</div>}
                    </div>
                    <div className="bg-primary/10 border border-border rounded-xl px-4 py-3 text-[12px] text-primary font-medium">
                      Duplicate check: {parsed.filter(l => INITIAL_LEADS.some(ex => ex.email === l.email)).length} potential duplicates detected — they will be skipped.
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 pb-5 flex justify-end gap-3">
                <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:bg-surface-hover">Cancel</button>
                {step === 'map' && (
                  <button onClick={() => { onImport(parsed); onClose(); reset(); }}
                    className="px-6 py-2 rounded-xl text-[13px] font-semibold bg-primary text-white hover:bg-[#0060c2] shadow-sm flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" /> Import {parsed.length} Leads
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

type ViewMode = 'table' | 'card' | 'funnel';

function FunnelView({ leads }: { leads: Lead[] }) {
  const stages = ['New Lead', 'Contacted', 'Qualified', 'Disqualified'] as const;
  const total = leads.length || 1;
  return (
    <div className="flex flex-col items-center gap-3 py-8 max-w-[600px] mx-auto">
      {stages.map(s => {
        const count = leads.filter(l => l.status === s).length;
        const pct = (count / total) * 100;
        const color = STATUS_COLORS[s];
        return (
          <div key={s} className="w-full">
            <div className="flex justify-between text-[12px] text-text-main mb-1">
              <span className="font-semibold">{s}</span>
              <span className="font-bold">{count} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-10 bg-surface-hover rounded-xl overflow-hidden flex items-center">
              <motion.div className="h-full rounded-xl flex items-center justify-end px-3" style={{ background: color, width: `${Math.max(pct, 8)}%` }} initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 8)}%` }} transition={{ duration: 0.7, delay: 0.1 }}>
                <span className="text-white font-bold text-[12px]">{count}</span>
              </motion.div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('crm_leads');
    return saved ? JSON.parse(saved) : INITIAL_LEADS;
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('crm_leads_view') as ViewMode) || 'table');
  const [collapsed, setCollapsed] = useState(false);
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newLead, setNewLead] = useState<Partial<Lead> | null>(null);

  const persist = (updated: Lead[]) => {
    setLeads(updated);
    localStorage.setItem('crm_leads', JSON.stringify(updated));
  };

  const setView = (v: ViewMode) => { setViewMode(v); localStorage.setItem('crm_leads_view', v); };

  const filtered = leads
    .filter(l => {
      if (searchQuery && !`${l.name} ${l.email} ${l.company}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterStatus && l.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.leadScore - a.leadScore;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const moveLead = (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    setLeads(prev => prev.filter(l => l.id !== id));
    alert(`✓ "${lead.name}" moved to Contacts!`);
  };

  const deleteLead = (id: string) => persist(leads.filter(l => l.id !== id));
  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const importLeads = (rows: Omit<Lead, 'id'>[]) => {
    const deduped = rows.filter(r => !leads.some(l => l.email && l.email === r.email));
    persist([...leads, ...deduped.map(r => ({ ...r, id: `l-${Date.now()}-${Math.random()}` }))]);
  };

  const exportCSV = () => {
    const rows = [['Name', 'Email', 'Phone', 'Company', 'Title', 'Status', 'Source', 'Score', 'Assigned'], ...leads.map(l => [l.name, l.email, l.phone, l.company, l.title, l.status, l.source, l.leadScore.toString(), l.assignedTo])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click();
  };

  // Stats
  const avgScore = leads.length ? Math.round(leads.reduce((a, l) => a + l.leadScore, 0) / leads.length) : 0;
  const qualified = leads.filter(l => l.status === 'Qualified').length;

  return (
    <div className="flex flex-col h-full w-full bg-surface relative">
      {/* Header */}
      <div className="flex flex-col pt-5 pb-2 px-8 bg-surface shrink-0 border-b border-border/60">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-main">Leads</h1>
            <span className="text-[12px] text-text-muted font-normal">{leads.length} total</span>
          </div>
          <div className="flex items-center gap-3">
            {[
              { label: 'Avg Score', value: avgScore, color: avgScore >= 70 ? '#00c875' : '#ffcb00' },
              { label: 'Qualified', value: qualified, color: '#00c875' },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-2 px-3 py-1.5 bg-surface-hover border border-border rounded-xl">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: stat.color }} />
                <span className="text-[12px] text-text-muted">{stat.label}:</span>
                <span className="text-[13px] font-bold" style={{ color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-8 py-2.5 bg-surface border-b border-border shrink-0 flex-wrap">
        <button onClick={() => setSlideOverOpen(true)} className="bg-primary hover:bg-[#0060c2] text-white text-[13px] font-medium px-4 py-1.5 rounded-md transition-colors shadow-sm">
          + New lead
        </button>
        <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[13px] font-medium text-text-main hover:bg-surface-hover transition-colors">
          <Upload className="w-4 h-4" /> Import
        </button>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[13px] font-medium text-text-main hover:bg-surface-hover transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>

        <div className="relative flex items-center bg-surface-hover border border-border rounded-lg px-3 py-1.5 gap-2">
          <Search className="w-4 h-4 text-text-muted" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search leads..."
            className="bg-transparent text-[13px] text-text-main outline-none w-36 placeholder:text-text-muted" />
          {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-3.5 h-3.5 text-text-muted" /></button>}
        </div>

        <div className="relative">
          <button onClick={() => setFilterOpen(o => !o)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${filterStatus ? 'bg-[#e5f0ff] text-primary' : 'text-text-main hover:bg-surface-hover'}`}>
            <Filter className="w-4 h-4 opacity-70" /> {filterStatus || 'All Status'}
          </button>
          <AnimatePresence>
            {filterOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl py-1.5 min-w-[160px]">
                {['', 'New Lead', 'Contacted', 'Qualified', 'Disqualified'].map(s => (
                  <button key={s || 'all'} onClick={() => { setFilterStatus(s); setFilterOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[13px] font-medium flex items-center gap-2.5 transition-colors ${filterStatus === s ? 'bg-[#e5f0ff] text-primary' : 'text-text-main hover:bg-surface-hover'}`}>
                    {s && <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />}
                    {s || 'All Status'}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button onClick={() => setSortBy(s => s === '' ? 'score' : s === 'score' ? 'name' : '')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${sortBy ? 'bg-[#e5f0ff] text-primary' : 'text-text-main hover:bg-surface-hover'}`}>
          <SortAsc className="w-4 h-4 opacity-70" /> {sortBy === 'score' ? 'By Score' : sortBy === 'name' ? 'By Name' : 'Sort'}
        </button>

        <div className="ml-auto flex items-center gap-1 bg-surface-hover p-1 rounded-lg">
          {([['table', Grid], ['card', LayoutGrid], ['funnel', Funnel]] as [ViewMode, any][]).map(([mode, Icon]) => (
            <button key={mode} onClick={() => setView(mode)}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${viewMode === mode ? 'bg-surface text-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-3 px-8 py-2 bg-[#e5f0ff] border-b border-primary/20 shrink-0">
            <span className="text-[13px] font-semibold text-primary">{selected.size} selected</span>
            <button onClick={() => { persist(leads.filter(l => !selected.has(l.id))); setSelected(new Set()); }} className="text-[13px] font-semibold text-red-500 hover:text-red-700 px-3 py-1 hover:bg-red-50 rounded-lg">Delete</button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-[12px] text-text-muted hover:text-text-main flex items-center gap-1"><X className="w-3.5 h-3.5" /> Clear</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-auto pb-20">
        {viewMode === 'funnel' ? (
          <FunnelView leads={filtered} />
        ) : viewMode === 'card' ? (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(l => (
              <motion.div key={l.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-surface border border-border rounded-2xl p-5 hover:shadow-md transition-all group relative">
                <button onClick={() => deleteLead(l.id)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-[14px] mb-3" style={{ background: STATUS_COLORS[l.status] || '#94a3b8' }}>
                  {l.name[0]}
                </div>
                <p className="font-bold text-[14px] text-text-main">{l.name}</p>
                <p className="text-[12px] text-text-muted mb-2">{l.title || l.company}</p>
                <div className="mb-3"><LeadScoreBar score={l.leadScore} /></div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: STATUS_COLORS[l.status] }}>{l.status}</span>
                  <span className="text-[11px] text-text-muted">{l.source}</span>
                </div>
                <button onClick={() => moveLead(l.id)} className="mt-3 w-full py-1.5 bg-green-500 hover:bg-green-600 text-white text-[12px] font-semibold rounded-lg transition-colors">
                  Move to Contacts
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <MondayGroup title={`All Leads (${filtered.length})`} color="text-[#579bfc]"
            isCollapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}>
            <MondayHeaderRow>
              <MondayHeaderCell width="w-[32px]"> </MondayHeaderCell>
              <MondayHeaderCell width="w-[220px]">Lead</MondayHeaderCell>
              <MondayHeaderCell width="w-[150px]">Status</MondayHeaderCell>
              <MondayHeaderCell width="w-[120px]">Lead Score</MondayHeaderCell>
              <MondayHeaderCell width="w-[130px]">Source</MondayHeaderCell>
              <MondayHeaderCell width="w-[160px]">Company</MondayHeaderCell>
              <MondayHeaderCell width="w-[160px]">Email</MondayHeaderCell>
              <MondayHeaderCell width="w-[120px]">Assigned</MondayHeaderCell>
              <MondayHeaderCell width="w-[100px]">Created</MondayHeaderCell>
              <MondayHeaderCell width="w-[160px]">Actions</MondayHeaderCell>
            </MondayHeaderRow>

            {filtered.map(l => (
              <MondayRow key={l.id} groupColorClass="bg-[#579bfc]">
                <MondayCell width="w-[32px]">
                  <button onClick={() => toggleSelect(l.id)} className="flex items-center justify-center w-5 h-5 text-text-muted hover:text-primary">
                    {selected.has(l.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                </MondayCell>
                <MondayCell width="w-[220px]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0" style={{ background: STATUS_COLORS[l.status] || '#94a3b8' }}>{l.name[0]}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[13px] text-text-main truncate">{l.name}</p>
                      {l.title && <p className="text-[11px] text-text-muted truncate">{l.title}</p>}
                    </div>
                  </div>
                </MondayCell>
                <MondayCell width="w-[150px]" isStatusPill statusColor={STATUS_COLORS[l.status]}>
                  <StatusPill color={STATUS_COLORS[l.status]} label={l.status} />
                </MondayCell>
                <MondayCell width="w-[120px]"><LeadScoreBar score={l.leadScore} /></MondayCell>
                <MondayCell width="w-[130px]">
                  <span className="text-[12px] text-text-main font-medium">{l.source}</span>
                </MondayCell>
                <MondayCell width="w-[160px]">
                  <span className="text-[12px] text-text-main font-medium">{l.company || '—'}</span>
                </MondayCell>
                <MondayCell width="w-[160px]">
                  <span className="text-[12px] text-primary truncate">{l.email || '—'}</span>
                </MondayCell>
                <MondayCell width="w-[120px]">
                  <select value={l.assignedTo} onChange={e => persist(leads.map(lead => lead.id === l.id ? { ...lead, assignedTo: e.target.value } : lead))}
                    className="text-[11px] font-semibold border-0 bg-transparent text-text-main focus:outline-none cursor-pointer w-full">
                    {REPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </MondayCell>
                <MondayCell width="w-[100px]">
                  <span className="text-[11px] text-text-muted">{l.createdAt}</span>
                </MondayCell>
                <MondayCell width="w-[160px]">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => moveLead(l.id)} className="py-1 px-2.5 bg-green-500 hover:bg-green-600 text-white text-[11px] font-bold rounded-lg transition-colors">
                      → Contact
                    </button>
                    <button onClick={() => deleteLead(l.id)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </MondayCell>
              </MondayRow>
            ))}

            <div className="flex border-b border-border/80 bg-surface hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => setSlideOverOpen(true)}>
              <div className="border-r border-border/80 flex items-center justify-center p-2.5 w-[44px] shrink-0 relative">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#579bfc]" />
              </div>
              <div className="flex items-center p-2.5 text-[13px] text-text-muted gap-2 hover:text-text-main">
                <Plus className="w-4 h-4" /> Add lead
              </div>
            </div>
          </MondayGroup>
        )}
      </div>

      <BulkImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImport={importLeads} />
    </div>
  );
}
