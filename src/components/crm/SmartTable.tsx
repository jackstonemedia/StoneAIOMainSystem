import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface TableGroup<T> {
  id: string;
  title: string;
  color: string; // Tailwind bg color class for the indicator stripe (e.g., 'bg-blue-500')
  items: T[];
  summary?: React.ReactNode;
}

interface SmartTableProps<T> {
  columns: Column<T>[];
  groups: TableGroup<T>[];
  onRowClick?: (item: T) => void;
  onAddClick?: (groupId: string) => void;
  addLabel?: string;
}

export function SmartTable<T extends { id: string }>({
  columns,
  groups,
  onRowClick,
  onAddClick,
  addLabel = '+ Add Item'
}: SmartTableProps<T>) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setCollapsedGroups(next);
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-12 font-sans">
      {groups.map((group) => {
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
              <h2 className={`font-semibold text-lg flex items-center gap-2 ${group.color.replace('bg-', 'text-')}`}>
                {group.title}
              </h2>
              <span className="text-xs font-medium text-text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Group Data Grid */}
            {!isCollapsed && (
              <div className="relative flex flex-col">
                {/* Horizontal scroll container if many columns */}
                <div className="overflow-x-auto border border-border/60 rounded-xl bg-surface/30">
                  <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                    <thead className="bg-bg/50 border-b border-border/60 sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        {/* Selector/Drag handle column spacer */}
                        <th className="w-12 px-3 py-3 border-r border-border/50 text-center font-medium text-text-muted">
                          <input type="checkbox" className="rounded border-border bg-bg text-primary focus:ring-primary/50 opacity-40 hover:opacity-100 transition-opacity cursor-pointer" />
                        </th>
                        
                        {/* Status Color Strip Spacer */}
                        <th className="w-2 p-0 border-r border-border/50"></th>
                        
                        {columns.map((col, idx) => (
                          <th 
                            key={col.key} 
                            style={{ width: col.width }}
                            className={`px-4 py-3 border-r border-border/50 font-medium text-text-muted select-none ${
                              col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {group.items.map((item) => (
                        <tr 
                          key={item.id}
                          onClick={() => onRowClick?.(item)}
                          className="group/row hover:bg-surface-hover transition-colors cursor-pointer bg-surface/50"
                        >
                          <td className="w-12 px-3 py-2 border-r border-border/50 text-center opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                             <input type="checkbox" className="rounded border-border bg-bg text-primary focus:ring-primary/50 cursor-pointer" />
                          </td>
                          <td className={`w-2 p-0 border-r border-border/50 ${group.color}`}></td>
                          
                          {columns.map((col) => (
                            <td 
                              key={col.key}
                              className={`px-4 py-2 border-r border-border/50 ${
                                col.align === 'center' ? 'justify-center text-center' : col.align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
                              }`}
                            >
                              <div className={`flex items-center w-full ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                                {col.render ? col.render(item) : (item as any)[col.key]}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}

                      {/* Add Item Row */}
                      {onAddClick && (
                        <tr className="bg-bg/20 hover:bg-surface transition-colors cursor-pointer" onClick={() => onAddClick(group.id)}>
                          <td className="w-12 border-r border-border/50 border-t border-border/60"></td>
                          <td className={`w-2 border-r border-border/50 border-t border-border/60 ${group.color} opacity-40`}></td>
                          <td colSpan={columns.length} className="px-4 py-3 border-t border-border/60 text-text-muted hover:text-text-main transition-colors">
                            <div className="flex items-center gap-2">
                              <Plus className="w-4 h-4" />
                              <span className="text-sm font-medium">{addLabel}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    
                    {/* Summary Row */}
                    {group.summary && (
                      <tfoot className="bg-bg border-t-2 border-border/80 sticky bottom-0 z-10">
                        <tr>
                          <td className="w-12 border-r border-border/50"></td>
                          <td className="w-2 border-r border-border/50"></td>
                          <td colSpan={columns.length} className="px-4 py-2.5">
                            {group.summary}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
