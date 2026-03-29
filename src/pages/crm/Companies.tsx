import { Plus, Search, Filter, MoreHorizontal, Building2, Globe, Users, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SmartTable, Column, TableGroup } from '../../components/crm/SmartTable';

interface Company {
  id: string;
  name: string;
  industry: string;
  website: string;
  employees: string;
  openDeals?: number;
  totalRevenue?: string;
  revenue?: string;
}

interface Deal {
  id: string;
  amount: string | number;
  stage: string;
  companyId: string;
}

export default function Companies() {
  const navigate = useNavigate();
  const { data: companies = [], isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => fetch('/api/crm/companies').then(res => res.json())
  });

  const { data: deals = [], isLoading: loadingDeals } = useQuery<Deal[]>({
    queryKey: ['deals'],
    queryFn: () => fetch('/api/crm/deals').then(res => res.json())
  });

  const loading = loadingCompanies || loadingDeals;

  const getIndustryColor = (industry: string) => {
    if (industry.toLowerCase().includes('software') || industry.toLowerCase().includes('tech')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (industry.toLowerCase().includes('finance')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (industry.toLowerCase().includes('health')) return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const tableColumns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Account',
      width: '25%',
      render: (c) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-text-muted" />
          </div>
          <span className="font-medium text-text-main group-hover/row:text-primary transition-colors">{c.name}</span>
        </div>
      )
    },
    {
      key: 'website',
      header: 'Domain',
      align: 'left',
      width: '200px',
      render: (c) => (
        <a href={`https://${c.website}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded w-max">
          <Globe className="w-3 h-3" />
          {c.website}
          <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
        </a>
      )
    },
    {
      key: 'industry',
      header: 'Industry',
      align: 'left',
      width: '180px',
      render: (c) => (
        <div className={`px-2.5 py-1 rounded text-xs font-medium border w-max ${getIndustryColor(c.industry)}`}>
          {c.industry || 'Unknown'}
        </div>
      )
    },
    {
      key: 'employees',
      header: 'No. of employees',
      align: 'center',
      width: '140px',
      render: (c) => (
        <span className="text-sm text-text-muted">{c.employees || '-'}</span>
      )
    },
    {
      key: 'openDeals',
      header: 'Open Deals',
      align: 'center',
      width: '140px',
      render: (c) => {
        const count = deals.filter(d => d.companyId === c.id && d.stage !== 'won' && d.stage !== 'lost').length;
        return (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${count > 0 ? 'bg-amber-500 text-black' : 'bg-surface text-text-muted'}`}>
            {count}
          </div>
        )
      }
    }
  ];

  const tableGroups: TableGroup<Company>[] = [
    {
      id: 'companies',
      title: 'Companies',
      color: 'bg-indigo-500',
      items: companies
    }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-text-muted mt-1">Track organizations and their associated deals.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          New Company
        </button>
      </header>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-bg shrink-0">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search companies..." 
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">Loading accounts...</div>
        ) : (
          <main className="max-w-[1400px]">
             <SmartTable 
                columns={tableColumns} 
                groups={tableGroups} 
                onRowClick={(c) => navigate(`/business/crm/companies/${c.id}`)}
                addLabel="+ Add account"
             />
          </main>
        )}
      </div>
    </div>
  );
}
