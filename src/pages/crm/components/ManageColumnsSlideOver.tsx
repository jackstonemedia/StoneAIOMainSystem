import React from 'react';
import { CheckSquare } from 'lucide-react';
import { SlideOverPanel } from '../../../components/ui/SlideOverPanel';

interface ManageColumnsSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  ALL_COLUMNS: string[];
  visibleCols: Set<string>;
  setVisibleCols: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function ManageColumnsSlideOver({
  isOpen,
  onClose,
  ALL_COLUMNS,
  visibleCols,
  setVisibleCols
}: ManageColumnsSlideOverProps) {
  return (
    <SlideOverPanel isOpen={isOpen} onClose={onClose} title="Manage Columns">
      <div className="space-y-4">
        {ALL_COLUMNS.map(col => (
          <div 
            key={col} 
            onClick={() => {
              const newCols = new Set(visibleCols);
              if (newCols.has(col)) newCols.delete(col);
              else newCols.add(col);
              setVisibleCols(newCols);
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-[6px] transition-colors border cursor-pointer ${visibleCols.has(col) ? 'bg-surface-hover border-border' : 'border-transparent hover:bg-surface-hover/50 hover:border-border/50'}`}
          >
            <CheckSquare className={`w-4 h-4 ${visibleCols.has(col) ? 'text-primary' : 'text-text-muted/30'}`} />
            <span className={`text-[13px] font-medium ${visibleCols.has(col) ? 'text-text-main' : 'text-text-muted'}`}>{col}</span>
          </div>
        ))}
      </div>
    </SlideOverPanel>
  );
}
