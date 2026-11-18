import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search, Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import { apiFetch } from '../../lib/apiClient';

const OPERATION_LABELS: Record<string, string> = {
  tag: 'Add Tag',
  delete: 'Delete',
  assign: 'Assign',
  export: 'Export',
  bulk_email: 'Send Email',
  bulk_sms: 'Send SMS',
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'text-emerald-400 bg-emerald-400/10',
  partial: 'text-amber-400 bg-amber-400/10',
  failed: 'text-red-400 bg-red-400/10',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function BulkActions() {
  const [search, setSearch] = useState('');

  const { data: actions = [], isLoading, isError, error } = useQuery<any[]>({
    queryKey: ['bulk_actions'],
    queryFn: () => apiFetch('/api/crm/bulk-actions').then(r => r.json()),
  });

  const filtered = actions.filter(a => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return a.label.toLowerCase().includes(q) || (OPERATION_LABELS[a.type] ?? a.type).toLowerCase().includes(q);
  });

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
              placeholder="Search actions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-[220px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
        </div>
      </HeaderPortal>

      {/* Content area inside Frosted Glass Panel */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] flex flex-col border border-border/50 bg-transparent shadow-luxury ring-1 ring-white/5 relative z-10">
        <table className="w-full text-left border-collapse min-w-[1000px] h-full">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
            <tr>
              <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Action Label</th>
              <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Operation</th>
              <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Status</th>
              <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">User</th>
              <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Created</th>
              <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Completed</th>
              <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap w-[200px]">Statistics</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <p className="text-[13px] text-text-muted">Loading bulk actions…</p>
                  </div>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <h2 className="text-[16px] font-bold text-text-main">Couldn't load bulk actions</h2>
                    <p className="text-[13px] max-w-sm text-center text-text-muted">{(error as any)?.message || 'Something went wrong.'}</p>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2 border border-border bg-surface shadow-sm">
                      <Server className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-[16px] font-bold text-text-main">No Bulk Actions Yet</h2>
                    <p className="text-[13px] max-w-sm text-center text-text-muted mb-4">
                      {search.trim()
                        ? 'No bulk actions match that search.'
                        : 'Bulk actions allow you to update, tag, or email multiple contacts at once. Select multiple contacts in the Contacts view to start a bulk action.'}
                    </p>
                    {!search.trim() && (
                      <Link to="/crm/contacts" className="btn-primary">
                        Go to Contacts
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(action => {
                const target = action.targetCount || 0;
                const done = action.successCount || 0;
                const pct = target > 0 ? Math.round((done / target) * 100) : 0;
                return (
                  <tr key={action.id} className="border-b border-border/50">
                    <td className="p-3 text-[13px] font-medium text-text-main whitespace-nowrap">{action.label}</td>
                    <td className="p-3 text-[13px] text-text-muted whitespace-nowrap">{OPERATION_LABELS[action.type] ?? action.type}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLES[action.status] ?? 'text-text-muted bg-surface-hover'}`}>
                        {action.status}
                      </span>
                    </td>
                    <td className="p-3 text-[13px] text-text-muted whitespace-nowrap">{action.createdBy ?? '—'}</td>
                    <td className="p-3 text-[13px] text-text-muted whitespace-nowrap">{formatDate(action.createdAt)}</td>
                    <td className="p-3 text-[13px] text-text-muted whitespace-nowrap">{formatDate(action.completedAt)}</td>
                    <td className="p-3">
                      <div className="w-full bg-surface-hover border border-border rounded-full h-1.5 overflow-hidden">
                        <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] font-medium text-text-muted">{pct}% ({done}/{target})</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
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
        <div className="font-medium text-text-muted">
          {isLoading ? 'Loading…' : `${filtered.length} bulk action${filtered.length === 1 ? '' : 's'}${search.trim() ? ` matching “${search.trim()}”` : ''}`}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5 font-semibold text-text-main text-[12px] bg-bg">
            <span>Latest 50</span> <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </div>
        </div>
      </div>
    </div>
  );
}
