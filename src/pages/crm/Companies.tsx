import { useState } from 'react';
import { 
  Search, Filter, List as ListIcon, Plus, Download, MoreVertical, 
  Settings, ChevronDown, Check, Edit2, Trash2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ConfirmDelete } from '../../components/ui/ConfirmDelete';

interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string;
  employees: string;
  location: string;
  description: string;
}

export default function Companies() {
  const qc = useQueryClient();
  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => fetch('/api/crm/companies').then(r => r.ok ? r.json() : []),
  });

  const createCompany = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch('/api/crm/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/crm/companies/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // Smart Lists state
  const [smartLists, setSmartLists] = useState<{id: string, name: string}[]>([{ id: 'all', name: 'All' }]);
  const [activeList, setActiveList] = useState('all');
  
  // Panel States
  const [panelOpen, setPanelOpen] = useState<'filter' | 'smartlist' | 'new_company' | null>(null);

  // Form States
  const [newSmartListName, setNewSmartListName] = useState('');
  const [newCompany, setNewCompany] = useState({ name: '', domain: '', industry: '', employees: '', location: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === companies.length) setSelected(new Set());
    else setSelected(new Set(companies.map(c => c.id)));
  };


  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full relative bg-bg">
        <div className="px-8 flex items-center justify-between border-b border-border bg-surface h-[73px]">
          <div className="flex items-center gap-2">
            <div className="skeleton h-7 w-16 rounded-full" />
            <div className="skeleton h-7 w-24 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton h-7 w-40 rounded-full" />
            <div className="skeleton h-7 w-20 rounded-lg" />
            <div className="skeleton h-8 w-32 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 border border-border/50 shadow-luxury">
          <table className="w-full text-left">
            <thead className="border-b border-border/50 bg-surface/80">
              <tr>
                {[48, 160, 120, 140, 200, 100, 120, 80].map((w, i) => (
                  <th key={i} className="p-3"><div className="skeleton h-3 rounded" style={{ width: w }} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-3"><div className="skeleton w-4 h-4 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-36 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-28 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-5 w-20 rounded-full" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-48 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-16 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-24 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-6 w-12 rounded-lg mx-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      {/* Header section removed */}

      {/* Unified Toolbar */}
      <div className="px-8 flex items-center justify-between border-b border-border bg-surface relative shadow-[0_4px_16px_rgba(0,0,0,0.03)] h-[73px]">
        <div className="flex items-center gap-2">
          {smartLists.map(list => (
            <div 
              key={list.id}
              onClick={() => setActiveList(list.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full cursor-pointer shadow-sm border transition-colors ${
                activeList === list.id ? 'text-text-main bg-bg border-border font-bold' : 'text-text-muted hover:text-text-main hover:bg-surface-hover border-transparent'
              }`}
            >
              {list.id === 'all' && <ListIcon className="w-4 h-4 text-primary" />}
              <span className="text-[13px]">{list.name}</span>
            </div>
          ))}
          <button onClick={() => setPanelOpen('smartlist')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors border border-transparent mr-2">
            <Plus className="w-4 h-4" />
            <span className="text-[13px] font-medium">Add smart list</span>
          </button>
          <div className="w-[1px] h-5 bg-border mx-2"></div>
          <button onClick={() => setPanelOpen('filter')} className="flex items-center gap-2 px-4 py-1.5 border border-border bg-surface-hover rounded-full text-[13px] font-medium text-text-main transition-colors shadow-sm ml-1">
            <Filter className="w-3.5 h-3.5" /> Advanced filters
          </button>
          <button className="flex items-center gap-2 px-4 py-1.5 border border-border bg-surface-hover rounded-full text-[13px] font-medium text-text-main transition-colors shadow-sm">
            <ChevronDown className="w-3.5 h-3.5" /> Sort
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search Companies" 
              className="pl-9 pr-4 py-1.5 w-[200px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
          
          <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-[13px] font-medium text-text-muted hover:text-text-main transition-colors shadow-sm bg-surface">
            <Download className="w-4 h-4" /> Import
          </button>
          
          <button onClick={() => setPanelOpen('new_company')} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Account
          </button>

          <div className="w-[1px] h-5 bg-border mx-1"></div>

          <div className="relative flex items-center gap-2">
            <button className="flex items-center gap-2 text-[13px] px-3 py-1.5 font-medium text-text-muted hover:text-text-main transition-colors border border-border rounded-lg bg-surface shadow-sm">
              <Settings className="w-4 h-4" /> Manage fields
            </button>
            <div className="relative">
              <button className="flex items-center justify-center p-1.5 text-text-muted hover:text-text-main rounded-lg transition-colors border border-border bg-surface shadow-sm">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
            <tr>
              <th className="w-12 p-3 text-center">
                <button onClick={toggleAll} className="w-4 h-4 border border-border rounded flex items-center justify-center transition-colors bg-bg hover:border-primary text-primary">
                  {selected.size === companies.length && companies.length > 0 ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                </button>
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                <div className="flex items-center justify-between">Account <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                <div className="flex items-center justify-between">Domain <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                <div className="flex items-center justify-between">Industry <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">Description</th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">No. of Employees</th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">Headquarters</th>
              <th className="w-20 p-3 text-[13px] font-semibold whitespace-nowrap text-center text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((a) => (
              <tr key={a.id} className={`border-b border-border/50 transition-colors ${selected.has(a.id) ? 'bg-primary/5' : 'hover:bg-surface-hover/50'}`}>
                <td className="p-3 text-center">
                  <button onClick={() => toggleSelect(a.id)} className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${selected.has(a.id) ? 'bg-primary border-primary text-bg' : 'border-border bg-bg hover:border-primary text-transparent'}`}>
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </button>
                </td>
                <td className="p-3">
                  <Link to={`/crm/companies/${a.id}`} className="text-[13px] font-semibold text-text-main hover:text-primary transition-colors cursor-pointer">{a.name}</Link>
                </td>
                <td className="p-3">
                  <a href={a.domain} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-primary hover:underline">{a.domain}</a>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(a.industry||'').split(',').map((ind, i) => ind.trim() ? (
                      <span key={i} className="px-2 py-0.5 bg-surface-hover border border-border text-text-muted rounded text-[11px] font-medium whitespace-nowrap">
                        {ind.trim()}
                      </span>
                    ) : null)}
                  </div>
                </td>
                <td className="p-3 text-[13px] font-medium text-text-muted max-w-[200px] truncate">{a.description}</td>
                <td className="p-3 text-[13px] font-medium text-text-main">{a.employees}</td>
                <td className="p-3 text-[13px] font-medium text-text-main">{a.location}</td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                     <button className="text-text-muted hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                     <button onClick={() => setDeleteTarget({ id: a.id, name: a.name })} className="text-text-muted hover:text-accent-red transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Footer Paginator */}
      <div className="px-8 py-4 border-t border-border bg-surface flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0">
        <div className="font-semibold text-text-muted flex items-center gap-3">
          Page 1 of 1
          <div className="w-[1px] h-4 bg-border"></div>
          <span className="px-2.5 py-0.5 rounded-lg text-[13px] font-medium bg-bg text-text-main shadow-sm border border-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/60"></span>
            {companies.length} Accounts
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
                  {panelOpen === 'filter' ? 'Advanced Filters' : panelOpen === 'new_company' ? 'Add Account' : 'Save Smart List'}
                </h2>
                <button onClick={() => setPanelOpen(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-auto bg-surface">
                {panelOpen === 'new_company' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Account Name</label>
                      <input type="text" placeholder="e.g. Acme Corp" value={newCompany.name} onChange={(e) => setNewCompany({...newCompany, name: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Domain</label>
                      <input type="text" placeholder="https://acme.com" value={newCompany.domain} onChange={(e) => setNewCompany({...newCompany, domain: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Industry</label>
                      <input type="text" placeholder="e.g. Software, Data" value={newCompany.industry} onChange={(e) => setNewCompany({...newCompany, industry: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Headquarters</label>
                      <input type="text" placeholder="New York, NY" value={newCompany.location} onChange={(e) => setNewCompany({...newCompany, location: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Employees</label>
                      <input type="text" placeholder="100-500" value={newCompany.employees} onChange={(e) => setNewCompany({...newCompany, employees: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                )}
                {panelOpen === 'filter' && (
                  <div className="space-y-6">
                    <p className="text-[13px] text-text-muted">No filters applied. Add a filter to narrow down your accounts.</p>
                    <button className="w-full py-2.5 border-2 border-dashed border-border rounded-[8px] text-[13px] font-semibold text-primary hover:bg-surface-hover transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Add new filter
                    </button>
                  </div>
                )}
                {panelOpen === 'smartlist' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">List Name</label>
                      <input type="text" placeholder="e.g. Target Accounts" value={newSmartListName} onChange={(e) => setNewSmartListName(e.target.value)} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[14px] text-text-main focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-border flex justify-end gap-3 bg-surface-hover/50 shrink-0">
                <button onClick={() => setPanelOpen(null)} className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover transition-colors">Cancel</button>
                <button 
                  onClick={async () => {
                    if (panelOpen === 'smartlist' && newSmartListName) {
                      setSmartLists([...smartLists, { id: newSmartListName.toLowerCase().replace(/\s+/g, '-'), name: newSmartListName }]);
                      setNewSmartListName('');
                      setPanelOpen(null);
                    } else if (panelOpen === 'new_company' && newCompany.name) {
                      await createCompany.mutateAsync({
                        name: newCompany.name,
                        domain: newCompany.domain || '',
                        industry: newCompany.industry || '',
                        employees: newCompany.employees || '',
                        location: newCompany.location || '',
                        description: newCompany.description || ''
                      });
                      setNewCompany({ name: '', domain: '', industry: '', employees: '', location: '', description: '' });
                      setPanelOpen(null);
                    } else {
                      setPanelOpen(null);
                    }
                  }}
                  style={{ backgroundColor: 'var(--primary)' }} className="px-5 py-2 text-white rounded-[6px] text-[13px] font-semibold font-medium">
                  {panelOpen === 'filter' ? 'Apply' : panelOpen === 'new_company' ? 'Add Account' : 'Save'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDelete
            isOpen={true}
            title={deleteTarget.name}
            onConfirm={() => {
              deleteCompanyMutation.mutate(deleteTarget.id);
              if (selected.has(deleteTarget.id)) toggleSelect(deleteTarget.id);
              setDeleteTarget(null);
            }}
            onClose={() => setDeleteTarget(null)}
            isLoading={deleteCompanyMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
