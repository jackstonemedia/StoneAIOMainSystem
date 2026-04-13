import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, Plus, Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

export interface TableGroup<T> {
  id: string;
  title: string;
  color: string; // Tailwind bg color class for the indicator stripe
  items: T[];
  summary?: React.ReactNode;
}

interface SmartTableProps<T> {
  columns: Column<T>[];
  groups: TableGroup<T>[];
  onRowClick?: (item: T) => void;
  onAddClick?: (groupId: string) => void;
  addLabel?: string;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptySubtitle?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
}

type SortDir = 'asc' | 'desc' | null;

function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr className="border-b border-border/40">
      <td className="w-12 px-3 py-3 border-r border-border/40">
        <div className="w-4 h-4 rounded bg-surface-hover animate-pulse" />
      </td>
      <td className="w-2 p-0 border-r border-border/40" />
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-4 py-3 border-r border-border/40">
          <div
            className="h-4 rounded-lg bg-surface-hover animate-pulse"
            style={{ width: `${40 + Math.random() * 40}%`, animationDelay: `${i * 60}ms` }}
          />
        </td>
      ))}
    </tr>
  );
}

export function SmartTable<T extends { id: string }>({
  columns,
  groups,
  onRowClick,
  onAddClick,
  addLabel = '+ Add Item',
  isLoading = false,
  skeletonRows = 5,
  emptyIcon,
  emptyTitle = 'No items yet',
  emptySubtitle = 'Get started by adding your first item.',
  onEmptyAction,
  emptyActionLabel = 'Add Item',
}: SmartTableProps<T>) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const toggleGroup = (id: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCollapsedGroups(next);
  };

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); setSortDir(null); }
  };

  const sortedGroups = groups.map(group => {
    if (!sortKey || !sortDir) return group;
    const sorted = [...group.items].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return { ...group, items: sorted };
  });

  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);

  // Empty state (no items at all and not loading)
  if (!isLoading && totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        {emptyIcon && <div className="mb-5 opacity-25 scale-150">{emptyIcon}</div>}
        {!emptyIcon && <Search className="w-12 h-12 mb-4 opacity-20 text-text-muted" />}
        <p className="text-base font-semibold text-text-main mb-1">{emptyTitle}</p>
        <p className="text-sm text-text-muted max-w-xs">{emptySubtitle}</p>
        {onEmptyAction && (
          <button
            onClick={onEmptyAction}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm shadow-md shadow-primary/20 hover:bg-primary-hover transition-all"
          >
            <Plus className="w-4 h-4" />
            {emptyActionLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-8 pb-12 font-sans">
      {isLoading ? (
        /* Skeleton loading state */
        <div className="flex flex-col">
          <div className="overflow-x-auto border border-border/60 rounded-xl bg-surface/30">
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
              <thead className="bg-bg/50 border-b border-border/60">
                <tr>
                  <th className="w-12 px-3 py-3 border-r border-border/50" />
                  <th className="w-2 p-0 border-r border-border/50" />
                  {columns.map(col => (
                    <th key={col.key} style={{ width: col.width }} className="px-4 py-3 border-r border-border/50">
                      <div className="h-3 w-16 rounded bg-surface-hover animate-pulse" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: skeletonRows }).map((_, i) => (
                  <SkeletonRow key={i} colCount={columns.length} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        sortedGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.id);
          const itemCount = group.items.length;

          return (
            <div key={group.id} className="flex flex-col">
              {/* Group Header */}
              <div
                className="flex items-center gap-2 mb-2 group cursor-pointer w-max"
                onClick={() => toggleGroup(group.id)}
              >
                <button className="p-0.5 rounded hover:bg-surface-hover text-text-muted transition-colors">
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <div className={`w-2.5 h-2.5 rounded-full ${group.color}`} />
                <h2 className="font-semibold text-base text-text-main">{group.title}</h2>
                <span className="text-xs font-medium text-text-muted bg-surface border border-border px-2 py-0.5 rounded-full">
                  {itemCount}
                </span>
              </div>

              {/* Data Grid */}
              {!isCollapsed && (
                <div className="overflow-x-auto border border-border/60 rounded-xl bg-surface/30">
                  <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                    <thead className="bg-bg/50 border-b border-border/60 sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        <th className="w-12 px-3 py-3 border-r border-border/50 text-center">
                          <input type="checkbox" className="rounded border-border bg-bg text-primary focus:ring-primary/50 opacity-40 hover:opacity-100 cursor-pointer" />
                        </th>
                        <th className="w-2 p-0 border-r border-border/50" />
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            style={{ width: col.width }}
                            onClick={() => col.sortable && handleSort(col.key)}
                            className={`px-4 py-3 border-r border-border/50 font-medium text-text-muted select-none text-xs uppercase tracking-wide ${
                              col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                            } ${col.sortable ? 'cursor-pointer hover:text-text-main hover:bg-surface/50 transition-colors' : ''}`}
                          >
                            <div className={`flex items-center gap-1.5 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}>
                              {col.header}
                              {col.sortable && (
                                <span className="text-text-muted opacity-50">
                                  {sortKey === col.key && sortDir === 'asc' ? (
                                    <ChevronUp className="w-3 h-3 opacity-100" />
                                  ) : sortKey === col.key && sortDir === 'desc' ? (
                                    <ChevronDown className="w-3 h-3 opacity-100" />
                                  ) : (
                                    <ChevronsUpDown className="w-3 h-3" />
                                  )}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {group.items.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => onRowClick?.(item)}
                          className="group/row hover:bg-surface-hover/60 transition-colors cursor-pointer bg-surface/40"
                        >
                          <td className="w-12 px-3 py-2.5 border-r border-border/40 text-center opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" className="rounded border-border bg-bg text-primary focus:ring-primary/50 cursor-pointer" />
                          </td>
                          <td className={`w-2 p-0 border-r border-border/40 ${group.color}`} />
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className={`px-4 py-2.5 border-r border-border/40 ${
                                col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                              }`}
                            >
                              <div className={`flex items-center w-full ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                                {col.render ? col.render(item) : (item as any)[col.key]}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}

                      {/* Add row */}
                      {onAddClick && (
                        <tr className="bg-bg/10 hover:bg-surface-hover/30 transition-colors cursor-pointer" onClick={() => onAddClick(group.id)}>
                          <td className="w-12 border-r border-border/40 border-t border-border/50" />
                          <td className={`w-2 border-r border-border/40 border-t border-border/50 ${group.color} opacity-30`} />
                          <td colSpan={columns.length} className="px-4 py-3 border-t border-border/50 text-text-muted hover:text-primary transition-colors">
                            <div className="flex items-center gap-2">
                              <Plus className="w-4 h-4" />
                              <span className="text-sm font-medium">{addLabel}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* Summary footer */}
                    {group.summary && (
                      <tfoot className="bg-bg border-t-2 border-border/60 sticky bottom-0 z-10">
                        <tr>
                          <td className="w-12 border-r border-border/40" />
                          <td className="w-2 border-r border-border/40" />
                          <td colSpan={columns.length} className="px-4 py-2.5">{group.summary}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
