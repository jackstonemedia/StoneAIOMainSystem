import React, { useState } from 'react'; 
import { 
  Search, Filter, List as ListIcon, Plus, Download, MoreVertical, 
  Settings, Phone, Mail, ChevronDown, Check,
  User, CheckSquare, X, Table2, LayoutGrid, Columns, Eye, EyeOff, Map as MapIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSmartListStore } from '../../store/useSmartListStore';
import { useToast } from '../../components/ui/Toast';

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

type ViewMode = 'table' | 'card' | 'kanban' | 'map';

const ALL_COLUMNS = ['Contact name', 'Phone', 'Email', 'Business name', 'Created (EDT)', 'Last activity (EDT)', 'Tags'];

export default function Contacts() {
  const { lists } = useSmartListStore();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: apiContacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: () => fetch('/api/crm/contacts').then(r => r.ok ? r.json().then(data => data.contacts || []) : []),
  });

  const createContact = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; phone: string; businessName: string; title: string; status: string; about: string; source: string; color: string }) => {
      const r = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const bulkAction = useMutation({
    mutationFn: async ({ action, contactIds, payload }: { action: string; contactIds: string[]; payload?: any }) => {
      const res = await fetch('/api/crm/contacts/bulk', {
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

  const handleBulkDelete = () => {
    selected.forEach(id => deleteContact.mutate(id));
    toast('success', 'Contacts Deleted', `Successfully removed ${selected.size} contacts.`);
    setSelected(new Set());
  };

  const [contactError, setContactError] = useState<string | null>(null);


  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  const [activeListId, setActiveListId] = useState<string>('all');
  const [filters, setFilters] = useState<{id: string; field: string; operator: string; value: string}[]>([]);
  const [filterMatchMode, setFilterMatchMode] = useState<'all' | 'any'>('all');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(ALL_COLUMNS));
  const [sortConfig, setSortConfig] = useState<{ field: keyof Contact, direction: 'asc' | 'desc' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Panel states
  const [panelOpen, setPanelOpen] = useState<'filter' | 'manage' | 'new_contact' | 'duplicates' | 'bulk_tags' | null>(null);
  const [addContactDropdownOpen, setAddContactDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [advancedContactOptionsOpen, setAdvancedContactOptionsOpen] = useState(false);

  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', phone: '', businessName: '', title: '', status: 'Lead', about: '', source: '', color: '#7dd3fc' });
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [smartListNameInput, setSmartListNameInput] = useState('');

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
  const activeList = lists.find(l => l.id === activeListId);
  const baseContacts: Contact[] = activeListId === 'all'
    ? apiContacts
    : (activeList?.contacts ?? []) as Contact[];

  // Computations
  const processedContacts = React.useMemo(() => {
    let result = [...baseContacts];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        (c.name || '').toLowerCase().includes(q) || 
        (c.email || '').toLowerCase().includes(q) || 
        (c.phone || '').toLowerCase().includes(q)
      );
    }

    if (filters.length > 0) {
      result = result.filter(c => {
        const check = (f: typeof filters[0]) => {
          let fieldVal = '';
          if (f.field === 'name') fieldVal = c.name || '';
          else if (f.field === 'email') fieldVal = c.email || '';
          else if (f.field === 'phone') fieldVal = c.phone || '';
          else if (f.field === 'businessName') fieldVal = c.businessName || '';
          else if (f.field === 'tags') fieldVal = (c.tags || []).join(', ');
          else if (f.field === 'createdAt') fieldVal = new Date(c.createdAt).toLocaleString();
          fieldVal = String(fieldVal).toLowerCase();
          const q = f.value.toLowerCase();
          if (f.operator === 'contains')    return fieldVal.includes(q);
          if (f.operator === 'equals')      return fieldVal === q;
          if (f.operator === 'not_empty')   return fieldVal !== '';
          if (f.operator === 'starts_with') return fieldVal.startsWith(q);
          return true;
        };
        const results = filters.map(check);
        return filterMatchMode === 'all' ? results.every(Boolean) : results.some(Boolean);
      });
    }

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
  }, [baseContacts, searchQuery, filters, filterMatchMode, sortConfig]);

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

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const rows = text.split('\n').filter(r => r.trim().length > 0);
      if (rows.length < 2) { toast('warning', 'Invalid CSV', 'No data rows found'); return; };
      
      const headers = rows[0].split(',').map(h => h.replace(/"/g, '').toLowerCase().trim());
      let imported = 0;
      
      for (let i = 1; i < rows.length; i++) {
        const rowData = rows[i].split(',').map(cell => cell.replace(/"/g, '').trim());
        const mapped: any = { firstName: 'Unknown', lastName: '', email: '', phone: '' };
        
        headers.forEach((h, idx) => {
          const val = rowData[idx] || '';
          if (h.includes('name') && !h.includes('business') && !h.includes('company')) {
            const parts = val.split(' ');
            mapped.firstName = parts[0] || 'Unknown';
            mapped.lastName = parts.slice(1).join(' ');
          }
          if (h.includes('email')) mapped.email = val;
          if (h.includes('phone')) mapped.phone = val;
        });
        
        if (mapped.email || mapped.phone || mapped.firstName !== 'Unknown') {
          // Mutate sequentially to avoid overwhelming rate limits/mock server
          await createContact.mutateAsync(mapped).catch(() => {});
          imported++;
        }
      }
      toast('success', 'Import Complete', `Successfully imported ${imported} contacts`);
      qc.invalidateQueries({ queryKey: ['contacts'] });
    };
    reader.readAsText(file);
    e.target.value = '';
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
      <div className="flex-1 flex items-center justify-center bg-bg h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
          <div className="text-text-muted font-medium text-sm animate-pulse">Loading contacts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      {/* Header section */}
      <div className="px-8 flex items-center justify-between bg-surface z-10 sticky top-0 shadow-sm relative border-b border-border h-[68px]">
        <div className="flex items-center gap-4">
          <h1 className="text-[20px] font-bold text-text-main">
            {activeListId === 'all' ? 'Contacts' : (activeList?.name ?? 'Contacts')}
          </h1>
          <span className="px-2.5 py-0.5 rounded-[4px] text-[13px] font-medium bg-bg text-text-main shadow-sm border border-border">
            {processedContacts.length} {activeListId === 'all' ? 'Contacts' : 'Members'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleImportCSV} />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[4px] text-[14px] font-medium text-text-muted hover:text-text-main transition-colors shadow-sm bg-surface">
            <Download className="w-4 h-4" /> Import
          </button>
          
          <div className="relative">
            <div className="flex items-center gap-2 relative">
              <button 
                onClick={() => setPanelOpen('new_contact')} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-[4px] border border-border text-[14px] font-medium text-text-muted hover:text-text-main transition-colors active:scale-95 shadow-sm bg-surface"
              >
                <Plus className="w-4 h-4" /> Add Contact
              </button>
              <button 
                onClick={() => setAddContactDropdownOpen(!addContactDropdownOpen)}
                className="px-2 py-1.5 border border-border rounded-[4px] text-text-muted hover:text-text-main transition-colors flex items-center justify-center bg-surface active:scale-95 shadow-sm"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            
            <AnimatePresence>
              {addContactDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAddContactDropdownOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 top-[calc(100%+8px)] w-[240px] bg-surface border border-border/50 shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5"
                  >
                    <div className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">More Customizations</div>
                    <button onClick={() => { setAddContactDropdownOpen(false); setPanelOpen('new_contact'); }} className="w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                      <User className="w-4 h-4 shrink-0" /> Open Full Contact Form
                    </button>
                    <button onClick={() => { setAddContactDropdownOpen(false); fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                      <ListIcon className="w-4 h-4 shrink-0" /> Import via CSV Array
                    </button>
                    <button onClick={() => { setAddContactDropdownOpen(false); setPanelOpen('duplicates'); }} className="w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                      <Search className="w-4 h-4 shrink-0" /> Find Duplicates
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button onClick={() => setPanelOpen(panelOpen === 'manage' ? null : 'manage')} className="flex items-center justify-center p-1.5 text-text-muted hover:text-text-main rounded-[4px] transition-colors border border-border bg-surface shadow-sm">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Unified Toolbar OR Bulk Actions Context Bar */}
      <div className="px-8 flex items-center justify-between border-b border-border bg-surface relative shadow-[0_4px_24px_rgba(0,0,0,0.12)] h-[73px]">
        <AnimatePresence mode="wait">
          {selected.size > 0 ? (
            <motion.div 
              key="bulk-toolbar"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between w-full"
            >
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
            </motion.div>
          ) : (
            <motion.div 
              key="standard-toolbar"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                {/* All tab */}
                <div 
                  onClick={() => setActiveListId('all')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full cursor-pointer shadow-sm border transition-colors ${
                    activeListId === 'all' ? 'text-text-main bg-bg border-border font-bold' : 'text-text-muted hover:text-text-main hover:bg-surface-hover border-transparent'
                  }`}
                >
                  <ListIcon className="w-4 h-4 text-primary" />
                  <span className="text-[13px]">All</span>
                </div>

                {/* Smart list tabs from Zustand store */}
                {lists.map(list => (
                  <div 
                    key={list.id}
                    onClick={() => setActiveListId(list.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full cursor-pointer shadow-sm border transition-colors ${
                      activeListId === list.id ? 'text-text-main bg-bg border-border font-bold' : 'text-text-muted hover:text-text-main hover:bg-surface-hover border-transparent'
                    }`}
                  >
                    <span className="text-[13px]">{list.name}</span>
                  </div>
                ))}

                <div className="w-[1px] h-5 bg-border mx-2"></div>
                <button onClick={() => setPanelOpen('filter')} className="flex items-center gap-2 px-4 py-1.5 border border-border bg-surface-hover rounded-full text-[13px] font-medium text-text-main transition-colors shadow-sm ml-1 card-hover-lift">
                  <Filter className="w-3.5 h-3.5" /> Advanced filters
                </button>
                <div className="relative">
                  <button onClick={() => setSortDropdownOpen(!sortDropdownOpen)} className="flex items-center gap-2 px-4 py-1.5 border border-border bg-surface-hover rounded-full text-[13px] font-medium text-text-main transition-colors shadow-sm card-hover-lift">
                    <ChevronDown className="w-3.5 h-3.5" /> Sort
                  </button>
                  <AnimatePresence>
                    {sortDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setSortDropdownOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 mt-2 w-[180px] bg-surface border border-border/50 shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5"
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
              <div className="flex items-center gap-5">
                <div className="relative shadow-sm rounded-full flex items-center">
                  <Search className="w-4 h-4 absolute left-3 text-text-muted" />
                  <input 
                    type="text" 
                    placeholder="Search Contacts" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 w-[280px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
                  />
                </div>
                <button onClick={() => setPanelOpen('manage')} className="flex items-center gap-2 text-[13px] font-medium text-text-muted hover:text-text-main transition-colors">
                  <Settings className="w-4 h-4" /> Manage fields
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content Rendering */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 relative">
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
              <tr key={c.id} className={`border-b border-border/50 transition-colors ${selected.has(c.id) ? 'bg-primary/5' : 'hover:bg-surface-hover/50'}`}>
                <td className="p-3 text-center">
                  <button onClick={() => toggleSelect(c.id)} className="w-4 h-4 border border-border bg-bg rounded flex items-center justify-center transition-colors hover:border-primary text-primary">
                    {selected.has(c.id) ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                  </button>
                </td>
                {visibleCols.has('Contact name') && (
                  <td className="p-3">
                    <Link to={`/crm/contacts/${c.id}`} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-bg shadow-sm" style={{ backgroundColor: c.color }}>
                        {(c.name || '').includes('(Example)') ? (c.name || '').replace('(Example) ', '').charAt(0) : (c.name || '').substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[13px] font-semibold transition-colors hover:text-primary text-text-main truncate">{c.name || 'Unknown'}</span>
                    </Link>
                  </td>
                )}
                {visibleCols.has('Phone') && (
                  <td className="p-3">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-text-main">
                      {c.phone ? <><Phone className="w-3.5 h-3.5 text-text-muted" /> {c.phone}</> : null}
                    </div>
                  </td>
                )}
                {visibleCols.has('Email') && (
                  <td className="p-3">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-text-main">
                      {c.email ? <><Mail className="w-3.5 h-3.5 text-text-muted" /> <span className="truncate max-w-[150px]">{c.email}</span></> : null}
                    </div>
                  </td>
                )}
                {visibleCols.has('Business name') && (
                  <td className="p-3 text-[13px] font-medium truncate max-w-[150px] text-text-main">{c.businessName}</td>
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
                        <span key={tag} className="px-2 py-0.5 rounded-[4px] text-[11px] font-semibold whitespace-nowrap shadow-sm border border-border bg-bg text-text-muted">{tag}</span>
                      ))}
                      {(c.tags || []).length > 1 && (
                        <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-semibold shadow-sm border border-border bg-bg text-text-muted">+{(c.tags || []).length - 1}</span>
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

      {/* Slide-over Panels */}
      <AnimatePresence>
        {panelOpen && (
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
                  {panelOpen === 'filter' ? 'Advanced Filters' : panelOpen === 'manage' ? 'Manage Columns' : panelOpen === 'new_contact' ? 'Add Contact' : panelOpen === 'duplicates' ? 'Merge Duplicates' : panelOpen === 'bulk_tags' ? 'Add Tags to Selected' : 'Create Smart List'}
                </h2>
                <button onClick={() => setPanelOpen(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-auto bg-surface">
                {panelOpen === 'new_contact' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">First Name <span className="text-red-400">*</span></label>
                        <input type="text" placeholder="John" value={newContact.firstName} onChange={(e) => setNewContact({...newContact, firstName: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-colors" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Last Name</label>
                        <input type="text" placeholder="Doe" value={newContact.lastName} onChange={(e) => setNewContact({...newContact, lastName: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Email Address</label>
                      <input type="email" placeholder="john@example.com" value={newContact.email} onChange={(e) => setNewContact({...newContact, email: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-colors" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Phone Number</label>
                      <input type="tel" placeholder="+1 555-0000" value={newContact.phone} onChange={(e) => setNewContact({...newContact, phone: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-colors" />
                    </div>
                    
                    <div className="h-[1px] bg-border/50 my-4"></div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Company</label>
                        <input type="text" placeholder="Apple Inc." value={newContact.businessName} onChange={(e) => setNewContact({...newContact, businessName: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-colors" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Job Title</label>
                        <input type="text" placeholder="CEO" value={newContact.title} onChange={(e) => setNewContact({...newContact, title: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-colors" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Contact Status</label>
                      <select value={newContact.status} onChange={(e) => setNewContact({...newContact, status: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-colors">
                        <option value="Lead">Lead</option>
                        <option value="Active">Active Customer</option>
                        <option value="Churned">Churned</option>
                        <option value="Partner">Partner</option>
                      </select>
                    </div>

                    <div className="border border-border rounded-[6px] overflow-hidden mt-4">
                      <button 
                        onClick={() => setAdvancedContactOptionsOpen(!advancedContactOptionsOpen)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-hover/50 hover:bg-surface-hover transition-colors text-[13px] font-semibold text-text-main"
                      >
                        Advanced Details
                        <ChevronDown className={`w-4 h-4 transition-transform ${advancedContactOptionsOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {advancedContactOptionsOpen && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }} 
                            animate={{ height: 'auto', opacity: 1 }} 
                            exit={{ height: 0, opacity: 0 }} 
                            className="px-4 py-4 border-t border-border bg-surface-hover/20 space-y-4"
                          >
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">About (Bio/Notes)</label>
                              <textarea 
                                placeholder="Any additional notes..." 
                                value={newContact.about} 
                                onChange={(e) => setNewContact({...newContact, about: e.target.value})} 
                                className="w-full px-3 py-2 bg-surface border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-colors min-h-[60px]"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Source</label>
                                <input type="text" placeholder="e.g. LinkedIn, Referral" value={newContact.source} onChange={(e) => setNewContact({...newContact, source: e.target.value})} className="w-full px-3 py-2 bg-surface border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-colors" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Profile Color</label>
                                <div className="flex gap-2">
                                  {['#7dd3fc', '#fca5a5', '#bef264', '#fcd34d', '#c4b5fd', '#f472b6'].map(c => (
                                    <button 
                                      key={c}
                                      onClick={() => setNewContact({...newContact, color: c})}
                                      className={`w-6 h-6 rounded-full border-2 transition-transform ${newContact.color === c ? 'border-text-main scale-110' : 'border-transparent hover:scale-110'}`}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {activeListId !== 'all' && (
                      <p className="text-[12px] text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 mt-2">
                        Contact will be added to "<strong>{activeList?.name}</strong>", not the main list.
                      </p>
                    )}
                    {contactError && (
                      <p className="text-[12px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                        {contactError}
                      </p>
                    )}
                  </div>
                )}
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
                    {filters.length > 0 && (
                      <div className="pt-4 border-t border-border mt-4">
                        <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Save as Smart List</p>
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="Smart List Name..." value={smartListNameInput} onChange={e => setSmartListNameInput(e.target.value)} className="flex-1 bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-3 py-2 outline-none focus:border-primary placeholder:text-text-muted" />
                          <button 
                            onClick={() => {
                              if (!smartListNameInput.trim()) return;
                              useSmartListStore.getState().createList({
                                name: smartListNameInput.trim(),
                                contacts: processedContacts,
                                filters,
                                matchMode: filterMatchMode,
                                viewMode: 'table',
                                columns: Array.from(visibleCols),
                                author: 'Current User'
                              });
                              setSmartListNameInput('');
                              toast('success', 'Smart List Created!');
                            }}
                            className="bg-primary text-white px-3 py-2 rounded-[6px] text-[12px] font-semibold hover:opacity-90 transition-opacity"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}

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
                  disabled={createContact.isPending}
                  onClick={async () => {
                  if (panelOpen === 'bulk_tags' && selected.size > 0 && bulkTagInput.trim()) {
                    setContactError(null);
                    try {
                      await bulkAction.mutateAsync({ action: 'tag', contactIds: Array.from(selected), payload: { tag: bulkTagInput.trim() } });
                      setBulkTagInput('');
                    } catch {
                      setContactError('Failed to add tags.');
                    }
                  } else if (panelOpen === 'new_contact' && (newContact.firstName || newContact.email)) {
                    setContactError(null);
                    try {
                      await createContact.mutateAsync({
                        firstName: newContact.firstName || (newContact.email ? newContact.email.split('@')[0] : 'Unknown'),
                        lastName: newContact.lastName,
                        email: newContact.email || '',
                        phone: newContact.phone,
                        businessName: newContact.businessName,
                        title: newContact.title,
                        status: newContact.status,
                        about: newContact.about,
                        source: newContact.source,
                        color: newContact.color,
                      });
                      setNewContact({ firstName: '', lastName: '', email: '', phone: '', businessName: '', title: '', status: 'Lead', about: '', source: '', color: '#7dd3fc' });
                      setPanelOpen(null);
                    } catch {
                      setContactError('Something went wrong. Please try again.');
                    }
                  } else if (panelOpen === 'new_contact') {
                    setContactError('Please enter at least a first name or email.');
                  } else {
                    setPanelOpen(null);
                  }
                  }}
                  style={{ backgroundColor: 'var(--primary)' }} 
                  className="px-5 py-2 text-white rounded-[6px] text-[13px] font-semibold font-medium disabled:opacity-40"
                >
                  {panelOpen === 'filter' ? 'Apply' : panelOpen === 'new_contact' ? (createContact.isPending ? 'Adding...' : 'Add Contact') : panelOpen === 'bulk_tags' ? (bulkAction.isPending ? 'Applying...' : 'Apply Tags') : 'Save'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
