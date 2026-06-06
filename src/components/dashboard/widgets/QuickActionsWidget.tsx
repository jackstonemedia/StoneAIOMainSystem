import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Mail,
  DollarSign,
  CheckSquare,
  Zap,
  Mic,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { WidgetShell } from '../WidgetShell';

interface QuickActionsWidgetProps {
  isEditing?: boolean;
  onRemove?: () => void;
}

const ACTIONS = [
  { label: 'Add Contact', icon: UserPlus, path: '/crm/contacts?new=true' },
  { label: 'New Campaign', icon: Mail, path: '/business/campaigns?new=true' },
  { label: 'Add Deal', icon: DollarSign, path: '/crm/pipeline?new=true' },
  { label: 'Add Task', icon: CheckSquare, path: '/crm/tasks?new=true' },
  { label: 'New Workflow', icon: Zap, path: '/workflows?new=true' },
  { label: 'New Voice Agent', icon: Mic, path: '/agents/voice/new' },
  { label: 'Open Inbox', icon: MessageSquare, path: '/conversations' },
  { label: 'Analytics', icon: BarChart3, path: '/business/analytics' },
];

export function QuickActionsWidget({ isEditing, onRemove }: QuickActionsWidgetProps) {
  const navigate = useNavigate();

  return (
    <WidgetShell
      title="Quick Actions"
      subtitle="Jump into common workflows"
      isEditing={isEditing}
      onRemove={onRemove}
      noPadding
    >
      <div className="p-4 grid grid-cols-3 gap-3">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => navigate(a.path)}
            className="flex flex-col items-center gap-2 p-3 text-center rounded-lg border border-border bg-surface/80 hover:border-primary/70 hover:bg-surface-hover transition-all"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
              <a.icon className="w-4 h-4" />
            </div>
            <span className="text-[12px] font-medium text-text-main truncate">{a.label}</span>
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}
