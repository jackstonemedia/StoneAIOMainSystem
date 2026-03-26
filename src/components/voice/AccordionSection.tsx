import { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionSectionProps {
  id: string;
  icon: ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

export default function AccordionSection({ id, icon, title, isOpen, onToggle, children }: AccordionSectionProps) {
  return (
    <div className="border-b border-border">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-4 hover:bg-bg/50 transition-colors focus:outline-none"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text-main">
          {icon}
          {title}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
