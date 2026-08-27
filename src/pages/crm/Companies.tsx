import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Plus, Download,
  Settings, ChevronDown, Check, Edit2, Trash2, X,
  Building2, Globe, MapPin, Users, DollarSign, CheckSquare, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDelete } from '../../components/ui/ConfirmDelete';
import { apiFetch } from '../../lib/apiClient';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import { SlideOverPanel } from '../../components/ui/SlideOverPanel';
import { useToast } from '../../components/ui/Toast';

interface Company {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  employees?: string;
  location?: string;
  description?: string;
  revenue?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

const ALL_COLUMNS = ['Account Name', 'Website / Domain', 'Industry', 'Headquarters', 'Employees', 'Revenue', 'Description'];

export default function Companies() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(ALL_COLUMNS));
  const [activeTab, setActiveTab] = useState('all');

  // Slide-over panel state
  const [panelOpen, setPanelOpen] = useState<'filter' | 'manage' | 'new_company' | 'smartlist' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Sorting & Filtering
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ field: keyof Company; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [filterMatchMode, setFilterMatchMode] = useState<'all' | 'any'>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pageSizeDropdownOpen, setPageSizeDropdownOpen] = useState(false);

  // Custom Industries state
  const [customIndustries, setCustomIndustries] = useState<string[]>([
    'SaaS', 'E-commerce', 'Healthcare', 'Finance', 'Education', 'Real Estate',
    'Manufacturing', 'Consulting', 'Media & Entertainment', 'Retail', 'Logistics',
    'Legal', 'Cybersecurity', 'AI & Data', 'Other'
  ]);
  const [newIndustryInput, setNewIndustryInput] = useState('');
  const [showNewIndustryInput, setShowNewIndustryInput] = useState(false);

  // Form State
  const [newCompany, setNewCompany] = useState({
    name: '',
    website: '',
    industry: '',
    employees: '',
    location: '',
    description: '',
    revenue: '',
    logoUrl: ''
  });

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => apiFetch('/api/crm/companies').then(r => (r.ok ? r.json() : []))
  });

  const createCompany = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiFetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!r.ok) {
        const text = await r.text();
        let msg = 'Failed to create company';
        try { msg = JSON.parse(text).error || msg; } catch {}
        throw new Error(msg);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      setNewCompany({ name: '', website: '', industry: '', employees: '', location: '', description: '', revenue: '', logoUrl: '' });
      setPanelOpen(null);
      toast('success', 'Account created successfully');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to create company')
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/crm/companies/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete account');
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      toast('success', 'Account removed');
    }
  });

  // Filter & Sort Logic
  const processedCompanies = useMemo(() => {
    let result = [...companies];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => {
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.industry || '').toLowerCase().includes(q) ||
          (c.location || '').toLowerCase().includes(q) ||
          (c.website || '').toLowerCase().includes(q)
        );
      });
    }

    // Custom multi-rule filters
    if (filters.length > 0) {
      result = result.filter(c => {
        const matches = filters.map(f => {
          if (!f.value && f.operator !== 'not_empty') return true;
          const val = String((c as any)[f.field] || '').toLowerCase();
          const target = f.value.toLowerCase().trim();
          if (f.operator === 'contains') return val.includes(target);
          if (f.operator === 'equals') return val === target;
          if (f.operator === 'starts_with') return val.startsWith(target);
          if (f.operator === 'not_empty') return val.trim().length > 0;
          return true;
        });

        return filterMatchMode === 'all' ? matches.every(Boolean) : matches.some(Boolean);
      });
    }

    // Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.field === 'createdAt' || sortConfig.field === 'updatedAt') {
          const tA = new Date(a[sortConfig.field] || 0).getTime();
          const tB = new Date(b[sortConfig.field] || 0).getTime();
          return sortConfig.direction === 'asc' ? tA - tB : tB - tA;
        }
        const valA = String(a[sortConfig.field] || '').toLowerCase();
        const valB = String(b[sortConfig.field] || '').toLowerCase();
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return result;
  }, [companies, searchQuery, filters, filterMatchMode, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedCompanies.length / pageSize));
  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedCompanies.slice(start, start + pageSize);
  }, [processedCompanies, page, pageSize]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === paginatedCompanies.length && paginatedCompanies.length > 0) setSelected(new Set());
    else setSelected(new Set(paginatedCompanies.map(c => c.id)));
  };

  const handleExportCSV = () => {
    const rows = selected.size > 0 ? processedCompanies.filter(c => selected.has(c.id)) : processedCompanies;
    const headers = ['Name', 'Website', 'Industry', 'Employees', 'Revenue', 'Location', 'Description'];
    const csvContent = [
      headers.join(','),
      ...rows.map(c => `"${c.name || ''}","${c.website || ''}","${c.industry || ''}","${c.employees || ''}","${c.revenue || ''}","${c.location || ''}","${(c.description || '').replace(/"/g, '""')}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stone_crm_accounts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('success', 'Export Complete', `Exported ${rows.length} accounts`);
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-bg overflow-hidden">
      {/* Full-tab frosted glass overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Header Bar Portal matching Contacts design */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input
              type="text"
              placeholder="Search Accounts"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-4 py-1.5 w-[220px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>

          <button onClick={handleExportCSV} className="btn-secondary">
            <Download className="w-4 h-4" /> Export
          </button>

          <button onClick={() => setPanelOpen('new_company')} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Account
          </button>

          <div className="w-[1px] h-5 bg-border mx-1" />

          <button
            onClick={() => setPanelOpen('manage')}
            className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-main transition-colors ml-1"
          >
            <Settings className="w-4 h-4" /> Manage fields
          </button>
        </div>
      </HeaderPortal>

      {/* View Tabs Header */}
      <div className="mx-8 mt-4 mb-2 flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/40 scrollbar-none shrink-0">
        <button
          onClick={() => {
            setActiveTab('all');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-muted hover:text-text-main hover:bg-surface-hover border border-border/40'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>All Accounts</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-surface-hover text-text-muted'
          }`}>
            {companies.length}
          </span>
        </button>

        <button
          onClick={() => setPanelOpen('filter')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-primary hover:bg-primary/10 transition-colors ml-auto shrink-0 border border-primary/30"
        >
          <Filter className="w-3.5 h-3.5" /> Custom Filter Rule
        </button>
      </div>

      {/* Main Table Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto mx-8 mt-2 mb-6 rounded-[10px] bg-surface/40 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/90 backdrop-blur-md shadow-sm">
              <tr>
                <th className="w-12 p-3 text-center">
                  <button
                    onClick={toggleAll}
                    className="w-4 h-4 border border-border rounded flex items-center justify-center transition-colors bg-bg hover:border-primary text-primary"
                  >
                    {selected.size === paginatedCompanies.length && paginatedCompanies.length > 0 ? (
                      <Check className="w-3 h-3" strokeWidth={3} />
                    ) : null}
                  </button>
                </th>

                {visibleCols.has('Account Name') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted whitespace-nowrap">
                    Account Name
                  </th>
                )}
                {visibleCols.has('Website / Domain') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted whitespace-nowrap">Website / Domain</th>
                )}
                {visibleCols.has('Industry') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted whitespace-nowrap">Industry</th>
                )}
                {visibleCols.has('Headquarters') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted whitespace-nowrap">Headquarters</th>
                )}
                {visibleCols.has('Employees') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted whitespace-nowrap">Employees</th>
                )}
                {visibleCols.has('Revenue') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted whitespace-nowrap">Revenue</th>
                )}
                {visibleCols.has('Description') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted whitespace-nowrap">Description</th>
                )}
                <th className="w-20 p-3 text-[13px] font-bold text-center text-text-muted whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-text-muted">
                    <Building2 className="w-10 h-10 mx-auto mb-2 text-text-muted/40" />
                    <p className="text-[14px] font-bold text-text-main">No accounts found</p>
                    <p className="text-[12px] text-text-muted mt-1">Create your first company account to start organizing contacts and deals.</p>
                    <button
                      onClick={() => setPanelOpen('new_company')}
                      className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-bold shadow-sm"
                    >
                      + Add Account
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map(company => (
                  <tr
                    key={company.id}
                    onClick={() => navigate(`/crm/companies/${company.id}`)}
                    className={`border-b border-border/50 transition-colors cursor-pointer ${
                      selected.has(company.id) ? 'bg-primary/10' : 'hover:bg-surface-hover/50'
                    }`}
                  >
                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleSelect(company.id)}
                        className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${
                          selected.has(company.id)
                            ? 'bg-primary border-primary text-white'
                            : 'border-border bg-bg hover:border-primary text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </button>
                    </td>

                    {visibleCols.has('Account Name') && (
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[12px] bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {company.logoUrl ? (
                              <img src={company.logoUrl} alt="" className="w-full h-full object-contain rounded-lg" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                            ) : (
                              (company.name[0] || 'C').toUpperCase()
                            )}
                          </div>
                          <span className="text-[13px] font-bold text-text-main hover:text-primary transition-colors">
                            {company.name}
                          </span>
                        </div>
                      </td>
                    )}

                    {visibleCols.has('Website / Domain') && (
                      <td className="p-3">
                        {company.website ? (
                          <a
                            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[13px] font-medium text-primary hover:underline flex items-center gap-1.5"
                          >
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[160px]">{company.website.replace(/^https?:\/\//, '')}</span>
                          </a>
                        ) : (
                          <span className="text-[12px] text-text-muted opacity-40">—</span>
                        )}
                      </td>
                    )}

                    {visibleCols.has('Industry') && (
                      <td className="p-3">
                        {company.industry ? (
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-surface-hover border border-border text-text-main">
                            {company.industry}
                          </span>
                        ) : (
                          <span className="text-[12px] text-text-muted opacity-40">—</span>
                        )}
                      </td>
                    )}

                    {visibleCols.has('Headquarters') && (
                      <td className="p-3 text-[13px] font-medium text-text-main">
                        {company.location ? (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                            <span>{company.location}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-text-muted opacity-40">—</span>
                        )}
                      </td>
                    )}

                    {visibleCols.has('Employees') && (
                      <td className="p-3 text-[13px] font-semibold text-text-main">
                        {company.employees || '—'}
                      </td>
                    )}

                    {visibleCols.has('Revenue') && (
                      <td className="p-3 text-[13px] font-bold text-emerald-400">
                        {company.revenue || '—'}
                      </td>
                    )}

                    {visibleCols.has('Description') && (
                      <td className="p-3 text-[12px] text-text-muted max-w-[200px] truncate">
                        {company.description || '—'}
                      </td>
                    )}

                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setDeleteTarget({ id: company.id, name: company.name })}
                          className="p-1 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                          title="Delete account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Paginator matching Contacts design */}
      <div
        className="px-8 py-3.5 border-t flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0 shadow-lg"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => setPanelOpen('filter')} className="btn-secondary">
            <Filter className="w-4 h-4 text-primary" /> Advanced filters
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
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 bottom-full mb-2 w-[200px] bg-surface border border-border shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5"
                  >
                    {[
                      { label: 'Name (A-Z)', field: 'name', dir: 'asc' },
                      { label: 'Name (Z-A)', field: 'name', dir: 'desc' },
                      { label: 'Newest First', field: 'createdAt', dir: 'desc' },
                      { label: 'Oldest First', field: 'createdAt', dir: 'asc' },
                      { label: 'Industry (A-Z)', field: 'industry', dir: 'asc' },
                      { label: 'Location (A-Z)', field: 'location', dir: 'asc' }
                    ].map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSortConfig({ field: opt.field as keyof Company, direction: opt.dir as 'asc' | 'desc' });
                          setSortDropdownOpen(false);
                        }}
                        className="w-full flex items-center px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                    {sortConfig && (
                      <div className="border-t border-border mt-1 pt-1">
                        <button
                          onClick={() => {
                            setSortConfig(null);
                            setSortDropdownOpen(false);
                          }}
                          className="w-full flex items-center px-4 py-2 text-[13px] font-medium text-red-400 hover:bg-surface-hover transition-colors"
                        >
                          Clear Sort
                        </button>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[13px] font-medium text-text-muted">
            {processedCompanies.length === 0
              ? '0 Accounts'
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, processedCompanies.length)} of ${processedCompanies.length} Accounts`}
          </span>

          {/* Rows per page */}
          <div className="relative">
            <button
              onClick={() => setPageSizeDropdownOpen(!pageSizeDropdownOpen)}
              className="flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5 cursor-pointer font-semibold hover:border-primary/50 transition-colors bg-bg text-text-main text-[12px]"
            >
              <span>{pageSize} / page</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>

            {pageSizeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setPageSizeDropdownOpen(false)} />
                <div className="absolute bottom-full mb-1 right-0 w-32 bg-surface border border-border rounded-lg shadow-xl py-1 z-30">
                  {[10, 20, 50].map(sz => (
                    <button
                      key={sz}
                      onClick={() => {
                        setPageSize(sz);
                        setPage(1);
                        setPageSizeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between ${
                        pageSize === sz ? 'bg-primary/10 text-primary font-bold' : 'text-text-main hover:bg-surface-hover'
                      }`}
                    >
                      <span>{sz} accounts</span>
                      {pageSize === sz && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pagination buttons */}
          <div className="flex items-center gap-1.5 font-semibold">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-[6px] border border-border text-[12px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-2 text-[12px] font-bold text-text-main">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-[6px] border border-border text-[12px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── SlideOver Panels (New Account, Filter, Manage Columns) ── */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[2px]"
              onClick={() => setPanelOpen(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[440px] bg-surface shadow-2xl z-50 flex flex-col border-l border-border"
            >
              <div className="px-6 py-5 flex items-center justify-between border-b border-border bg-surface-hover/50">
                <h2 className="text-[16px] font-bold text-text-main">
                  {panelOpen === 'filter' ? 'Advanced Account Filters' : panelOpen === 'manage' ? 'Manage Columns' : 'Create New Account'}
                </h2>
                <button
                  onClick={() => setPanelOpen(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-auto bg-surface space-y-5">
                {/* ── Create New Company Form ── */}
                {panelOpen === 'new_company' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-text-main">
                        Company / Account Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Corporation"
                        value={newCompany.name}
                        onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                        className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-text-main">Website / Domain</label>
                      <input
                        type="text"
                        placeholder="https://acme.com"
                        value={newCompany.website}
                        onChange={e => setNewCompany({ ...newCompany, website: e.target.value })}
                        className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-text-main">Headquarters / Location</label>
                      <input
                        type="text"
                        placeholder="e.g. San Francisco, CA"
                        value={newCompany.location}
                        onChange={e => setNewCompany({ ...newCompany, location: e.target.value })}
                        className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] font-bold text-text-main">Industry</label>
                        {!showNewIndustryInput && (
                          <button
                            type="button"
                            onClick={() => setShowNewIndustryInput(true)}
                            className="text-[11px] font-bold text-primary hover:underline"
                          >
                            + Custom Industry
                          </button>
                        )}
                      </div>

                      {showNewIndustryInput ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="New industry name..."
                            value={newIndustryInput}
                            onChange={e => setNewIndustryInput(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-surface-hover border border-border rounded-[6px] text-[12px] text-text-main focus:outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trim = newIndustryInput.trim();
                              if (trim && !customIndustries.includes(trim)) {
                                setCustomIndustries([...customIndustries, trim]);
                                setNewCompany({ ...newCompany, industry: trim });
                              }
                              setNewIndustryInput('');
                              setShowNewIndustryInput(false);
                            }}
                            className="px-3 py-1.5 bg-primary text-white text-[12px] font-bold rounded-[6px]"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowNewIndustryInput(false)}
                            className="p-1 text-text-muted hover:text-text-main"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <select
                          value={newCompany.industry}
                          onChange={e => setNewCompany({ ...newCompany, industry: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                        >
                          <option value="">— Select Industry —</option>
                          {customIndustries.map(i => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold text-text-main">No. of Employees</label>
                        <select
                          value={newCompany.employees}
                          onChange={e => setNewCompany({ ...newCompany, employees: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                        >
                          <option value="">— Select Size —</option>
                          {['1–10', '11–50', '51–200', '201–500', '501–1,000', '1,000+'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold text-text-main">Annual Revenue</label>
                        <select
                          value={newCompany.revenue}
                          onChange={e => setNewCompany({ ...newCompany, revenue: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                        >
                          <option value="">— Select Revenue —</option>
                          {['< $1M', '$1M–$5M', '$5M–$20M', '$20M–$50M', '$50M+'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-text-main">Description / About</label>
                      <textarea
                        placeholder="Company mission, business model, or notes..."
                        value={newCompany.description}
                        onChange={e => setNewCompany({ ...newCompany, description: e.target.value })}
                        className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary min-h-[80px] resize-y"
                      />
                    </div>
                  </div>
                )}

                {/* ── Advanced Filters ── */}
                {panelOpen === 'filter' && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Match Mode</p>
                      <div className="flex gap-2">
                        {(['all', 'any'] as const).map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFilterMatchMode(m)}
                            className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold border transition-all ${
                              filterMatchMode === m
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface-hover text-text-muted border-border'
                            }`}
                          >
                            {m === 'all' ? 'Match All (AND)' : 'Match Any (OR)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Filter Rules</p>
                      {filters.map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={f.field}
                            onChange={e =>
                              setFilters(prev => prev.map((x, idx) => (idx === i ? { ...x, field: e.target.value } : x)))
                            }
                            className="bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary"
                          >
                            <option value="name">Name</option>
                            <option value="industry">Industry</option>
                            <option value="location">Location</option>
                            <option value="website">Website</option>
                            <option value="employees">Employees</option>
                            <option value="revenue">Revenue</option>
                          </select>

                          <select
                            value={f.operator}
                            onChange={e =>
                              setFilters(prev => prev.map((x, idx) => (idx === i ? { ...x, operator: e.target.value } : x)))
                            }
                            className="bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary"
                          >
                            <option value="contains">Contains</option>
                            <option value="equals">Equals</option>
                            <option value="starts_with">Starts with</option>
                            <option value="not_empty">Not empty</option>
                          </select>

                          {f.operator !== 'not_empty' && (
                            <input
                              type="text"
                              placeholder="Value..."
                              value={f.value}
                              onChange={e =>
                                setFilters(prev => prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))
                              }
                              className="flex-1 bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary min-w-0"
                            />
                          )}

                          <button
                            onClick={() => setFilters(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1 text-text-muted hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => setFilters(prev => [...prev, { field: 'name', operator: 'contains', value: '' }])}
                        className="w-full py-2 border-2 border-dashed border-border rounded-lg text-[12px] font-bold text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Condition
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Manage Columns ── */}
                {panelOpen === 'manage' && (
                  <div className="space-y-3">
                    <p className="text-[12px] text-text-muted">Toggle columns visible in the accounts table:</p>
                    <div className="space-y-1.5">
                      {ALL_COLUMNS.map(col => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => {
                            setVisibleCols(prev => {
                              const s = new Set(prev);
                              s.has(col) ? s.delete(col) : s.add(col);
                              return s;
                            });
                          }}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border bg-surface hover:bg-surface-hover transition-colors"
                        >
                          <span className="text-[13px] font-semibold text-text-main">{col}</span>
                          {visibleCols.has(col) ? (
                            <Eye className="w-4 h-4 text-primary" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-text-muted" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SlideOver Footer */}
              <div className="p-5 border-t border-border flex justify-end gap-3 bg-surface-hover/30 shrink-0">
                <button
                  onClick={() => setPanelOpen(null)}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (panelOpen === 'new_company') {
                      if (!newCompany.name.trim()) {
                        toast('error', 'Company name is required');
                        return;
                      }
                      createCompany.mutate(newCompany);
                    } else {
                      setPanelOpen(null);
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-[13px] font-bold bg-primary text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {panelOpen === 'new_company' ? 'Create Account' : 'Apply'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
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
