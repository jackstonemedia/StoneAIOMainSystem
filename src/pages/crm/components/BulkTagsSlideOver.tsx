import React from 'react';
import { SlideOverPanel } from '../../../components/ui/SlideOverPanel';

interface BulkTagsSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  bulkTagInput: string;
  setBulkTagInput: (val: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  error?: string | null;
}

export function BulkTagsSlideOver({
  isOpen,
  onClose,
  selectedCount,
  bulkTagInput,
  setBulkTagInput,
  onSubmit,
  isPending,
  error
}: BulkTagsSlideOverProps) {
  return (
    <SlideOverPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Add Tags to Selected"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover transition-colors">
            Cancel
          </button>
          <button 
            disabled={isPending || selectedCount === 0 || !bulkTagInput.trim()}
            onClick={onSubmit}
            className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Add Tag'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <p className="text-[13px] text-text-muted">You are modifying tags for <strong>{selectedCount}</strong> selected contacts.</p>
        
        {error && <p className="text-red-500 text-[13px] font-medium">{error}</p>}
        
        <div className="space-y-3">
          <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Add Tag</label>
          <div className="flex gap-2">
            <input type="text" value={bulkTagInput} onChange={e => setBulkTagInput(e.target.value)} placeholder="Type tag name..." className="flex-1 bg-surface border border-border text-[13px] px-3 py-2 rounded-[6px] focus:border-primary focus:outline-none" />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {['VIP', 'Cold Lead', 'Partner', 'Needs Follow-up'].map(tag => (
              <div key={tag} onClick={() => setBulkTagInput(tag)} className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-full text-[13px] text-text-main hover:bg-surface-hover cursor-pointer transition-colors">
                <span className="w-2 h-2 rounded-full bg-primary/60"></span> {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideOverPanel>
  );
}
