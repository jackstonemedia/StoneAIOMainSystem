import { ReactNode } from 'react';

interface ToggleFieldProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  children?: ReactNode;
}

export default function ToggleField({ label, checked, onChange, description, children }: ToggleFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <span className="text-xs font-medium text-text-main">{label}</span>
          {description && <p className="text-[10px] text-text-muted mt-0.5">{description}</p>}
        </div>
        <button
          onClick={() => onChange(!checked)}
          className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${checked ? 'bg-primary' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {checked && children && (
        <div className="mt-3 ml-2 pl-3 border-l-2 border-primary/20 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}
