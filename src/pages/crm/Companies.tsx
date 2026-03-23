import { Plus, Search, Filter, MoreHorizontal, Building2, Globe, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

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
  amount: string;
  stage: string;
  companyId: string;
}

export default function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/companies').then(res => res.json()),
      fetch('/api/crm/deals').then(res => res.json())
    ])
      .then(([companiesData, dealsData]) => {
        setCompanies(companiesData);
        setDeals(dealsData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch companies and deals:', err);
        setLoading(false);
      });
  }, []);

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

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-text-muted">Loading companies...</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-bg border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium text-text-muted">Company Name</th>
                  <th className="px-6 py-3 font-medium text-text-muted">Industry</th>
                  <th className="px-6 py-3 font-medium text-text-muted">Size</th>
                  <th className="px-6 py-3 font-medium text-text-muted">Open Deals</th>
                  <th className="px-6 py-3 font-medium text-text-muted">Total Revenue</th>
                  <th className="px-6 py-3 font-medium text-text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.map((company) => {
                  const companyDeals = deals.filter(d => d.companyId === company.id && d.stage !== 'Won' && d.stage !== 'Lost');
                  const openDealsCount = companyDeals.length;
                  const totalRevenueValue = companyDeals.reduce((sum, d) => sum + parseInt(d.amount.replace(/[^0-9]/g, '') || '0'), 0);
                  const totalRevenue = openDealsCount > 0 ? `$${totalRevenueValue.toLocaleString()}` : (company.revenue || '$0');

                  return (
                    <tr 
                      key={company.id} 
                      onClick={() => navigate(`/crm/companies/${company.id}`)}
                      className="hover:bg-surface-hover transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-bg border border-border text-text-muted flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-medium text-text-main group-hover:text-primary transition-colors">{company.name}</div>
                            <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                              <Globe className="w-3 h-3" />
                              {company.website}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-muted">{company.industry}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-text-muted">
                          <Users className="w-3.5 h-3.5" />
                          {company.employees}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${openDealsCount > 0 ? 'bg-amber/10 text-amber' : 'bg-bg text-text-muted'}`}>
                          {openDealsCount} deals
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">{totalRevenue}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 text-text-muted hover:text-text-main opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
