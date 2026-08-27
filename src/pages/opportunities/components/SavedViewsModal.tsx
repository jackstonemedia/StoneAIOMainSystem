import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bookmark, X, Check, Trash2 } from 'lucide-react';
import { opportunitiesApi } from '../../../lib/api/opportunities';
import { useToast } from '../../../components/ui/Toast';
import type { SavedView, FilterState, CardConfig, ColumnConfig } from '../../../types/opportunities';

interface SavedViewsModalProps {
  isOpen: boolean;
  pipelineId?: string;
  currentFilters: FilterState;
  currentSort?: { field: string; order: 'asc' | 'desc' };
  currentCardConfig?: CardConfig;
  currentColumns?: ColumnConfig[];
  currentViewType?: 'board' | 'list' | 'calendar';
  existingViews: SavedView[];
  onClose: () => void;
  onSelectView: (view: SavedView) => void;
  onSavedViewCreated: () => void;
}

export function SavedViewsModal({
  isOpen,
  pipelineId,
  currentFilters,
  currentSort,
  currentCardConfig,
  currentColumns,
  currentViewType = 'board',
  existingViews = [],
  onClose,
  onSelectView,
  onSavedViewCreated,
}: SavedViewsModalProps) {
  const { toast } = useToast();
  const [viewName, setViewName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveCurrentView = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewName.trim()) return;

    setIsSaving(true);
    try {
      await opportunitiesApi.createSavedView({
        name: viewName.trim(),
        pipelineId: pipelineId || null,
        viewType: currentViewType,
        isDefault,
        filtersJson: JSON.stringify(currentFilters),
        sortJson: currentSort ? JSON.stringify(currentSort) : null,
        columnsJson: currentColumns ? JSON.stringify(currentColumns) : null,
        cardConfigJson: currentCardConfig ? JSON.stringify(currentCardConfig) : null,
      });
      toast('success', 'View saved successfully');
      setViewName('');
      onSavedViewCreated();
      onClose();
    } catch (e: any) {
      toast('error', 'Failed to save view', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteView = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await opportunitiesApi.deleteSavedView(id);
      toast('success', 'View deleted');
      onSavedViewCreated();
    } catch (e: any) {
      toast('error', 'Failed to delete view', e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-text-main">Saved Views</h2>
              <p className="text-[12px] text-text-muted">Save your filters, columns & sorting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Create Form */}
          <form onSubmit={handleSaveCurrentView} className="space-y-3">
            <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Save Current Configuration</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="View name (e.g. High Value Q3 Deals)"
                value={viewName}
                onChange={e => setViewName(e.target.value)}
                className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
              />
              <label className="flex items-center gap-2 text-xs text-text-main cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-primary"
                />
                Set as my default view
              </label>
            </div>
            <button
              type="submit"
              disabled={isSaving || !viewName.trim()}
              className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold rounded-xl disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSaving ? 'Saving...' : 'Save Current View'}
            </button>
          </form>

          {/* List Existing Views */}
          {existingViews.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border">
              <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Your Saved Views</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {existingViews.map(view => (
                  <div
                    key={view.id}
                    onClick={() => {
                      onSelectView(view);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-hover cursor-pointer border border-transparent hover:border-border transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[13px] text-text-main font-medium">{view.name}</span>
                      {view.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-semibold">
                          Default
                        </span>
                      )}
                    </div>
                    <button
                      onClick={e => handleDeleteView(view.id, e)}
                      className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
