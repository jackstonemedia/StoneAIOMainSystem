interface TagsInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  description?: string;
}

export default function TagsInput({ label, value, onChange, placeholder, description }: TagsInputProps) {
  return (
    <div>
      <span className="text-xs font-medium text-text-main block mb-2">{label}</span>
      {description && <p className="text-[10px] text-text-muted mb-2">{description}</p>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Split by comma. Example: Retell, Walmart'}
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-text-muted/50"
      />
    </div>
  );
}
