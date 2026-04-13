import { Calendar, MoreHorizontal, Building2, Tag } from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  amount: number | string;
  stage: string;
  closeDate?: string;
  priority?: 'low' | 'medium' | 'high';
  owner?: string;
  tags?: string[];
  company?: { name: string };
  probability?: number;
}

interface DealCardProps {
  deal: Deal;
  isDragging?: boolean;
  onClick?: () => void;
  onMenuClick?: (e: React.MouseEvent) => void;
}

const urgencyStripe = (deal: Deal) => {
  if (!deal.closeDate) return 'bg-blue-500';
  const daysToClose = Math.floor((new Date(deal.closeDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysToClose < 0) return 'bg-red-500';
  if (daysToClose <= 30) return 'bg-amber-500';
  return 'bg-green-500';
};

const urgencyLabel = (deal: Deal) => {
  if (!deal.closeDate) return null;
  const daysToClose = Math.floor((new Date(deal.closeDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysToClose < 0) return { label: 'Overdue', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
  if (daysToClose <= 30) return { label: `${daysToClose}d left`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  return null;
};

export default function DealCard({ deal, isDragging = false, onClick, onMenuClick }: DealCardProps) {
  const stripe = urgencyStripe(deal);
  const urgency = urgencyLabel(deal);
  const amount = typeof deal.amount === 'number' ? `$${deal.amount.toLocaleString()}` : deal.amount;
  const initials = (deal.company?.name || 'N').substring(0, 2).toUpperCase();

  return (
    <div
      onClick={onClick}
      className={`group bg-surface border rounded-xl p-4 cursor-pointer transition-all duration-200 shadow-sm relative overflow-hidden ${
        isDragging
          ? 'border-primary shadow-xl ring-2 ring-primary/20 scale-105 rotate-2 z-50'
          : 'border-border hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* Urgency color stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripe}`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3 pl-3">
        <div className="font-semibold text-sm text-text-main group-hover:text-primary transition-colors pr-4 leading-snug">
          {deal.title}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onMenuClick?.(e); }}
          className="text-text-muted hover:text-text-main opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-1 -mt-1 rounded-md hover:bg-surface-hover shrink-0"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Company */}
      <div className="flex items-center gap-2 mb-3 pl-3">
        <div className="w-5 h-5 rounded bg-bg border border-border flex items-center justify-center text-[9px] font-bold text-text-muted uppercase shrink-0">
          {initials}
        </div>
        <div className="text-xs font-medium text-text-muted truncate">{deal.company?.name || 'No Company'}</div>
      </div>

      {/* Tags */}
      {deal.tags && deal.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3 pl-3">
          {deal.tags.slice(0, 3).map(tag => (
            <span key={tag} className="flex items-center gap-0.5 text-[10px] font-medium bg-bg text-text-muted px-1.5 py-0.5 rounded-md border border-border">
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50 pl-3">
        <div className="font-bold text-sm text-text-main">{amount}</div>
        <div className="flex items-center gap-2">
          {urgency && (
            <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded-md ${urgency.color}`}>
              {urgency.label}
            </span>
          )}
          {deal.closeDate && !urgency && (
            <div className="flex items-center gap-1 text-xs font-medium text-text-muted">
              <Calendar className="w-3 h-3" />
              {new Date(deal.closeDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          )}
          {deal.owner && (
            <div
              className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold border border-primary/20"
              title={`Owner: ${deal.owner}`}
            >
              {deal.owner.charAt(0)}
            </div>
          )}
        </div>
      </div>

      {/* Probability bar */}
      {deal.probability !== undefined && (
        <div className="mt-2 pl-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-0.5 rounded-full bg-border/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${deal.probability}%` }}
              />
            </div>
            <span className="text-[10px] text-text-muted">{deal.probability}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
