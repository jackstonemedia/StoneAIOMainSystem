import { X, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useWorkflowRun } from '../../../hooks/useWorkflows';
import type { WorkflowRun, RunStatus } from '../../../types/automation';
import React from 'react';

const STATUS_ICON: Record<RunStatus, React.ReactNode> = {
  SUCCEEDED:      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  FAILED:         <XCircle className="w-3.5 h-3.5 text-red-400" />,
  RUNNING:        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
  PAUSED:         <Clock className="w-3.5 h-3.5 text-yellow-400" />,
  STOPPED:        <Clock className="w-3.5 h-3.5 text-text-muted" />,
  INTERNAL_ERROR: <XCircle className="w-3.5 h-3.5 text-red-600" />,
};

const STATUS_LABEL: Record<RunStatus, string> = {
  SUCCEEDED:      'Success',
  FAILED:         'Failed',
  RUNNING:        'Running',
  PAUSED:         'Paused',
  STOPPED:        'Stopped',
  INTERNAL_ERROR: 'System Error',
};

const STATUS_COLOR: Record<RunStatus, string> = {
  SUCCEEDED:      'text-green-400 bg-green-500/10',
  FAILED:         'text-red-400 bg-red-500/10',
  RUNNING:        'text-blue-400 bg-blue-500/10',
  PAUSED:         'text-yellow-400 bg-yellow-500/10',
  STOPPED:        'text-text-muted bg-surface',
  INTERNAL_ERROR: 'text-red-600 bg-red-600/10',
};

interface Props {
  workflowId: string;
  runs: WorkflowRun[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onClose: () => void;
}

export function APRunLogDrawer({ workflowId, runs, selectedRunId, onSelectRun, onClose }: Props) {
  // Select first run automatically if none selected
  React.useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      onSelectRun(runs[0].id);
    }
  }, [selectedRunId, runs, onSelectRun]);

  const { data: runDetail, isLoading } = useWorkflowRun(workflowId, selectedRunId ?? '');

  return (
    <div className="fixed inset-y-0 right-0 w-[620px] bg-surface border-l border-border flex flex-col shadow-2xl z-50 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div>
          <h2 className="font-semibold text-text-main">Run History</h2>
          <p className="text-xs text-text-muted mt-0.5">{runs.length} runs total</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-bg rounded-lg transition-colors">
          <X className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Run list */}
        <div className="w-52 border-r border-border overflow-y-auto shrink-0">
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Clock className="w-5 h-5 text-text-muted" />
              <p className="text-xs text-text-muted text-center">No runs yet.<br/>Hit Test to run.</p>
            </div>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => onSelectRun(run.id)}
                className={`w-full flex items-center gap-2 p-3 text-left border-b border-border hover:bg-bg transition-colors ${
                  selectedRunId === run.id ? 'bg-bg border-l-2 border-l-accent' : ''
                }`}
              >
                {STATUS_ICON[run.status as RunStatus]}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${STATUS_COLOR[run.status as RunStatus]?.split(' ')[0]}`}>
                    {STATUS_LABEL[run.status as RunStatus]}
                  </div>
                  <div className="text-[10px] text-text-muted truncate">
                    {new Date(run.startTime).toLocaleString()}
                  </div>
                  {run.duration && (
                    <div className="text-[9px] text-text-muted">{run.duration}ms</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Run detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
            </div>
          ) : !runDetail ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <p className="text-sm text-text-muted">Select a run to view details</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Run summary */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border border-border ${STATUS_COLOR[runDetail.status]?.split(' ')[1]}`}>
                {STATUS_ICON[runDetail.status]}
                <div>
                  <span className="text-sm font-medium text-text-main">
                    {STATUS_LABEL[runDetail.status]}
                  </span>
                  {runDetail.duration && (
                    <span className="text-xs text-text-muted ml-2">{runDetail.duration}ms</span>
                  )}
                </div>
                <div className="ml-auto text-xs text-text-muted">
                  {new Date(runDetail.startTime).toLocaleString()}
                </div>
              </div>

              {/* Steps */}
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Step Results ({Object.keys(runDetail.steps ?? {}).length} steps)
              </p>
              {Object.entries(runDetail.steps ?? {}).map(([stepName, stepDetail]) => (
                <StepDetail key={stepName} name={stepName} step={stepDetail} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDetail({ name, step }: { name: string; step: any }) {
  const [expanded, setExpanded] = useState(step.status === 'FAILED');
  const isOk = step.status === 'SUCCEEDED';
  const isFail = step.status === 'FAILED';

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-bg transition-colors text-left"
      >
        {isOk
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
          : isFail
          ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          : <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
        }
        <span className="flex-1 text-sm font-medium text-text-main">{step.name ?? name}</span>
        {step.duration && (
          <span className="text-xs text-text-muted">{step.duration}ms</span>
        )}
        {expanded ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
      </button>

      {expanded && (
        <div className="border-t border-border bg-bg p-3 space-y-3">
          {step.errorMessage && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 font-mono whitespace-pre-wrap">
              {step.errorMessage}
            </div>
          )}
          {step.input && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Input</p>
              <pre className="text-xs font-mono text-text-main bg-surface p-2 rounded overflow-x-auto max-h-40 border border-border">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          )}
          {step.output && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Output</p>
              <pre className="text-xs font-mono text-text-main bg-surface p-2 rounded overflow-x-auto max-h-40 border border-border">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
