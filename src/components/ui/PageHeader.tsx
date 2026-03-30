import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  actions?: ReactNode;
  tabs?: { id: string; label: string; count?: number }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
}

export function PageHeader({
  title, subtitle, breadcrumb, actions, tabs, activeTab, onTabChange
}: PageHeaderProps) {
  return (
    <header className="shrink-0 border-b border-border bg-surface/80 backdrop-blur-sm">
      <div className="px-8 pt-6 pb-0">
        {breadcrumb && (
          <div className="flex items-center gap-1.5 mb-3">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-border text-xs">/</span>}
                <span className={`text-xs font-medium ${i === breadcrumb.length - 1 ? 'text-text-main' : 'text-text-muted hover:text-text-main cursor-pointer transition-colors'}`}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
          </div>
          {actions && (
            <div className="flex items-center gap-3 shrink-0">
              {actions}
            </div>
          )}
        </div>

        {tabs && (
          <div className="flex items-center gap-0 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab.id
                      ? 'bg-primary/15 text-primary'
                      : 'bg-surface-hover text-text-muted'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
