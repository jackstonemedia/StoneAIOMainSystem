import { GripVertical, X } from 'lucide-react';

interface EditLayoutOverlayProps {
  isEditing?: boolean;
  onRemove?: () => void;
}

export function EditLayoutOverlay({ isEditing, onRemove }: EditLayoutOverlayProps) {
  if (!isEditing) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute left-2 top-2 flex items-center gap-1 pointer-events-auto widget-drag-handle cursor-grab text-[var(--text-muted)] bg-[color:var(--bg)]/80 border border-[var(--border)] rounded-full px-2 py-0.5 text-[11px] shadow-[var(--shadow-interactive)]">
        <GripVertical className="w-3 h-3" />
        <span className="uppercase tracking-[0.12em] text-[9px]">Drag</span>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 pointer-events-auto rounded-full bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 hover:border-red-400 transition-colors w-7 h-7 flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
