interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
  description?: string;
  unit?: string;
}

export default function SliderField({ label, value, onChange, min, max, step, displayValue, description, unit }: SliderFieldProps) {
  const display = displayValue ?? `${value}${unit || ''}`;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-text-main">{label}</span>
        <span className="text-xs font-mono text-text-muted bg-bg px-1.5 py-0.5 rounded">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary h-1.5 rounded-full appearance-none bg-border cursor-pointer"
      />
      {description && <p className="text-[10px] text-text-muted mt-1.5">{description}</p>}
    </div>
  );
}
