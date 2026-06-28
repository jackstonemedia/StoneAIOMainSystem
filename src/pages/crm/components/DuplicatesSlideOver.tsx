import React from 'react';
import { Search } from 'lucide-react';
import { SlideOverPanel } from '../../../components/ui/SlideOverPanel';

interface DuplicatesSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateGroups: any[];
}

export function DuplicatesSlideOver({ isOpen, onClose, duplicateGroups }: DuplicatesSlideOverProps) {
  return (
    <SlideOverPanel isOpen={isOpen} onClose={onClose} title="Merge Duplicates">
      <div className="space-y-6">
        <div className="p-4 rounded-[8px] bg-surface-hover/50 border border-border">
          <p className="text-[13px] font-medium text-text-main mb-2">Auto-Detect Duplicates</p>
          <p className="text-[12px] text-text-muted mb-4">Scan your contacts for duplicate emails or phone numbers to clean up your workspace.</p>
          <button className="w-full py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors hover:opacity-90">
            <Search className="w-4 h-4" /> Scan Workspace
          </button>
        </div>
        <div className="space-y-3">
          <p className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Detected Duplicates</p>
          {duplicateGroups.length === 0 ? (
            <div className="text-[13px] text-text-muted text-center py-6 border border-dashed border-border rounded-[8px]">
              No duplicates detected based on email or phone.
            </div>
          ) : (
            <div className="space-y-3">
              {duplicateGroups.map((group, i) => (
                <div key={i} className="p-3 border border-border rounded-lg bg-surface-hover">
                  <p className="text-[12px] font-medium text-text-main mb-2">Duplicate Group {i + 1}</p>
                  {group.map((c: any) => (
                    <div key={c.id} className="text-[12px] text-text-muted flex justify-between py-1 border-t border-border/50 first:border-0 mt-1 first:mt-0 pt-1 first:pt-0">
                      <span>{c.name || 'Unknown'}</span>
                      <span>{c.email || c.phone}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SlideOverPanel>
  );
}
