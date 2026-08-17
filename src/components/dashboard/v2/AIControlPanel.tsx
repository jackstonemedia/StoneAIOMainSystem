import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Sparkles,
  Mail,
  UserPlus,
  ListTodo,
  TrendingUp,
  MessageSquare,
  Megaphone,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';

interface AIAction {
  id: string;
  toolName: string;
  args: Record<string, any>;
  label: string;
  status: 'pending' | 'approved' | 'rejected';
  result?: Record<string, any> | null;
  chatContext?: string | null;
  createdAt: string;
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  create_contact: UserPlus,
  update_contact: UserPlus,
  create_deal: TrendingUp,
  create_task: ListTodo,
  send_email: Mail,
  send_sms: MessageSquare,
  create_campaign: Megaphone,
};

const TOOL_COLORS: Record<string, string> = {
  create_contact: '#22d3ee',
  update_contact: '#22d3ee',
  create_deal: '#a78bfa',
  create_task: '#fb923c',
  send_email: '#34d399',
  send_sms: '#f472b6',
  create_campaign: '#60a5fa',
};

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending Review', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  approved: { label: 'Approved', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  rejected: { label: 'Rejected', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

function ActionCard({ action, onApprove, onReject }: {
  action: AIAction;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const Icon = TOOL_ICONS[action.toolName] ?? Bot;
  const color = TOOL_COLORS[action.toolName] ?? 'var(--primary)';
  const badge = STATUS_BADGE[action.status];

  const handleApprove = async () => {
    setApproving(true);
    await onApprove(action.id);
    setApproving(false);
  };

  const handleReject = async () => {
    setRejecting(true);
    await onReject(action.id);
    setRejecting(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div
          className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center mt-0.5"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[14px] font-semibold leading-snug" style={{ color: 'var(--text-main)' }}>
              {action.label}
            </p>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{ color: badge.color, background: badge.bg }}
            >
              {badge.label}
            </span>
          </div>

          {action.chatContext && (
            <p className="text-[12px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
              From: "{action.chatContext}"
            </p>
          )}

          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {new Date(action.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/5 shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded args */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-0">
              <div
                className="rounded-lg p-3 text-[12px] font-mono leading-relaxed"
                style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(action.args, null, 2)}
                </pre>
              </div>
              {action.result && (
                <div className="mt-2">
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Result:</p>
                  <div
                    className="rounded-lg p-3 text-[12px] font-mono leading-relaxed"
                    style={{ background: 'rgba(52,211,153,0.05)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}
                  >
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(action.result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons — only for pending */}
      {action.status === 'pending' && (
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={handleApprove}
            disabled={approving || rejecting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-60 active:scale-[0.98]"
            style={{
              background: 'rgba(52,211,153,0.12)',
              color: '#34d399',
              border: '1px solid rgba(52,211,153,0.25)',
            }}
          >
            {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {approving ? 'Approving…' : 'Approve & Execute'}
          </button>
          <button
            onClick={handleReject}
            disabled={approving || rejecting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-60 active:scale-[0.98]"
            style={{
              background: 'rgba(248,113,113,0.1)',
              color: '#f87171',
              border: '1px solid rgba(248,113,113,0.2)',
            }}
          >
            {rejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            {rejecting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      )}
    </motion.div>
  );
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export function AIControlPanel() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>('all');

  const fetchActions = useCallback(async (): Promise<AIAction[]> => {
    const res = await apiFetch('/api/ai/actions');
    const body = await res.json();
    return body.actions ?? [];
  }, []);

  const { data: actions = [], isLoading, isError, refetch } = useQuery<AIAction[]>({
    queryKey: ['ai-actions'],
    queryFn: fetchActions,
    refetchInterval: 10_000, // poll every 10s
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/ai/actions/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Approve failed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-actions'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/ai/actions/${id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Reject failed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-actions'] }),
  });

  const filtered = filter === 'all' ? actions : actions.filter(a => a.status === filter);
  const pendingCount = actions.filter(a => a.status === 'pending').length;

  const filterTabs: { id: FilterStatus; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <div
      className="rounded-[10px] border overflow-hidden flex flex-col"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', minHeight: 360 }}
    >
      {/* Panel header */}
      <div
        className="px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' }}
          >
            <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-main)' }}>AI Control Panel</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Review and approve AI-proposed CRM actions
            </p>
          </div>
          {pendingCount > 0 && (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full ml-1"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>

        <button
          onClick={() => refetch()}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5"
          style={{ color: 'var(--text-muted)' }}
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-1 px-4 py-2 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className="px-3 py-1 rounded-md text-[12px] font-medium transition-colors"
            style={filter === tab.id
              ? { background: 'var(--primary)', color: '#fff' }
              : { color: 'var(--text-muted)' }
            }
          >
            {tab.label}
            {tab.id === 'pending' && pendingCount > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                style={{ background: filter === 'pending' ? 'rgba(255,255,255,0.25)' : 'rgba(251,191,36,0.2)', color: filter === 'pending' ? '#fff' : '#fbbf24' }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading AI actions…</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-5 h-5" style={{ color: '#f87171' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Failed to load actions</p>
            <button onClick={() => refetch()} className="text-[12px]" style={{ color: 'var(--primary)' }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' }}
            >
              <Clock className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-main)' }}>
                {filter === 'pending' ? 'No pending actions' : 'No actions yet'}
              </p>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Ask Stone AI to create contacts, campaigns, deals, or tasks
                — they'll appear here for your approval.
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filtered.map(action => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onApprove={id => approveMutation.mutateAsync(id)}
                  onReject={id => rejectMutation.mutateAsync(id)}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
