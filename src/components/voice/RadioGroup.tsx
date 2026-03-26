interface RadioOption {
  value: string;
  label: string;
  badge?: string;
}

interface RadioGroupProps {
  label: string;
  options: RadioOption[];
  value: string;
  onChange: (v: string) => void;
  description?: string;
}

export default function RadioGroup({ label, options, value, onChange, description }: RadioGroupProps) {
  return (
    <div>
      <span className="text-xs font-medium text-text-main block mb-2">{label}</span>
      {description && <p className="text-[10px] text-text-muted mb-2">{description}</p>}
      <div className="space-y-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${value === opt.value ? 'border-primary' : 'border-border group-hover:border-text-muted'}`}>
              {value === opt.value && <span className="w-2 h-2 rounded-full bg-primary" />}
            </span>
            <span className="text-xs text-text-main">{opt.label}</span>
            {opt.badge && (
              <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">{opt.badge}</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
