import React from 'react';
import { X, Plus, Eye, EyeOff } from 'lucide-react';
import { SlideOverPanel } from '../../../components/ui/SlideOverPanel';

interface FilterSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  filterMatchMode: 'all' | 'any';
  setFilterMatchMode: (mode: 'all' | 'any') => void;
  visibleCols: Set<string>;
  setVisibleCols: React.Dispatch<React.SetStateAction<Set<string>>>;
  ALL_COLUMNS: string[];
  filters: any[];
  setFilters: React.Dispatch<React.SetStateAction<any[]>>;
  smartListNameInput: string;
  setSmartListNameInput: (val: string) => void;
  onCreateSmartList: () => void;
  isSavingSmartList: boolean;
}

export function FilterSlideOver({
  isOpen,
  onClose,
  filterMatchMode,
  setFilterMatchMode,
  visibleCols,
  setVisibleCols,
  ALL_COLUMNS,
  filters,
  setFilters,
  smartListNameInput,
  setSmartListNameInput,
  onCreateSmartList,
  isSavingSmartList
}: FilterSlideOverProps) {
  return (
    <SlideOverPanel isOpen={isOpen} onClose={onClose} title="Advanced Filters">
      <div className="space-y-5">
        {/* Match Mode */}
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

        {/* Visible Columns */}
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

        {/* Filter Conditions */}
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

        {/* Save Smart List */}
        {filters.length > 0 && (
          <div className="pt-4 border-t border-border mt-4">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Save as Smart List</p>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Smart List Name..." value={smartListNameInput} onChange={e => setSmartListNameInput(e.target.value)} className="flex-1 bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-3 py-2 outline-none focus:border-primary placeholder:text-text-muted" />
              <button 
                disabled={isSavingSmartList}
                onClick={onCreateSmartList}
                className="bg-primary text-white px-3 py-2 rounded-[6px] text-[12px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSavingSmartList ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

      </div>
    </SlideOverPanel>
  );
}
