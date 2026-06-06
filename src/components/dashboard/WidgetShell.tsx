import type { ReactNode } from 'react';
import { EditLayoutOverlay } from './EditLayoutOverlay';

interface WidgetShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
  isEditing?: boolean;
  onRemove?: () => void;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function WidgetShell({
  title,
  subtitle,
  icon: Icon,
  actions,
  isEditing,
  onRemove,
  children,
  className = '',
  noPadding,
}: WidgetShellProps) {
  return (
    <div
      className={`card-surface rounded-xl border border-border/70 bg-surface/95 shadow-[var(--shadow-luxury)] overflow-hidden h-full flex flex-col relative transition-transform duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_24px_60px_rgba(0,0,0,0.55)] ${className}`}
    >
      {(title || actions || Icon || subtitle) && (
        <div className="px-5 pt-3.5 pb-2.5 flex items-center justify-between border-b border-border/60 bg-surface/95">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-hover border border-border/60 text-primary/80">
                <Icon className="w-3.5 h-3.5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-main)] truncate">{title}</div>
              {subtitle && (
                <div className="text-[11px] text-[var(--text-muted)] truncate">{subtitle}</div>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}

      <EditLayoutOverlay isEditing={isEditing} onRemove={onRemove} />

      <div className={`flex-1 overflow-hidden ${noPadding ? '' : 'p-5'}`}>
        {children}
      </div>
    </div>
  );
}
