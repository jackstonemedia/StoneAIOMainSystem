import { useState, ReactNode } from 'react';
import { ChevronUp, ChevronDown, Search, Download, MoreHorizontal } from 'lucide-react';

export interface Column<T = any> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, row: T) => ReactNode;
}

interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  rowKey?: (row: T) => string;
  toolbar?: ReactNode;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className="skeleton h-4" style={{ width: `${50 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T extends Record<string, any>>({
  columns, data, isLoading, searchable, searchPlaceholder = 'Search…',
  onRowClick, emptyState, rowKey, toolbar
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const getKey = (row: T, i: number) => rowKey ? rowKey(row) : String(row.id ?? i);

  const filtered = data.filter(row =>
    !search || columns.some(col => {
      const v = row[col.key];
      return v && String(v).toLowerCase().includes(search.toLowerCase());
    })
  );

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const allSelected = sorted.length > 0 && sorted.every((r, i) => selected.has(getKey(r, i)));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((r, i) => getKey(r, i))));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar row */}
      {(searchable || toolbar) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-text-main placeholder:text-text-muted/50 w-64 transition-all"
              />
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {toolbar}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/8 border border-primary/20 rounded-xl mb-3 animate-scale-in">
          <span className="text-sm font-semibold text-primary">{selected.size} selected</span>
          <div className="h-4 w-px bg-primary/20" />
          <button className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Export CSV</button>
          <button className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Add Tag</button>
          <button className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors ml-auto">Delete Selected</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-border bg-surface shadow-[var(--shadow-luxury)]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-surface/95 backdrop-blur-sm">
              <th className="w-10 px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
                />
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-label-caps text-text-muted whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-text-main select-none' : ''}`}
                  style={col.width ? { width: col.width } : {}}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp className="w-3 h-3 text-primary" />
                        : <ChevronDown className="w-3 h-3 text-primary" />
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={columns.length + 2} />)
              : sorted.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length + 2} className="py-16 text-center">
                    {emptyState ?? (
                      <div className="text-text-muted text-sm">
                        {search ? `No results for "${search}"` : 'No data yet.'}
                      </div>
                    )}
                  </td>
                </tr>
              )
              : sorted.map((row, i) => {
                const key = getKey(row, i);
                const isSelected = selected.has(key);
                return (
                  <tr
                    key={key}
                    className={`group transition-colors duration-100 ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-hover'} ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => setSelected(prev => {
                          const next = new Set(prev);
                          next.has(key) ? next.delete(key) : next.add(key);
                          return next;
                        })}
                        className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
                      />
                    </td>
                    {columns.map(col => (
                      <td key={col.key} className="px-5 py-3.5 text-sm text-text-main">
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface transition-colors">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>

      {/* Row count */}
      {!isLoading && sorted.length > 0 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-text-muted">{sorted.length} {sorted.length === 1 ? 'record' : 'records'}</span>
          {search && <span className="text-xs text-text-muted">Filtered from {data.length} total</span>}
        </div>
      )}
    </div>
  );
}
