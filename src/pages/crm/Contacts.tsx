import React, { useState } from 'react'; 
import { 
  Search, Filter, List as ListIcon, Plus, Download,
  Settings, Phone, Mail, ChevronDown, Check,
  User, CheckSquare, X, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ui/Toast';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import { NewContactSlideOver } from './components/NewContactSlideOver';
import { ImportContactsModal } from './components/ImportContactsModal';
import { apiFetch } from '../../lib/apiClient';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  businessName: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  color: string;
}

const ALL_COLUMNS = ['Contact name', 'Phone', 'Email', 'Business name', 'Created (EDT)', 'Last activity (EDT)', 'Tags'];

export default function Contacts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeListId, setActiveListId] = useState<string>(() => searchParams.get('smartList') || searchParams.get('list') || 'all');
  const [filters, setFilters] = useState<{id: string; field: string; operator: string; value: string}[]>([]);
  const [filterMatchMode, setFilterMatchMode] = useState<'all' | 'any'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [smartListNameInput, setSmartListNameInput] = useState('');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<Contact>>>({});
  const [contactError, setContactError] = useState<string | null>(null);

  // Pagination states (max 50 per page)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [pageSizeDropdownOpen, setPageSizeDropdownOpen] = useState(false);

  const { data: smartLists = [] } = useQuery<any[]>({
    queryKey: ['smart-lists'],
    queryFn: () => apiFetch('/api/crm/smart-lists').then(r => r.ok ? r.json() : []),
  });

  const { data: contactsResponse, isLoading } = useQuery<{ contacts: Contact[]; total: number; page: number; limit: number }>({
    queryKey: ['contacts', { activeListId, filters, filterMatchMode, searchQuery, page, pageSize }],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const q = new URLSearchParams();
      q.append('page', String(page));
      q.append('limit', String(pageSize));
      if (searchQuery) q.append('search', searchQuery);
      if (filters.length > 0) {
        q.append('filtersJson', JSON.stringify({ matchMode: filterMatchMode, rules: filters }));
      }
      if (activeListId !== 'all') {
        const r = await apiFetch(`/api/crm/smart-lists/${activeListId}/contacts?${q.toString()}`);
        if (!r.ok) return { contacts: [], total: 0, page: 1, limit: pageSize };
        const data = await r.json();
        if (Array.isArray(data)) return { contacts: data, total: data.length, page: 1, limit: pageSize };
        return {
          contacts: data.contacts || [],
          total: typeof data.total === 'number' ? data.total : (data.contacts?.length || 0),
          page: data.page || page,
          limit: data.limit || pageSize,
        };
      }
      const r = await apiFetch(`/api/crm/contacts?${q.toString()}`);
      if (!r.ok) return { contacts: [], total: 0, page: 1, limit: pageSize };
      const data = await r.json();
      if (Array.isArray(data)) return { contacts: data, total: data.length, page: 1, limit: pageSize };
      return {
        contacts: data.contacts || [],
        total: typeof data.total === 'number' ? data.total : (data.contacts?.length || 0),
        page: data.page || page,
        limit: data.limit || pageSize,
      };
    },
  });

  const apiContacts = Array.isArray(contactsResponse?.contacts) ? contactsResponse.contacts : [];
  const totalContacts = typeof contactsResponse?.total === 'number' ? contactsResponse.total : apiContacts.length;
  const totalPages = Math.max(1, Math.ceil(totalContacts / pageSize));

  const createContact = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiFetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const text = await r.text();
        let msg = `HTTP ${r.status}`;
        try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
        throw new Error(msg);
      }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/crm/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const createSmartList = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch('/api/crm/smart-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ['smart-lists'] });
      qc.invalidateQueries({ queryKey: ['smartlists'] });
      setSmartListNameInput('');
      setPanelOpen(null);
      if (created?.id) {
        setActiveListId(created.id);
        setPage(1);
      }
      toast('success', 'Smart List Created!', `Created smart list "${created?.name || ''}"`);
    },
  });

  const deleteSmartList = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/crm/smart-lists/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['smart-lists'] });
      qc.invalidateQueries({ queryKey: ['smartlists'] });
      setActiveListId('all');
      setPage(1);
      toast('success', 'Smart List Deleted');
    },
  });

  const bulkAction = useMutation({
    mutationFn: async ({ action, contactIds, payload }: { action: string; contactIds: string[]; payload?: any }) => {
      const res = await apiFetch('/api/crm/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, contactIds, payload }),
      });
      if (!res.ok) throw new Error('Failed bulk action');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setSelected(new Set());
      setPanelOpen(null);
      toast('success', 'Bulk action completed');
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<Contact> }) => {
      const res = await apiFetch(`/api/crm/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update contact');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: () => toast('error', 'Failed to save changes')
  });

  const handleSaveEdits = async () => {
    for (const [id, data] of Object.entries(pendingEdits)) {
      await updateContact.mutateAsync({ id, data });
    }
    setPendingEdits({});
    setEditingCell(null);
    toast('success', 'Changes saved successfully');
  };

  const handleCancelEdits = () => {
    setPendingEdits({});
    setEditingCell(null);
  };

  const handleBulkDelete = () => setDeleteConfirmOpen(true);

  const handleConfirmDelete = () => {
    selected.forEach(id => deleteContact.mutate(id));
    toast('success', 'Contacts deleted', `Removed ${selected.size} contact${selected.size === 1 ? '' : 's'} from your workspace.`);
    setSelected(new Set());
    setDeleteConfirmOpen(false);
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(ALL_COLUMNS));
  const [sortConfig, setSortConfig] = useState<{ field: keyof Contact, direction: 'asc' | 'desc' } | null>(null);
  
  // Panel states
  const [panelOpen, setPanelOpen] = useState<'filter' | 'manage' | 'new_contact' | 'duplicates' | 'bulk_tags' | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [advancedContactOptionsOpen, setAdvancedContactOptionsOpen] = useState(false);

  const [newContact, setNewContact] = useState<any>({ firstName: '', lastName: '', email: '', phone: '', businessName: '', title: '', status: 'Lead', about: '', source: '', color: '#7dd3fc', tags: [], notes: '' });
  const [newContactTagInput, setNewContactTagInput] = useState('');
  const [bulkTagInput, setBulkTagInput] = useState('');

  // Find duplicates
  const duplicateGroups = React.useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    apiContacts.forEach(c => {
      if (c.email) {
        if (!groups[c.email]) groups[c.email] = [];
        groups[c.email].push(c);
      }
      if (c.phone) {
        if (!groups[c.phone]) groups[c.phone] = [];
        if (!groups[c.phone].find(x => x.id === c.id)) groups[c.phone].push(c);
      }
    });
    return Object.values(groups).filter(g => g.length > 1);
  }, [apiContacts]);
  const activeList = smartLists.find(l => l.id === activeListId);
  const baseContacts = apiContacts;

  // Computations (sorting is client-side for now, DB handles filtering)
  const processedContacts = React.useMemo(() => {
    let result = [...baseContacts];

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.field === 'createdAt' || sortConfig.field === 'updatedAt') {
          const timeA = new Date(a[sortConfig.field]).getTime();
          const timeB = new Date(b[sortConfig.field]).getTime();
          if (timeA < timeB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (timeA > timeB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }

        const valA = String(a[sortConfig.field]).toLowerCase();
        const valB = String(b[sortConfig.field]).toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [baseContacts, sortConfig]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportCSV = () => {
    let rows = processedContacts;
    if (selected.size > 0) {
      rows = processedContacts.filter(c => selected.has(c.id));
    }
    const headers = ['Name', 'Email', 'Phone', 'Business', 'Created'];
    const csvContent = [
      headers.join(','),
      ...rows.map(c => `"${c.name || ''}","${c.email || ''}","${c.phone || ''}","${c.businessName || ''}","${new Date(c.createdAt).toLocaleString()}"`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stone_crm_contacts_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('success', 'Export Complete', `Exported ${rows.length} contacts to CSV`);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === apiContacts.length) setSelected(new Set());
    else setSelected(new Set(apiContacts.map(c => c.id)));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full relative bg-bg">
        <div className="px-8 flex items-center justify-between border-b border-border bg-surface h-[73px]">
          <div className="flex items-center gap-2">
            <div className="skeleton h-7 w-10 rounded-lg" />
            <div className="skeleton h-7 w-28 rounded-lg" />
            <div className="skeleton h-7 w-16 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton h-7 w-40 rounded-full" />
            <div className="skeleton h-7 w-20 rounded-lg" />
            <div className="skeleton h-8 w-28 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 border border-border/50 shadow-luxury">
          <table className="w-full text-left">
            <thead className="border-b border-border/50 bg-surface/80">
              <tr>
                {[48, 160, 120, 180, 140, 110, 90].map((w, i) => (
                  <th key={i} className="p-3"><div className="skeleton h-3 rounded" style={{ width: w }} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-3"><div className="skeleton w-4 h-4 rounded" /></td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="skeleton w-7 h-7 rounded-full" />
                      <div className="skeleton h-3 w-32 rounded" />
                    </div>
                  </td>
                  <td className="p-3"><div className="skeleton h-3 w-24 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-36 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-28 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-20 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-5 w-14 rounded-full" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0">

      
      {/* Full-tab frosted glass overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10"></div>

      {/* Header section removed */}

      {/* Unified Toolbar OR Bulk Actions Context Bar */}
      {/* Unified Toolbar OR Bulk Actions Context Bar */}
      <AnimatePresence mode="wait" initial={false}>
        {selected.size > 0 && (
          <motion.div 
            key="bulk-toolbar"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 73 }} exit={{ opacity: 0, height: 0 }}
            className="px-8 flex items-center justify-between border-b border-border bg-surface-hover/50 relative shadow-sm w-full overflow-hidden"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-[6px]">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  <span className="text-[13px] font-bold text-primary">{selected.size} Selected</span>
                </div>
                <button onClick={() => setSelected(new Set())} className="text-[12px] font-medium text-text-muted hover:text-text-main transition-colors">Clear selection</button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => toast('success', `Drafting email to ${selected.size} contacts`)} className="flex items-center gap-2 px-4 py-2 border border-border bg-surface-hover rounded-[8px] text-[13px] font-semibold text-text-main hover:bg-surface transition-colors shadow-sm card-hover-lift">
                  <Mail className="w-4 h-4" /> Send Email
                </button>
                <button onClick={() => toast('success', `Drafting SMS to ${selected.size} contacts`)} className="flex items-center gap-2 px-4 py-2 border border-border bg-surface-hover rounded-[8px] text-[13px] font-semibold text-text-main hover:bg-surface transition-colors shadow-sm card-hover-lift">
                  <Phone className="w-4 h-4" /> Send SMS
                </button>
                <button onClick={() => setPanelOpen('bulk_tags')} className="flex items-center gap-2 px-4 py-2 border border-border bg-surface-hover rounded-[8px] text-[13px] font-semibold text-text-main hover:bg-surface transition-colors shadow-sm card-hover-lift">
                  <Filter className="w-4 h-4" /> Add Tags
                </button>
                <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-border bg-surface-hover rounded-[8px] text-[13px] font-semibold text-text-main hover:bg-surface transition-colors shadow-sm card-hover-lift">
                  <Download className="w-4 h-4" /> Export
                </button>
                <div className="w-[1px] h-6 bg-border mx-1"></div>
                <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2 border border-red-500/30 bg-red-500/10 rounded-[8px] text-[13px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors shadow-sm card-hover-lift">
                  <X className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <HeaderPortal>
        <div className="flex items-center gap-3">
          {Object.keys(pendingEdits).length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 mr-2">
              <button 
                onClick={handleSaveEdits} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20 text-[12px] font-bold rounded-full transition-colors shadow-sm"
              >
                <Check className="w-3.5 h-3.5" strokeWidth={3} /> Save Changes
              </button>
              <button 
                onClick={handleCancelEdits}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 text-[12px] font-bold rounded-full transition-colors shadow-sm"
              >
                <X className="w-3.5 h-3.5" strokeWidth={3} /> Cancel
              </button>
              <div className="w-[1px] h-5 bg-border ml-1"></div>
            </div>
          )}
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search Contacts" 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-1.5 w-[200px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
          
          <button onClick={() => setImportModalOpen(true)} className="btn-secondary">
            <Download className="w-4 h-4" /> Import
          </button>
          
          <div className="relative flex items-center gap-1">
            <button 
              onClick={() => setPanelOpen('new_contact')} 
              className="btn-secondary"
            >
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>

          <div className="w-[1px] h-5 bg-border mx-1"></div>

          <div className="relative flex items-center gap-2">
            <button 
              onClick={() => setPanelOpen('manage')} 
              className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--sidebar-text-muted)] hover:text-white transition-colors ml-1"
            >
              <Settings className="w-4 h-4" /> Manage fields
            </button>
          </div>
        </div>
      </HeaderPortal>

      {/* Content Rendering */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
            <tr>
              <th className="w-12 p-3 text-center">
                <button onClick={toggleAll} className="w-4 h-4 border border-border rounded flex items-center justify-center transition-colors bg-bg hover:border-primary text-primary">
                  {selected.size === apiContacts.length ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                </button>
              </th>
              {visibleCols.has('Contact name') && (
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  <div className="flex items-center justify-between">Contact name <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
                </th>
              )}
              {visibleCols.has('Phone') && (
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  <div className="flex items-center justify-between">Phone <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
                </th>
              )}
              {visibleCols.has('Email') && (
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  <div className="flex items-center justify-between">Email <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
                </th>
              )}
              {visibleCols.has('Business name') && (
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  <div className="flex items-center justify-between">Business name <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
                </th>
              )}
              {visibleCols.has('Created (EDT)') && (
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted cursor-pointer hover:text-text-main transition-colors" onClick={() => setSortConfig({ field: 'createdAt', direction: sortConfig?.field === 'createdAt' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                  <div className="flex items-center justify-between">Created (EDT) <ChevronDown className={`w-3.5 h-3.5 transition-opacity ${sortConfig?.field === 'createdAt' ? 'opacity-100 text-primary' : 'opacity-40 hover:opacity-100'}`} /></div>
                </th>
              )}
              {visibleCols.has('Last activity (EDT)') && (
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted cursor-pointer hover:text-text-main transition-colors" onClick={() => setSortConfig({ field: 'updatedAt', direction: sortConfig?.field === 'updatedAt' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })}>
                  <div className="flex items-center justify-between">Last activity (EDT) <ChevronDown className={`w-3.5 h-3.5 transition-opacity ${sortConfig?.field === 'updatedAt' ? 'opacity-100 text-primary' : 'opacity-40 hover:opacity-100'}`} /></div>
                </th>
              )}
              {visibleCols.has('Tags') && (
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">Tags</th>
              )}
            </tr>
          </thead>
          <tbody>
            {processedContacts.map((c) => (
              <tr 
                key={c.id} 
                className={`border-b border-border/50 transition-colors cursor-pointer ${selected.has(c.id) ? 'bg-primary/10' : 'bg-black/5 hover:bg-black/10'}`}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON' && !target.closest('button')) {
                    navigate(`/crm/contacts/${c.id}`);
                  }
                }}
              >
                <td className="p-3 text-center">
                  <button onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }} className="w-4 h-4 border border-border bg-bg rounded flex items-center justify-center transition-colors hover:border-primary text-primary">
                    {selected.has(c.id) ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                  </button>
                </td>
                {visibleCols.has('Contact name') && (
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-white text-zinc-950 shadow-sm shrink-0 border border-white/20">
                        {(c.name || '').includes('(Example)') ? (c.name || '').replace('(Example) ', '').charAt(0) : (c.name || '').substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[13px] font-medium transition-colors text-text-main truncate hover:underline">{c.name ?? 'Unknown'}</span>
                      {((c as any).totalEmailsReceived || 0) > 0 && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0"
                          title={`Contacted ${(c as any).totalEmailsReceived} time${(c as any).totalEmailsReceived !== 1 ? 's' : ''}`}
                        >
                          {(c as any).totalEmailsReceived}x
                        </span>
                      )}
                    </div>
                  </td>
                )}
                {visibleCols.has('Phone') && (
                  <td className="p-3" onClick={(e) => { e.stopPropagation(); setEditingCell({ id: c.id, field: 'phone' }); }}>
                    <div className="flex items-center gap-2 text-[13px] font-medium text-text-main">
                      <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      {editingCell?.id === c.id && editingCell.field === 'phone' ? (
                        <input
                          autoFocus
                          type="text"
                          defaultValue={pendingEdits[c.id]?.phone ?? c.phone ?? ''}
                          onBlur={(e) => {
                            if (e.target.value !== (c.phone || '')) {
                              setPendingEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], phone: e.target.value } }));
                            }
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="flex-1 bg-transparent border-b border-primary outline-none focus:bg-primary/5 px-1 py-0.5 rounded text-text-main min-w-[100px]"
                        />
                      ) : (
                        <span className="border-b border-transparent hover:border-border/50 transition-colors w-full cursor-text">{pendingEdits[c.id]?.phone ?? c.phone}</span>
                      )}
                    </div>
                  </td>
                )}
                {visibleCols.has('Email') && (
                  <td className="p-3" onClick={(e) => { e.stopPropagation(); setEditingCell({ id: c.id, field: 'email' }); }}>
                    <div className="flex items-center gap-2 text-[13px] font-medium text-text-main">
                      <Mail className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      {editingCell?.id === c.id && editingCell.field === 'email' ? (
                        <input
                          autoFocus
                          type="text"
                          defaultValue={pendingEdits[c.id]?.email ?? c.email ?? ''}
                          onBlur={(e) => {
                            if (e.target.value !== (c.email || '')) {
                              setPendingEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], email: e.target.value } }));
                            }
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="flex-1 bg-transparent border-b border-primary outline-none focus:bg-primary/5 px-1 py-0.5 rounded text-text-main min-w-[150px]"
                        />
                      ) : (
                        <span className="truncate max-w-[150px] border-b border-transparent hover:border-border/50 transition-colors w-full cursor-text">{pendingEdits[c.id]?.email ?? c.email}</span>
                      )}
                    </div>
                  </td>
                )}
                {visibleCols.has('Business name') && (
                  <td className="p-3 text-[13px] font-medium text-text-main" onClick={(e) => { e.stopPropagation(); setEditingCell({ id: c.id, field: 'businessName' }); }}>
                    {editingCell?.id === c.id && editingCell.field === 'businessName' ? (
                      <input
                        autoFocus
                        type="text"
                        defaultValue={pendingEdits[c.id]?.businessName ?? c.businessName ?? ''}
                        onBlur={(e) => {
                          if (e.target.value !== (c.businessName || '')) {
                            setPendingEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], businessName: e.target.value } }));
                          }
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                        className="w-full bg-transparent border-b border-primary outline-none focus:bg-primary/5 px-1 py-0.5 rounded text-text-main"
                      />
                    ) : (
                      <span className="truncate max-w-[150px] inline-block border-b border-transparent hover:border-border/50 transition-colors cursor-text">{pendingEdits[c.id]?.businessName ?? c.businessName}</span>
                    )}
                  </td>
                )}
                {visibleCols.has('Created (EDT)') && (
                  <td className="p-3 text-[11px] font-medium whitespace-nowrap text-text-muted opacity-60">{new Date(c.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                )}
                {visibleCols.has('Last activity (EDT)') && (
                  <td className="p-3 text-[11px] font-medium whitespace-nowrap text-text-muted opacity-60">{new Date(c.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                )}
                {visibleCols.has('Tags') && (
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 flex-wrap max-w-[150px]">
                      {(c.tags || []).slice(0, 1).map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shadow-sm border border-border bg-bg text-text-muted">{tag}</span>
                      ))}
                      {(c.tags || []).length > 1 && (
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold shadow-sm border border-border bg-bg text-text-muted">+{(c.tags || []).length - 1}</span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Paginator */}
      <div 
        className="px-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
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
          <button onClick={() => setPanelOpen('filter')} className="btn-secondary">
            <Filter className="w-4 h-4 text-white" /> Advanced filters
          </button>
          <div className="relative">
            <button onClick={() => setSortDropdownOpen(!sortDropdownOpen)} className="btn-secondary">
              <ChevronDown className="w-4 h-4" /> Sort
            </button>
            <AnimatePresence>
              {sortDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortDropdownOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 bottom-full mb-2 w-[180px] bg-surface border border-border/50 shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5"
                  >
                    {[
                      { label: 'Name (A-Z)', field: 'name', dir: 'asc' },
                      { label: 'Name (Z-A)', field: 'name', dir: 'desc' },
                      { label: 'Newest First', field: 'createdAt', dir: 'desc' },
                      { label: 'Oldest First', field: 'createdAt', dir: 'asc' }
                    ].map((opt, i) => (
                      <button 
                        key={i} 
                        onClick={() => { setSortConfig({ field: opt.field as keyof Contact, direction: opt.dir as 'asc' | 'desc' }); setSortDropdownOpen(false); }} 
                        className="w-full flex items-center px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                    {sortConfig && (
                      <div className="border-t border-border mt-1 pt-1">
                        <button onClick={() => { setSortConfig(null); setSortDropdownOpen(false); }} className="w-full flex items-center px-4 py-2 text-[13px] font-medium text-red-400 hover:bg-surface-hover transition-colors">Clear Sort</button>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Rows Per Page Selector (Max 50) */}
          <div className="relative">
            <button
              onClick={() => setPageSizeDropdownOpen(!pageSizeDropdownOpen)}
              className="flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5 cursor-pointer font-semibold hover:border-primary/50 transition-colors bg-bg text-text-main text-[12px]"
              title="Rows per page (Max 50)"
            >
              <span>{pageSize} / page</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>

            {pageSizeDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setPageSizeDropdownOpen(false)} 
                />
                <div className="absolute bottom-full mb-1 right-0 w-32 bg-surface border border-border rounded-lg shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    Rows per page
                  </div>
                  {[10, 20, 30, 50].map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setPageSize(size);
                        setPage(1);
                        setPageSizeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between transition-colors ${
                        pageSize === size
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-text-main hover:bg-surface-hover'
                      }`}
                    >
                      <span>{size} leads</span>
                      {pageSize === size && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-1.5 font-semibold">
            <button
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-[6px] border border-border text-[12px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc: (number | string)[], p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) => (
                typeof p === 'number' ? (
                  <button
                    key={idx}
                    onClick={() => setPage(p)}
                    className={`min-w-[28px] h-7 px-2 rounded-[6px] text-[12px] font-bold transition-all ${
                      page === p
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-border text-text-muted hover:text-text-main hover:bg-surface-hover'
                    }`}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={idx} className="px-1 text-[12px] text-text-muted">...</span>
                )
              ))
            }

            <button
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-[6px] border border-border text-[12px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Panels */}
      <AnimatePresence>
        {panelOpen && panelOpen !== 'new_contact' && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]"
              onClick={() => setPanelOpen(null)} 
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[400px] bg-surface shadow-2xl z-50 flex flex-col border-l border-border"
            >
              <div className="px-6 py-5 flex items-center justify-between border-b border-border bg-surface-hover/50">
                <h2 className="text-[16px] font-bold text-text-main">
                  {panelOpen === 'filter' ? 'Advanced Filters' : panelOpen === 'manage' ? 'Manage Columns' : panelOpen === 'duplicates' ? 'Merge Duplicates' : panelOpen === 'bulk_tags' ? 'Add Tags to Selected' : 'Create Smart List'}
                </h2>
                <button onClick={() => setPanelOpen(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-auto bg-surface">
                {panelOpen === 'duplicates' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-[8px] bg-surface-hover/50 border border-border">
                      <p className="text-[13px] font-medium text-text-main mb-2">Auto-Detect Duplicates</p>
                      <p className="text-[12px] text-text-muted mb-4">Scan your contacts for duplicate emails or phone numbers to clean up your workspace.</p>
                      <button className="w-full py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors hover:opacity-90">
                        <Search className="w-4 h-4" /> Scan Workspace
                      </button>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Detected Duplicates</p>
                      {duplicateGroups.length === 0 ? (
                        <div className="text-[13px] text-text-muted text-center py-6 border border-dashed border-border rounded-[8px]">
                          No duplicates detected based on email or phone.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {duplicateGroups.map((group, i) => (
                            <div key={i} className="p-3 border border-border rounded-lg bg-surface-hover">
                              <p className="text-[12px] font-medium text-text-main mb-2">Duplicate Group {i + 1}</p>
                              {group.map(c => (
                                <div key={c.id} className="text-[12px] text-text-muted flex justify-between py-1 border-t border-border/50 first:border-0 mt-1 first:mt-0 pt-1 first:pt-0">
                                  <span>{c.name || 'Unknown'}</span>
                                  <span>{c.email || c.phone}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {panelOpen === 'bulk_tags' && (
                  <div className="space-y-6">
                    <p className="text-[13px] text-text-muted">You are modifying tags for <strong>{selected.size}</strong> selected contacts.</p>
                    <div className="space-y-3">
                      <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Add Tag</label>
                      <div className="flex gap-2">
                        <input type="text" value={bulkTagInput} onChange={e => setBulkTagInput(e.target.value)} placeholder="Type tag name..." className="flex-1 bg-surface border border-border text-[13px] px-3 py-2 rounded-[6px] focus:border-primary focus:outline-none" />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['VIP', 'Cold Lead', 'Partner', 'Needs Follow-up'].map(tag => (
                          <div key={tag} onClick={() => setBulkTagInput(tag)} className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-full text-[13px] text-text-main hover:bg-surface-hover cursor-pointer transition-colors">
                            <span className="w-2 h-2 rounded-full bg-primary/60"></span> {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {panelOpen === 'filter' && (
                  <div className="space-y-5">

                    {/* ── Match Mode ── */}
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Match Mode</p>
                      <div className="flex gap-2">
                        {(['all', 'any'] as const).map(m => (
                          <button
                            key={m}
                            onClick={() => setFilterMatchMode(m)}
                            className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                              filterMatchMode === m
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface-hover text-text-muted border-border hover:border-primary/50 hover:text-text-main'
                            }`}
                          >
                            {m === 'all' ? 'Match All' : 'Match Any'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Column Visibility ── */}
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Visible Columns</p>
                      <div className="space-y-1">
                        {ALL_COLUMNS.map(col => (
                          <button
                            key={col}
                            onClick={() => setVisibleCols(prev => {
                              const s = new Set(prev);
                              s.has(col) ? s.delete(col) : s.add(col);
                              return s;
                            })}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors group border border-transparent hover:border-border"
                          >
                            <span className="text-[13px] font-medium text-text-main">{col}</span>
                            {visibleCols.has(col)
                              ? <Eye className="w-3.5 h-3.5 text-primary" />
                              : <EyeOff className="w-3.5 h-3.5 text-text-muted" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Filter Conditions ── */}
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Filter Conditions</p>
                      {filters.length === 0 && (
                        <div className="p-3 bg-surface-hover/50 border border-border/50 rounded-lg text-center mb-3">
                          <p className="text-[12px] text-text-muted">No conditions. Add one below to filter contacts.</p>
                        </div>
                      )}
                      <div className="space-y-2 mb-3">
                        {filters.map((f, i) => (
                          <div key={f.id} className="flex items-center gap-1.5 group">
                            <span className="text-[10px] font-bold text-text-muted w-8 text-right shrink-0">
                              {i === 0 ? 'IF' : filterMatchMode === 'all' ? 'AND' : 'OR'}
                            </span>
                            <select
                              value={f.field}
                              onChange={e => setFilters(prev => prev.map((x, idx) => idx === i ? {...x, field: e.target.value} : x))}
                              className="bg-surface-hover border border-border text-text-main text-[11px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary w-[100px] shrink-0"
                            >
                              <option value="name">Name</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                              <option value="businessName">Company</option>
                              <option value="tags">Tags</option>
                              <option value="createdAt">Created</option>
                            </select>
                            <select
                              value={f.operator}
                              onChange={e => setFilters(prev => prev.map((x, idx) => idx === i ? {...x, operator: e.target.value} : x))}
                              className="bg-surface-hover border border-border text-text-main text-[11px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary w-[96px] shrink-0"
                            >
                              <option value="contains">Contains</option>
                              <option value="equals">Equals</option>
                              <option value="starts_with">Starts with</option>
                              <option value="not_empty">Not empty</option>
                            </select>
                            {f.operator !== 'not_empty' && (
                              <input
                                type="text"
                                placeholder="Value…"
                                value={f.value}
                                onChange={e => setFilters(prev => prev.map((x, idx) => idx === i ? {...x, value: e.target.value} : x))}
                                className="flex-1 bg-surface-hover border border-border text-text-main text-[11px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary min-w-0 placeholder:text-text-muted"
                              />
                            )}
                            <button
                              onClick={() => setFilters(prev => prev.filter((_, idx) => idx !== i))}
                              className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setFilters(prev => [...prev, { id: Date.now().toString(), field: 'name', operator: 'contains', value: '' }])}
                        className="w-full py-2 border-2 border-dashed border-border rounded-lg text-[12px] font-semibold text-primary hover:bg-primary/5 flex items-center justify-center gap-2 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add condition
                      </button>
                    </div>

                    {/* ── Save Smart List ── */}
                    <div className="pt-4 border-t border-border mt-4">
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Save as Smart List</p>
                      <p className="text-[11px] text-text-muted mb-2">Give this list a name. If named after an existing tag, it will automatically capture all matching contacts.</p>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          placeholder="Smart List Name (e.g. Lead Studio, VIP)..." 
                          value={smartListNameInput} 
                          onChange={e => setSmartListNameInput(e.target.value)} 
                          className="flex-1 bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-3 py-2 outline-none focus:border-primary placeholder:text-text-muted" 
                        />
                        <button 
                          disabled={createSmartList.isPending || !smartListNameInput.trim()}
                          onClick={() => {
                            if (!smartListNameInput.trim()) return;
                            createSmartList.mutate({
                              name: smartListNameInput.trim(),
                              filters: filters.length > 0 ? { matchMode: filterMatchMode, rules: filters } : undefined,
                              viewConfig: { columns: Array.from(visibleCols) },
                            });
                          }}
                          className="bg-primary text-white px-3 py-2 rounded-[6px] text-[12px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {createSmartList.isPending ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>

                  </div>
                )}
                {panelOpen === 'manage' && (
                  <div className="space-y-4">
                    {ALL_COLUMNS.map(col => (
                      <div 
                        key={col} 
                        onClick={() => {
                          const newCols = new Set(visibleCols);
                          if (newCols.has(col)) newCols.delete(col);
                          else newCols.add(col);
                          setVisibleCols(newCols);
                        }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-[6px] transition-colors border cursor-pointer ${visibleCols.has(col) ? 'bg-surface-hover border-border' : 'border-transparent hover:bg-surface-hover/50 hover:border-border/50'}`}
                      >
                        <CheckSquare className={`w-4 h-4 ${visibleCols.has(col) ? 'text-primary' : 'text-text-muted/30'}`} />
                        <span className={`text-[13px] font-medium ${visibleCols.has(col) ? 'text-text-main' : 'text-text-muted'}`}>{col}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-border flex justify-end gap-3 bg-surface-hover/50 shrink-0">
                <button onClick={() => { setPanelOpen(null); setContactError(null); }} className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover transition-colors">Cancel</button>
                <button 
                  onClick={async () => {
                  if (panelOpen === 'bulk_tags' && selected.size > 0 && bulkTagInput.trim()) {
                    setContactError(null);
                    try {
                      await bulkAction.mutateAsync({ action: 'tag', contactIds: Array.from(selected), payload: { tag: bulkTagInput.trim() } });
                      setBulkTagInput('');
                    } catch {
                      setContactError('Failed to add tags.');
                    }
                  } else {
                    if (panelOpen === 'filter') setPage(1);
                    setPanelOpen(null);
                  }
                  }}
                  className="btn-primary disabled:opacity-40"
                >
                  {panelOpen === 'filter' ? 'Apply' : panelOpen === 'bulk_tags' ? (bulkAction.isPending ? 'Applying...' : 'Apply Tags') : 'Save'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <NewContactSlideOver 
        isOpen={panelOpen === 'new_contact'}
        onClose={() => { setPanelOpen(null); setContactError(null); }}
        newContact={newContact}
        setNewContact={setNewContact}
        newContactTagInput={newContactTagInput}
        setNewContactTagInput={setNewContactTagInput}
        isPending={createContact.isPending}
        error={contactError}
        onSubmit={async () => {
          if (!(newContact.firstName || newContact.email)) {
            setContactError('Please enter at least a first name or email.');
            return;
          }
          setContactError(null);
          try {
            const contactData = {
              firstName: (newContact.firstName || '').trim() || (newContact.email ? newContact.email.split('@')[0] : 'Unknown'),
              lastName: (newContact.lastName || '').trim() || undefined,
              email: (newContact.email || '').trim() || undefined,
              phone: (newContact.phone || '').trim() || undefined,
              businessName: (newContact.businessName || '').trim() || undefined,
              title: (newContact.title || '').trim() || undefined,
              status: newContact.leadStatus || newContact.lifecycleStage || newContact.status || 'Lead',
              about: (newContact.about || '').trim() || undefined,
              source: newContact.source || undefined,
              color: newContact.color || '#7dd3fc',
              tagsJson: JSON.stringify(newContact.tags || []),
            };
            const created = await createContact.mutateAsync(contactData);
            
            if (newContact.notes?.trim()) {
              await apiFetch('/api/crm/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contactId: created.id,
                  type: 'note',
                  title: 'Initial Note',
                  notes: newContact.notes
                })
              }).catch(() => {});
            }

            setNewContact({ firstName: '', lastName: '', email: '', phone: '', businessName: '', title: '', status: 'Lead', about: '', source: '', color: '#7dd3fc', tags: [], notes: '' });
            setNewContactTagInput('');
            setPanelOpen(null);
            toast('success', 'Contact Saved', `${contactData.firstName} added to CRM.`);
          } catch (err: any) {
            setContactError(err.message || 'Something went wrong. Please try again.');
          }
        }}
      />

      {/* ── Delete Confirmation Dialog (P0) ── */}
      {deleteConfirmOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-[2px]"
            onClick={() => setDeleteConfirmOpen(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] bg-surface border border-border rounded-xl shadow-luxury p-6 animate-scale-in">
            <h3 className="text-[16px] font-bold text-text-main mb-2">
              Delete {selected.size} {selected.size === 1 ? 'contact' : 'contacts'}?
            </h3>
            <p className="text-[13px] text-text-muted mb-6 leading-relaxed">
              This cannot be undone. {selected.size === 1 ? 'This contact' : 'These contacts'} will be permanently removed from your workspace.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-[9px] text-[13.5px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete {selected.size === 1 ? 'contact' : `${selected.size} contacts`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Import Contacts Modal with Tagging ── */}
      <ImportContactsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
