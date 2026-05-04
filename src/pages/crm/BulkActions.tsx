import { ChevronDown, Search, Filter, Server } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BulkActions() {
  const hasActions = false;

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      {/* Header */}
      <div className="px-8 py-5 flex items-center justify-between z-10 sticky top-0 shadow-sm relative border-b border-border bg-surface">
        <h1 className="text-[20px] font-bold text-text-main">Bulk Actions</h1>
      </div>

      {/* Tabs / Filters Toolbar */}
      <div className="px-8 flex flex-wrap items-center justify-between border-b border-border bg-surface relative pt-5 pb-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full cursor-pointer text-text-main border border-border bg-bg shadow-sm font-bold">
            <span className="text-[13px]">All Bulk Actions</span>
          </div>
          <div className="w-[1px] h-5 bg-border mx-2"></div>
          <button className="flex items-center gap-2 px-4 py-1.5 border border-border bg-surface-hover rounded-full text-[13px] font-medium text-text-muted hover:text-text-main transition-colors shadow-sm ml-1">
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative shadow-sm rounded-full flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search actions..." 
              className="pl-9 pr-4 py-1.5 w-[280px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
        </div>
      </div>

      {/* Empty State / Content area */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] flex items-center justify-center border border-border/50 bg-surface/30 backdrop-blur-xl shadow-luxury ring-1 ring-white/5">
        <table className="w-full text-left border-collapse min-w-[1000px] h-full">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
            <tr>
              <th className="p-3 text-[13px] font-semibold text-gray-500 whitespace-nowrap">Action Label</th>
              <th className="p-3 text-[13px] font-semibold text-gray-500 whitespace-nowrap">Operation</th>
              <th className="p-3 text-[13px] font-semibold text-gray-500 whitespace-nowrap">Status</th>
              <th className="p-3 text-[13px] font-semibold text-gray-500 whitespace-nowrap">User</th>
              <th className="p-3 text-[13px] font-semibold text-gray-500 whitespace-nowrap">Created (EDT)</th>
              <th className="p-3 text-[13px] font-semibold text-gray-500 whitespace-nowrap">Completed (EDT)</th>
              <th className="p-3 text-[13px] font-semibold text-gray-500 whitespace-nowrap w-[200px]">Statistics</th>
            </tr>
          </thead>
          <tbody>
            {!hasActions ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-border bg-bg">
                      <Server className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-[18px] font-bold mb-2 text-text-main">No Bulk Actions Yet</h2>
                    <p className="text-[14px] mb-6 text-center max-w-sm text-text-muted">
                      Bulk actions allow you to update, tag, or email multiple contacts at once. Select multiple contacts in the Contacts view to start a bulk action.
                    </p>
                    <Link to="/crm/contacts" className="px-5 py-2 rounded-[6px] text-[13px] font-bold text-bg transition-colors shadow-sm active:scale-95" style={{ backgroundColor: 'var(--primary)' }}>
                      Go to Contacts
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td className="p-3">
                  <div className="w-full bg-surface-hover border border-border rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: '100%' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] font-medium text-text-muted">100% (45/45)</span>
                  </div>
                </td>
                <td className="p-3"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Paginator */}
      <div className="px-8 py-4 bg-surface border-t border-border flex items-center justify-between text-[13px] text-text-muted shrink-0 z-10 sticky bottom-0">
        <div className="font-medium">Page 1 of 1</div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 border border-border rounded-[4px] px-2.5 py-1.5 cursor-pointer hover:bg-surface-hover transition-colors font-medium text-text-main">
            20 <ChevronDown className="w-3.5 h-3.5 opacity-50" />
          </div>
          <div className="flex items-center gap-1.5">
            <button className="px-3 py-1.5 text-text-muted hover:text-text-main transition-colors font-medium">Prev</button>
            <button className="px-3.5 py-1.5 border border-border rounded-[4px] text-primary font-semibold shadow-sm" style={{ backgroundColor: 'var(--surface)' }}>1</button>
            <button className="px-3 py-1.5 text-text-muted hover:text-text-main transition-colors font-medium">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
