import React, { useState } from 'react';
import { 
  Search, Plus, Filter, Download, MoreVertical, 
  Settings, ChevronDown, Check, Edit2, Trash2, List as ListIcon, X,
  Table2, LayoutGrid, Columns, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FilterCondition, ViewMode } from '../../store/useSmartListStore';

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
    queryFn: () => fetch('/api/crm/smart-lists').then(r => r.ok ? r.json() : []),
  });


  const createList = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch('/api/crm/smart-lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['smartlists'] }),
  });

  const updateList = useMutation({
    mutationFn: async (data: { id: string; payload: any }) => {
      const r = await fetch(`/api/crm/smart-lists/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.payload) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['smartlists'] }),
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/crm/smart-lists/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['smartlists'] }),
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
    return lists.filter(l => l.name.toLowerCase().includes(q));
  }, [lists, searchQuery]);



  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
          <div className="text-text-muted font-medium text-sm animate-pulse">Loading smart lists...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      {/* Header section */}
      <div className="px-8 flex items-center justify-between bg-surface z-10 sticky top-0 shadow-sm relative border-b border-border h-[68px]">
        <div className="flex items-center gap-4">
          <h1 className="text-[20px] font-bold text-text-main">Smart Lists</h1>
          <span className="px-2.5 py-0.5 rounded-[4px] text-[13px] font-medium bg-bg text-text-main shadow-sm border border-border">
            {processedLists.length} Lists
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[4px] text-[14px] font-medium text-text-muted hover:text-text-main transition-colors shadow-sm bg-surface">
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => { resetPanel(); setPanelOpen(true); }}
            className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[4px] text-[14px] font-medium text-text-muted hover:text-text-main transition-colors shadow-sm bg-surface active:scale-95"
          >
            <Plus className="w-4 h-4" /> Create Smart List
          </button>
          <button className="flex items-center justify-center p-1.5 text-text-muted hover:text-text-main rounded-[4px] transition-colors border border-border bg-surface shadow-sm">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Unified Toolbar */}
      <div className="px-8 flex items-center justify-between border-b border-border bg-surface relative shadow-[0_4px_24px_rgba(0,0,0,0.12)] h-[73px]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full cursor-pointer text-text-main bg-bg border border-border shadow-sm">
            <ListIcon className="w-4 h-4 text-primary" />
            <span className="text-[13px] font-bold">All Lists</span>
          </div>
          <div className="w-[1px] h-5 bg-border mx-2"></div>
          <button className="flex items-center gap-2 px-4 py-1.5 border border-border bg-surface-hover rounded-full text-[13px] font-medium text-text-main transition-colors shadow-sm ml-1">
            <Filter className="w-3.5 h-3.5" /> Filter Views
          </button>
          <button className="flex items-center gap-2 px-4 py-1.5 border border-border bg-surface-hover rounded-full text-[13px] font-medium text-text-main transition-colors shadow-sm">
            <ChevronDown className="w-3.5 h-3.5" /> Sort
          </button>
        </div>
        <div className="flex items-center gap-5">
          <div className="relative shadow-sm rounded-full flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search Smart Lists"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-[280px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
          <button className="flex items-center gap-2 text-[13px] font-medium text-text-muted hover:text-text-main transition-colors">
            <Settings className="w-4 h-4" /> Manage columns
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5">
        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center mb-4">
              <ListIcon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-[15px] font-bold text-text-main mb-1">No Smart Lists yet</h3>
            <p className="text-[13px] text-text-muted mb-5">Create your first smart list to segment your contacts.</p>
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-2 px-5 py-2 text-white rounded-xl text-[13px] font-semibold shadow-sm"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <Plus className="w-4 h-4" /> Create Smart List
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
                const parsedFilters = typeof l.filters === 'string' ? JSON.parse(l.filters||'[]') : (l.filters||[]);
                const activeFilters = parsedFilters.filter((f: any) => f.value || f.operator === 'is not empty').length;
                return (
                  <tr key={l.id} className={`border-b border-border/50 transition-colors ${selected.has(l.id) ? 'bg-primary/5' : 'hover:bg-surface-hover/50'}`}>
                    <td className="p-3 text-center">
                      <button onClick={() => toggleSelect(l.id)} className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${selected.has(l.id) ? 'bg-primary border-primary text-bg' : 'border-border bg-bg hover:border-primary text-transparent'}`}>
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </button>
                    </td>
                    <td className="p-3">
                      <span className="text-[13px] font-semibold text-text-main cursor-pointer hover:text-primary transition-colors">{l.name}</span>
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-[6px] text-[12px] font-bold shadow-sm border border-border bg-surface text-text-main">
                        {activeFilters} condition{activeFilters !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-[6px] text-[12px] font-bold shadow-sm border border-border bg-surface text-text-main">
                        {l._count?.items || 0}
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
                            if (parsedFilters.length > 0) setConditions(parsedFilters);
                            setPanelOpen(true);
                          }} 
                          className="text-text-muted hover:text-primary transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { deleteList.mutate(l.id); setSelected(prev => { const s = new Set(prev); s.delete(l.id); return s; }); }}
                          className="text-text-muted hover:text-accent-red transition-colors"
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

      {/* Footer Paginator */}
      <div className="px-8 py-4 border-t border-border bg-surface flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0">
        <div className="font-semibold text-text-muted">Page 1 of 1</div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 border border-border rounded-[4px] px-2.5 py-1.5 cursor-pointer font-semibold hover:border-primary/50 transition-colors bg-bg text-text-main">
            20 <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="flex items-center gap-1.5 font-semibold">
            <button className="px-3 py-1.5 transition-colors text-text-muted hover:text-text-main">Prev</button>
            <button className="px-3.5 py-1.5 rounded-[4px] shadow-sm text-bg font-bold" style={{ backgroundColor: 'var(--primary)' }}>1</button>
            <button className="px-3 py-1.5 transition-colors text-text-muted hover:text-text-main">Next</button>
          </div>
        </div>
      </div>

      {/* ── Create Smart List Slide-Over ── */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]"
              onClick={() => { setPanelOpen(false); resetPanel(); }}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[460px] bg-surface shadow-2xl z-50 flex flex-col border-l border-border"
            >
              {/* Panel Header */}
              <div className="px-6 py-5 flex items-center justify-between border-b border-border bg-surface-hover/50 shrink-0">
                <div>
                  <h2 className="text-[16px] font-bold text-text-main">
                  {editingListId ? 'Edit Smart List' : 'Create Smart List'}
                </h2>  <p className="text-[12px] text-text-muted mt-0.5">Define a name and optional filter conditions.</p>
                </div>
                <button
                  onClick={() => { setPanelOpen(false); resetPanel(); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Panel Body */}
              <div className="p-6 flex-1 overflow-auto space-y-5">
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
                            placeholder="Value…"
                            value={cond.value}
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
