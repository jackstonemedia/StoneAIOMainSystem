import { useState } from 'react';
import { X, ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Loader2, Play } from 'lucide-react';
import { useWorkflowRuns, useNativeWorkflowRunDetail } from '../../hooks/useWorkflows';
import type { NativeWorkflowRun } from '../../types/automation';

interface RunLogPanelProps {
  workflowId: string;
  onClose: () => void;
  onRunSelect?: (runId: string) => void;
  selectedRunId?: string | null;
  canvasNodes?: Array<{ id: string; data: any }>; // for labeling nodes
}

const STATUS_CONFIG = {
  SUCCEEDED: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', Icon: CheckCircle2 },
  FAILED:    { color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20',   Icon: XCircle },
  RUNNING:   { color: 'text-yellow-400',bg: 'bg-yellow-500/10',border: 'border-yellow-500/20',Icon: Loader2 },
  PAUSED:    { color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/20',  Icon: Clock },
  STOPPED:   { color: 'text-text-muted',bg: 'bg-surface',      border: 'border-border',       Icon: Clock },
};

export function RunLogPanel({ workflowId, onClose, onRunSelect, selectedRunId, canvasNodes }: RunLogPanelProps) {
  const { data: runsResponse } = useWorkflowRuns(workflowId);
  const runs: NativeWorkflowRun[] = (runsResponse as any)?.data ?? runsResponse ?? [];
  const { data: runDetail } = useNativeWorkflowRunDetail(selectedRunId ?? '');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Build per-node run data from runDetail
  const nodeRunData = runDetail?.runData ?? {};
  // Get node labels from canvas
  const nodeLabel = (nodeId: string) => {
    const n = canvasNodes?.find(cn => cn.id === nodeId);
    return n?.data?.node?.label ?? nodeId;
  };

  return (
    <div className="w-96 border-l border-border bg-surface flex flex-col h-full z-10 shrink-0">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg/50 shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-main">Run History</h3>
          {runs.length > 0 && (
            <span className="text-xs bg-accent/20 text-accent px-1.5 rounded-full">{runs.length}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Run list */}
      <div className="w-full overflow-y-auto border-b border-border" style={{ maxHeight: '280px' }}>
        {runs.length === 0 ? (
          <div className="p-6 text-center">
            <Play className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-sm text-text-muted">No runs yet. Click Test to execute.</p>
          </div>
        ) : (
          runs.map((run) => {
            const cfg = STATUS_CONFIG[run.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.STOPPED;
            const isSelected = selectedRunId === run.id;
            return (
              <button
                key={run.id}
                onClick={() => onRunSelect?.(run.id)}
                className={`w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-bg flex items-center gap-3 ${isSelected ? 'bg-accent/5 border-l-2 border-l-accent' : ''}`}
              >
                <cfg.Icon className={`w-4 h-4 shrink-0 ${cfg.color} ${run.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold ${cfg.color}`}>{run.status}</span>
                    <span className="text-[10px] text-text-muted">{formatDuration(run.durationMs)}</span>
                  </div>
                  <p className="text-[10px] text-text-muted truncate mt-0.5">{formatTime(run.startedAt)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Run detail */}
      {selectedRunId && runDetail && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Node Details</span>
          </div>

          {/* Error message at run level */}
          {runDetail.errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs font-semibold text-red-400 mb-1">Run Error</p>
              <p className="text-[10px] font-mono text-red-300">{runDetail.errorMessage}</p>
            </div>
          )}

          {/* Per-node cards */}
          {Object.entries(nodeRunData).map(([nodeId, items]) => {
            const isExpanded = expandedNodes.has(nodeId);
            const isFailed = !items || (items as any[])[0]?.json?._error;
            return (
              <div key={nodeId} className="bg-bg border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleNode(nodeId)}
                  className="w-full flex items-center gap-2 p-3 hover:bg-surface/50 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />}
                  <div className="flex-1 text-left">
                    <span className="text-xs font-medium text-text-main">{nodeLabel(nodeId)}</span>
                  </div>
                  {isFailed ? (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="border-t border-border p-3">
                    <p className="text-[10px] font-semibold text-text-muted mb-1 uppercase tracking-wider">Output</p>
                    <pre className="text-[10px] font-mono text-text-main overflow-auto max-h-48 whitespace-pre-wrap bg-surface rounded-md p-2">
                      {JSON.stringify(items, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(nodeRunData).length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">No node output data available for this run.</p>
          )}
        </div>
      )}
    </div>
  );
}
