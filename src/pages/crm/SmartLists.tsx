import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, Plus, Filter, Download,
  Settings, ChevronDown, Check, Edit2, Trash2, List as ListIcon, X,
  Table2, LayoutGrid, Columns, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FilterCondition, ViewMode } from '../../store/useSmartListStore';
import { apiFetch } from '../../lib/apiClient';
import { HeaderPortal } from '../../components/layout/HeaderPortal';

const FIELDS    = ['name', 'email', 'phone', 'businessName', 'tags', 'created'];
const OPERATORS = ['contains', 'equals', 'is not empty', 'starts with'];

const ALL_COLUMNS = ['Contact name', 'Phone', 'Email', 'Business name', 'Created (EDT)', 'Last activity (EDT)', 'Tags'];

const VIEW_OPTIONS: { value: ViewMode; label: string; Icon: any }[] = [
  { value: 'table',  label: 'Table',  Icon: Table2 },
  { value: 'card',   label: 'Cards',  Icon: LayoutGrid },
  { value: 'kanban', label: 'Kanban', Icon: Columns },
];

export default function SmartLists() {
  const qc = useQueryClient();

  // New list form state
  const [newName, setNewName]         = useState('');
  const [newViewMode, setNewViewMode] = useState<ViewMode>('table');

  const { data: lists = [], isLoading } = useQuery<any[]>({
    queryKey: ['smartlists'],
    queryFn: () => apiFetch('/api/crm/smart-lists').then(r => r.ok ? r.json() : []),
  });

  const { data: workspaceTags = [] } = useQuery<any[]>({
    queryKey: ['tags'],
    queryFn: () => apiFetch('/api/crm/tags').then(r => r.ok ? r.json() : []),
  });

  const createList = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiFetch('/api/crm/smart-lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['smartlists'] });
      qc.invalidateQueries({ queryKey: ['smart-lists'] });
    },
  });

  const updateList = useMutation({
    mutationFn: async (data: { id: string; payload: any }) => {
      const r = await apiFetch(`/api/crm/smart-lists/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.payload) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['smartlists'] });
      qc.invalidateQueries({ queryKey: ['smart-lists'] });
    },
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/crm/smart-lists/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['smartlists'] });
      qc.invalidateQueries({ queryKey: ['smart-lists'] });
    },
  });

  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [newMatchMode, setNewMatchMode] = useState<'all' | 'any'>('all');
  const [newColumns, setNewColumns] = useState<Set<string>>(new Set(['Contact name', 'Phone', 'Email', 'Business name', 'Created (EDT)', 'Tags']));
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [conditions, setConditions]   = useState<FilterCondition[]>([
    { id: '1', field: 'name', operator: 'contains', value: '' },
  ]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === lists.length) setSelected(new Set());
    else setSelected(new Set(lists.map(l => l.id)));
  };

  const addCondition = () => {
    setConditions(prev => [...prev, { id: Date.now().toString(), field: 'name', operator: 'contains', value: '' }]);
  };

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, key: keyof FilterCondition, val: string) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, [key]: val } : c));
  };

  const resetPanel = () => {
    setNewName('');
    setNewViewMode('table');
    setNewMatchMode('all');
    setNewColumns(new Set(['Contact name', 'Phone', 'Email', 'Business name', 'Created (EDT)', 'Tags']));
    setConditions([{ id: '1', field: 'name', operator: 'contains', value: '' }]);
    setEditingListId(null);
  };

  const handleSubmit = () => {
    if (!newName.trim()) return;
    
    const payload = {
      name: newName.trim(),
      filters: conditions.filter(c => c.value.trim() !== '' || c.operator === 'is not empty'),
      matchMode: newMatchMode,
      viewMode: newViewMode,
      columns: Array.from(newColumns),
    };

    if (editingListId) {
      updateList.mutate({ id: editingListId, payload });
    } else {
      createList.mutate(payload);
    }
    
    resetPanel();
    setPanelOpen(false);
  };

  const processedLists = React.useMemo(() => {
    if (!searchQuery) return lists;
    const q = searchQuery.toLowerCase();
    return lists.filter(l => String(l?.name || '').toLowerCase().includes(q));
  }, [lists, searchQuery]);



  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full relative bg-bg">
        <div className="px-8 flex items-center justify-between border-b border-border bg-surface h-[73px]">
          <div className="skeleton h-7 w-40 rounded-full" />
          <div className="skeleton h-8 w-32 rounded-lg" />
        </div>
        <div className="flex-1 p-8 grid grid-cols-3 gap-4 auto-rows-max">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 space-y-3">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-3 w-48 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative bg-bg overflow-hidden">
      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Header Bar Portal */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search Smart Lists"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-[220px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
          <button onClick={() => { resetPanel(); setPanelOpen(true); }} className="btn-secondary">
            <Plus className="w-4 h-4" /> Create Smart List
          </button>
        </div>
      </HeaderPortal>

      {/* Table Content inside Frosted Glass Panel */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex flex-col">
        {lists.length === 0 ? (
          <div className="py-24 text-center text-text-muted">
            <ListIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-[14px] font-bold text-text-main">No smart lists created</p>
            <p className="text-[12px] text-text-muted mt-1">Create filtered segments of contacts that update dynamically in real time.</p>
            <button
              onClick={() => { resetPanel(); setPanelOpen(true); }}
              className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-bold shadow-sm"
            >
              + Create Smart List
            </button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
              <tr>
                <th className="w-12 p-3 text-center">
                  <button onClick={toggleAll} className="w-4 h-4 border border-border rounded flex items-center justify-center transition-colors bg-bg hover:border-primary text-primary">
                    {selected.size === lists.length && lists.length > 0 ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                  </button>
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  <div className="flex items-center justify-between">List Name <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">Active Filters</th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">Contacts</th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">Created</th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">Author</th>
                <th className="w-20 p-3 text-[13px] font-semibold whitespace-nowrap text-center text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {processedLists.map((l) => {
                const filtersJsonStr = typeof l.filtersJson === 'string' ? l.filtersJson : JSON.stringify(l.filtersJson || '[]');
                const parsedFilters = (() => { try { return JSON.parse(filtersJsonStr); } catch { return []; } })();
                const activeFilters = parsedFilters.filter((f: any) => f && (f.value || f.operator === 'is not empty')).length;
                return (
                  <tr key={l.id} className={`border-b border-border/50 transition-colors ${selected.has(l.id) ? 'bg-primary/5' : 'hover:bg-surface-hover/50'}`}>
                    <td className="p-3 text-center">
                      <button onClick={() => toggleSelect(l.id)} className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${selected.has(l.id) ? 'bg-primary border-primary text-bg' : 'border-border bg-bg hover:border-primary text-transparent'}`}>
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </button>
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/crm/contacts?smartList=${l.id}`}
                        className="text-[13px] font-semibold text-text-main hover:text-primary transition-colors hover:underline flex items-center gap-1.5"
                      >
                        {l.name}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-[6px] text-[12px] font-bold shadow-sm border border-border bg-surface text-text-main">
                        {activeFilters} condition{activeFilters !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-[6px] text-[12px] font-bold shadow-sm border border-border bg-surface text-text-main">
                        {l.contactCount ?? l._count?.items ?? 0}
                      </span>
                    </td>
                    <td className="p-3 text-[13px] font-medium text-text-muted">{l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="p-3 text-[13px] font-medium text-text-main">{l.author || 'Jack Stone'}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => { 
                            setEditingListId(l.id); 
                            setNewName(l.name);
                            const parsedRules = typeof l.filtersJson === 'string' ? JSON.parse(l.filtersJson || '[]') : (l.filtersJson || []);
                            if (parsedRules.length > 0) setConditions(parsedRules);
                            setNewMatchMode((l.matchMode as 'all' | 'any') || 'all');
                            setNewViewMode((l.viewMode as any) || 'table');
                            try {
                              const cols = typeof l.columnsJson === 'string' ? JSON.parse(l.columnsJson || '[]') : (l.columnsJson || []);
                              if (cols.length > 0) setNewColumns(new Set(cols));
                            } catch {}
                            setPanelOpen(true);
                          }} 
                          className="p-1 text-text-muted hover:text-primary transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { deleteList.mutate(l.id); setSelected(prev => { const s = new Set(prev); s.delete(l.id); return s; }); }}
                          className="p-1 text-text-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Paginator matching CRM standard */}
      <div 
        className="pr-8 pl-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-20 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
        style={{ 
          background: 'var(--sidebar-bg)', 
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
          '--text-main': '#ffffff',
          '--text-muted': '#94a3b8',
          '--border': 'rgba(255,255,255,0.15)',
          '--surface': 'rgba(255,255,255,0.1)',
          '--surface-hover': 'rgba(255,255,255,0.16)',
          '--bg': 'var(--sidebar-bg)',
          '--btn-bg': 'var(--primary)',
          '--btn-hover': 'var(--primary-hover)',
          '--btn-text': '#ffffff',
          '--btn-border': 'transparent'
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-surface border border-border flex items-center gap-2 text-text-main">
            <span className="w-2 h-2 rounded-full bg-primary" />
            {processedLists.length} Smart Lists
          </span>
        </div>

        <div className="flex items-center gap-2 font-semibold">
          <button
            onClick={() => { resetPanel(); setPanelOpen(true); }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> Create Smart List
          </button>
        </div>
      </div>

      {/* Slide-over Form Panel */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanelOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-[420px] bg-surface border-l border-border z-50 flex flex-col shadow-2xl"
            >
              {/* Slide-over Header */}
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-bold text-text-main">
                    {editingListId ? 'Edit Smart List' : 'Create Smart List'}
                  </h2>
                  <p className="text-[12px] text-text-muted mt-0.5">Filter contacts by real-time dynamic conditions.</p>
                </div>
                <button onClick={() => setPanelOpen(false)} className="text-text-muted hover:text-text-main transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Slide-over Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">List Name</label>
                  <input
                    type="text"
                    placeholder="e.g. VIP Clients, Hot Leads Q4…"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
                  />

                  {/* Quick tag presets */}
                  {workspaceTags.length > 0 && !editingListId && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Auto-populate from existing Tag:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {workspaceTags.map((tag: any, idx: number) => {
                          const tagName = typeof tag === 'string' ? tag : String(tag?.name || '');
                          if (!tagName) return null;
                          const isSelected = conditions.some(c => 
                            c.field === 'tags' && 
                            String(c?.value || '').trim().toLowerCase() === tagName.trim().toLowerCase()
                          );
                          return (
                            <button
                              key={tag?.id || `${tagName}-${idx}`}
                              type="button"
                              onClick={() => {
                                setNewName(tagName);
                                setConditions([
                                  { id: Date.now().toString(), field: 'tags', operator: 'contains', value: tagName }
                                ]);
                              }}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-primary/20 text-primary border-primary'
                                  : 'bg-surface-hover text-text-muted border-border hover:border-primary/50 hover:text-text-main'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              {tagName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Match Mode ── */}
                <div className="pt-2">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Match Mode</p>
                  <div className="flex gap-2">
                    {(['all', 'any'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setNewMatchMode(m)}
                        className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                          newMatchMode === m
                            ? 'bg-primary text-white border-primary'
                            : 'bg-surface-hover text-text-muted border-border hover:border-primary/50 hover:text-text-main'
                        }`}
                      >
                        {m === 'all' ? 'Match All' : 'Match Any'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── View Mode ── */}
                <div className="pt-1">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Display View</p>
                  <div className="grid grid-cols-3 gap-2">
                    {VIEW_OPTIONS.map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        onClick={() => setNewViewMode(value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                          newViewMode === value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border bg-surface-hover text-text-muted hover:border-primary/40 hover:text-text-main'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[11px] font-bold">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Column Visibility ── */}
                <div className="pt-1">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Visible Columns</p>
                  <div className="space-y-1">
                    {ALL_COLUMNS.map(col => (
                      <button
                        key={col}
                        onClick={() => setNewColumns(prev => {
                          const s = new Set(prev);
                          s.has(col) ? s.delete(col) : s.add(col);
                          return s;
                        })}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors group border border-transparent hover:border-border cursor-pointer outline-none"
                      >
                        <span className="text-[13px] font-medium text-text-main">{col}</span>
                        {newColumns.has(col)
                          ? <Eye className="w-3.5 h-3.5 text-primary" />
                          : <EyeOff className="w-3.5 h-3.5 text-text-muted" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Conditions */}
                <div className="pt-2">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 block">Filter Conditions</label>
                  {conditions.length === 0 && (
                    <div className="p-3 bg-surface-hover/50 border border-border/50 rounded-lg text-center mb-3">
                      <p className="text-[12px] text-text-muted">No conditions. Add one below to filter contacts.</p>
                    </div>
                  )}
                  <datalist id="tag-suggestions">
                    {workspaceTags.map((t: any, idx: number) => {
                      const name = typeof t === 'string' ? t : String(t?.name || '');
                      return name ? <option key={t?.id || `${name}-${idx}`} value={name} /> : null;
                    })}
                  </datalist>
                  <div className="space-y-2 mb-3">
                    {conditions.map((cond, idx) => (
                      <div key={cond.id} className="flex items-center gap-1.5 group">
                        <span className="text-[10px] font-bold text-text-muted w-8 text-right shrink-0">
                          {idx === 0 ? 'IF' : newMatchMode === 'all' ? 'AND' : 'OR'}
                        </span>
                        <select
                          value={cond.field}
                          onChange={e => updateCondition(cond.id, 'field', e.target.value)}
                          className="bg-surface-hover border border-border text-text-main text-[11px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary w-[100px] shrink-0"
                        >
                          {FIELDS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                        </select>
                        <select
                          value={cond.operator}
                          onChange={e => updateCondition(cond.id, 'operator', e.target.value)}
                          className="bg-surface-hover border border-border text-text-main text-[11px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary w-[96px] shrink-0"
                        >
                          {OPERATORS.map(op => <option key={op} value={op}>{op.charAt(0).toUpperCase() + op.slice(1)}</option>)}
                        </select>
                        {cond.operator !== 'is not empty' && (
                          <input
                            type="text"
                            placeholder={cond.field === 'tags' ? 'Tag name (or pick below)…' : 'Value…'}
                            list={cond.field === 'tags' ? 'tag-suggestions' : undefined}
                            value={cond.value || ''}
                            onChange={e => updateCondition(cond.id, 'value', e.target.value)}
                            className="flex-1 bg-surface-hover border border-border text-text-main text-[11px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary min-w-0 placeholder:text-text-muted"
                          />
                        )}
                        <button
                          onClick={() => removeCondition(cond.id)}
                          className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addCondition}
                    className="w-full py-2 border-2 border-dashed border-border rounded-lg text-[12px] font-semibold text-primary hover:bg-primary/5 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add condition
                  </button>
                </div>

                {/* Preview Info */}
                {newName && conditions.some(c => c.value || c.operator === 'is not empty') && (
                  <div className="pt-2">
                    <div className="p-3.5 rounded-[8px] bg-primary/5 border border-primary/20">
                      <p className="text-[12px] font-semibold text-primary mb-1">Preview mode</p>
                      <p className="text-[11.5px] text-text-main leading-relaxed">
                        This list will securely capture and update any contacts where <strong className="text-primary">{newMatchMode === 'all' ? 'all' : 'any'}</strong> of the {conditions.filter(c => c.value || c.operator === 'is not empty').length} defined condition(s) are met.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel Footer */}
              <div className="p-6 border-t border-border flex justify-end gap-3 bg-surface-hover/50 shrink-0">
                <button
                  onClick={() => { setPanelOpen(false); resetPanel(); }}
                  className="px-4 py-2 rounded-[8px] text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!newName.trim()}
                  className="px-5 py-2 text-white rounded-[8px] text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  Create List
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
