import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  actions?: ReactNode;
}

const widthMap = { sm: 'w-[400px]', md: 'w-[520px]', lg: 'w-[680px]', xl: 'w-[860px]' };

export function SlidePanel({ open, onClose, title, subtitle, children, width = 'md', actions }: SlidePanelProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative flex flex-col h-full ${widthMap[width]} bg-surface border-l border-border shadow-[var(--shadow-luxury)] animate-slide-right`}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-text-main">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors ml-4 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer actions */}
        {actions && (
          <div className="px-6 py-4 border-t border-border bg-surface/50 shrink-0 flex items-center justify-end gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
