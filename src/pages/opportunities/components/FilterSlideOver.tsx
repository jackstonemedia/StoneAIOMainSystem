import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Filter, RotateCcw, Check, DollarSign, Calendar } from 'lucide-react';
import type { Stage, Tag, CustomField, FilterState } from '../../../types/opportunities';

interface FilterSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  stages: Stage[];
  tags: Tag[];
  customFields: CustomField[];
  teamMembers: any[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onClearAll: () => void;
}

export function FilterSlideOver({
  isOpen,
  onClose,
  stages = [],
  tags = [],
  customFields = [],
  teamMembers = [],
  filters,
  onFilterChange,
  onClearAll,
}: FilterSlideOverProps) {
  if (!isOpen) return null;

  const toggleStage = (id: string) => {
    const list = filters.stages || [];
    onFilterChange({
      ...filters,
      stages: list.includes(id) ? list.filter(x => x !== id) : [...list, id],
    });
  };

  const toggleOwner = (id: string) => {
    const list = filters.owners || [];
    onFilterChange({
      ...filters,
      owners: list.includes(id) ? list.filter(x => x !== id) : [...list, id],
    });
  };

  const toggleTag = (name: string) => {
    const list = filters.tags || [];
    onFilterChange({
      ...filters,
      tags: list.includes(name) ? list.filter(x => x !== name) : [...list, name],
    });
  };

  const toggleSource = (src: string) => {
    const list = filters.sources || [];
    onFilterChange({
      ...filters,
      sources: list.includes(src) ? list.filter(x => x !== src) : [...list, src],
    });
  };

  const SOURCES = [
    'Website Inbound',
    'Cold Outreach',
    'Referral',
    'Organic Search',
    'Paid Ads',
    'Event / Conference',
    'Partner',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-md bg-surface border-l border-border h-full flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <Filter className="w-4 h-4 text-primary" />
            <h2 className="text-[16px] font-bold text-text-main">Filter Opportunities</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClearAll}
              className="text-[12px] font-semibold text-text-muted hover:text-text-main px-2 py-1 rounded hover:bg-surface-hover transition-colors"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter List Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Opportunity Status</label>
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'open', label: 'Open' },
                { id: 'won', label: 'Won' },
                { id: 'lost', label: 'Lost' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => onFilterChange({ ...filters, status: st.id === 'all' ? undefined : st.id })}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    (filters.status === st.id || (!filters.status && st.id === 'all'))
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-surface-hover/40 text-text-muted border-border hover:text-text-main'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stages Checklist */}
          {stages.length > 0 && (
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Stages</label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {stages.map(s => {
                  const checked = (filters.stages || []).includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleStage(s.id)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-hover cursor-pointer text-[13px] text-text-main transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span>{s.name}</span>
                      </div>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        checked ? 'bg-primary border-primary text-white' : 'border-border'
                      }`}>
                        {checked && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Value Range Min / Max */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Estimated Value ($)</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <span className="absolute left-3 top-2 text-text-muted text-xs">$</span>
                <input
                  type="number"
                  placeholder="Min value"
                  value={filters.minValue || ''}
                  onChange={e => onFilterChange({ ...filters, minValue: parseFloat(e.target.value) || null })}
                  className="w-full pl-7 pr-3 py-1.5 bg-surface-hover/50 border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-primary"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-text-muted text-xs">$</span>
                <input
                  type="number"
                  placeholder="Max value"
                  value={filters.maxValue || ''}
                  onChange={e => onFilterChange({ ...filters, maxValue: parseFloat(e.target.value) || null })}
                  className="w-full pl-7 pr-3 py-1.5 bg-surface-hover/50 border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Owners Multi-select */}
          {teamMembers.length > 0 && (
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Owner</label>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {teamMembers.map((m: any) => {
                  const checked = (filters.owners || []).includes(m.userId);
                  return (
                    <div
                      key={m.userId}
                      onClick={() => toggleOwner(m.userId)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-hover cursor-pointer text-[13px] text-text-main transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center">
                          {m.userId[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="text-xs font-medium">{m.userId}</span>
                      </div>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        checked ? 'bg-primary border-primary text-white' : 'border-border'
                      }`}>
                        {checked && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags Multi-select */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => {
                  const checked = (filters.tags || []).includes(t.name);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTag(t.name)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        checked
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-surface-hover/40 text-text-muted border-border hover:border-primary/40'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sources Multi-select */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Lead Source</label>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {SOURCES.map(src => {
                const checked = (filters.sources || []).includes(src);
                return (
                  <div
                    key={src}
                    onClick={() => toggleSource(src)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-hover cursor-pointer text-xs text-text-main transition-colors"
                  >
                    <span>{src}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      checked ? 'bg-primary border-primary text-white' : 'border-border'
                    }`}>
                      {checked && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Close Date Range */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Expected Close Date Range</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={filters.closeStartDate || ''}
                onChange={e => onFilterChange({ ...filters, closeStartDate: e.target.value || undefined })}
                className="px-3 py-1.5 bg-surface-hover/50 border border-border rounded-xl text-xs text-text-main"
              />
              <input
                type="date"
                value={filters.closeEndDate || ''}
                onChange={e => onFilterChange({ ...filters, closeEndDate: e.target.value || undefined })}
                className="px-3 py-1.5 bg-surface-hover/50 border border-border rounded-xl text-xs text-text-main"
              />
            </div>
          </div>

          {/* Created Date Range */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Created Date Range</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={filters.createdStartDate || ''}
                onChange={e => onFilterChange({ ...filters, createdStartDate: e.target.value || undefined })}
                className="px-3 py-1.5 bg-surface-hover/50 border border-border rounded-xl text-xs text-text-main"
              />
              <input
                type="date"
                value={filters.createdEndDate || ''}
                onChange={e => onFilterChange({ ...filters, createdEndDate: e.target.value || undefined })}
                className="px-3 py-1.5 bg-surface-hover/50 border border-border rounded-xl text-xs text-text-main"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-hover/30 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClearAll}
            className="text-[13px] font-semibold text-text-muted hover:text-text-main"
          >
            Reset Filters
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white shadow-sm transition-all"
          >
            Apply Filters
          </button>
        </div>
      </motion.div>
    </div>
  );
}
