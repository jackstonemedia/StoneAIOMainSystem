import React from 'react';
import { Filter, Check, Tag as TagIcon, Layers, UserCheck, Globe, Flag, RotateCcw } from 'lucide-react';
import { SlideOverPanel } from '../../../components/ui/SlideOverPanel';
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
    <SlideOverPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Opportunities"
      width="w-[500px]"
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              onClearAll();
            }}
            className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-muted hover:text-text-main border border-border hover:bg-surface-hover transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear All
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            Apply Filters
          </button>
        </>
      }
    >
      <div className="space-y-6 pb-8">
        {/* Status Filter */}
        <div className="space-y-2">
          <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5" /> Opportunity Status
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Open' },
              { id: 'won', label: 'Won' },
              { id: 'lost', label: 'Lost' },
            ].map(st => {
              const isSelected = filters.status === st.id || (!filters.status && st.id === 'all');
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onFilterChange({ ...filters, status: st.id === 'all' ? undefined : st.id })}
                  className={`py-1.5 px-2 rounded-[6px] text-[12px] font-semibold border transition-all text-center ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-sm font-bold'
                      : 'bg-surface-hover border-border text-text-muted hover:text-text-main'
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Stages Checklist */}
        {stages.length > 0 && (
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Stages
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto p-1 bg-surface-hover/30 border border-border/50 rounded-xl">
              {stages.map(s => {
                const checked = (filters.stages || []).includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleStage(s.id)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-hover cursor-pointer text-[13px] text-text-main transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="font-medium">{s.name}</span>
                    </div>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      checked ? 'bg-primary border-primary text-white' : 'border-border bg-surface'
                    }`}>
                      {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="h-px bg-border" />

        {/* Lead Sources */}
        <div className="space-y-2">
          <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Lead Sources
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map(src => {
              const checked = (filters.sources || []).includes(src);
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => toggleSource(src)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    checked
                      ? 'bg-primary/20 border-primary text-primary font-bold'
                      : 'bg-surface-hover border-border text-text-muted hover:text-text-main'
                  }`}
                >
                  {src}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Tags Multi-Filter */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5" /> Tags
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-surface-hover/30 border border-border/50 rounded-xl">
              {tags.map(t => {
                const checked = (filters.tags || []).includes(t.name);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.name)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      checked
                        ? 'bg-primary/20 border-primary text-primary font-bold'
                        : 'bg-surface-hover border-border text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Owners */}
        {teamMembers.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Owner
              </label>
              <div className="space-y-1">
                {teamMembers.map((m: any) => {
                  const checked = (filters.owners || []).includes(m.userId);
                  return (
                    <div
                      key={m.userId}
                      onClick={() => toggleOwner(m.userId)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-hover cursor-pointer text-[13px] text-text-main transition-colors"
                    >
                      <span>{m.userId}</span>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        checked ? 'bg-primary border-primary text-white' : 'border-border bg-surface'
                      }`}>
                        {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <div className="space-y-3">
              <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">
                Custom Fields
              </label>
              <div className="space-y-2.5">
                {customFields.map(cf => (
                  <div key={cf.id} className="space-y-1">
                    <span className="text-[12px] font-medium text-text-main">{cf.label}</span>
                    <input
                      type="text"
                      placeholder={`Filter by ${cf.label.toLowerCase()}...`}
                      value={filters.customFields?.[cf.id] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const copy = { ...(filters.customFields || {}) };
                        if (val) copy[cf.id] = val;
                        else delete copy[cf.id];
                        onFilterChange({ ...filters, customFields: copy });
                      }}
                      className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </SlideOverPanel>
  );
}
