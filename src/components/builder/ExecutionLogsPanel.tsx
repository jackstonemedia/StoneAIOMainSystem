import React, { useState } from 'react';
import { X, Zap, ChevronRight, Clock, AlertCircle, CheckCircle2, PlayCircle, Code } from 'lucide-react';
import { useWorkflowRuns, useWorkflowRun } from '../../hooks/useWorkflows';

interface ExecutionLogsPanelProps {
  flowId: string;
  onClose: () => void;
}

function RunDetailView({ workflowId, runId }: { workflowId: string, runId: string }) {
  const { data: runDetail, isLoading, error } = useWorkflowRun(workflowId, runId);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-4 text-xs text-text-muted flex items-center gap-2">
        <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Loading run details...
      </div>
    );
  }

  if (error || !runDetail) {
    return <div className="p-4 text-xs text-red">Could not load run details.</div>;
  }

  const steps = Object.entries(runDetail.steps || {});

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-4 border-b border-border pb-3">
        <h4 className="font-semibold text-sm">Run Detail: {runId.slice(-8)}</h4>
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-medium ${
          runDetail.status === 'SUCCEEDED' ? 'bg-green/10 text-green border border-green/20' :
          runDetail.status === 'FAILED' ? 'bg-red/10 text-red border border-red/20' :
          'bg-blue/10 text-blue border border-blue/20'
        }`}>
          {runDetail.status}
        </span>
        <span className="text-xs text-text-muted flex items-center gap-1">
          <Clock className="w-3 h-3" /> {runDetail.duration || 0}ms
        </span>
      </div>

      <div className="space-y-2">
        {steps.map(([stepName, stepData]: [string, any]) => (
          <div key={stepName} className="border border-border rounded-md bg-bg overflow-hidden">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-hover"
              onClick={() => setExpandedStep(expandedStep === stepName ? null : stepName)}
            >
              <div className="flex items-center gap-3">
                {stepData.status === 'SUCCEEDED' ? <CheckCircle2 className="w-4 h-4 text-green" /> :
                 stepData.status === 'FAILED' ? <AlertCircle className="w-4 h-4 text-red" /> :
                 <PlayCircle className="w-4 h-4 text-blue" />}
                <span className="font-medium text-sm">{stepName}</span>
                <span className="text-[10px] text-text-muted px-1.5 py-0.5 bg-surface border border-border rounded">{stepData.type}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span>{stepData.duration || 0}ms</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${expandedStep === stepName ? 'rotate-90' : ''}`} />
              </div>
            </div>

            {expandedStep === stepName && (
              <div className="p-3 border-t border-border bg-surface/50 space-y-3">
                {stepData.errorMessage && (
                  <div className="p-2 bg-red/10 border border-red/20 text-red text-xs rounded font-mono break-words">
                    {stepData.errorMessage}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-[10px] font-semibold text-text-muted uppercase mb-1 flex items-center gap-1">
                      <Code className="w-3 h-3" /> Input
                    </h5>
                    <pre className="bg-bg border border-border rounded p-2 text-[10px] font-mono overflow-auto max-h-32 text-text-main">
                      {JSON.stringify(stepData.input, null, 2) || 'null'}
                    </pre>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-semibold text-text-muted uppercase mb-1 flex items-center gap-1">
                      <Code className="w-3 h-3" /> Output
                    </h5>
                    <pre className="bg-bg border border-border rounded p-2 text-[10px] font-mono overflow-auto max-h-32 text-text-main">
                      {JSON.stringify(stepData.output, null, 2) || 'null'}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {steps.length === 0 && (
          <div className="text-xs text-text-muted p-2">No steps recorded for this run.</div>
        )}
      </div>
    </div>
  );
}

export default function ExecutionLogsPanel({ flowId, onClose }: ExecutionLogsPanelProps) {
  const { data: runs, isLoading, error } = useWorkflowRuns(flowId);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const formatRelativeTime = (isoString: string) => {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-80 bg-surface/95 backdrop-blur-xl border-t border-border z-40 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-5">
      <div className="p-3 border-b border-border flex items-center justify-between bg-bg/80 shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Execution Logs</h3>
          {(runs?.some((r: any) => r.status === 'RUNNING') || isLoading) && (
            <span className="flex h-2 w-2 relative ml-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-main p-1 rounded-md hover:bg-surface-hover"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left pane: Run List */}
        <div className="w-1/3 border-r border-border overflow-y-auto bg-bg/30">
          {isLoading && !runs && (
            <div className="p-4 text-xs text-text-muted flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Loading runs...
            </div>
          )}
          
          {error && (
            <div className="p-4 text-xs text-red">
              Could not load execution logs.
            </div>
          )}

          {runs && runs.length === 0 && (
            <div className="p-4 text-xs text-text-muted">
              No executions yet. Run the workflow to see logs here.
            </div>
          )}

          <div className="divide-y divide-border/50">
            {runs?.map((run: any) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                className={`w-full text-left p-3 hover:bg-surface-hover transition-colors flex flex-col gap-2 ${selectedRunId === run.id ? 'bg-surface border-l-2 border-l-primary' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium">{run.id.slice(-8)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    run.status === 'SUCCEEDED' ? 'bg-green/10 text-green border border-green/20' :
                    run.status === 'FAILED' ? 'bg-red/10 text-red border border-red/20' :
                    'bg-blue/10 text-blue border border-blue/20'
                  }`}>
                    {run.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-text-muted">
                  <span>{formatRelativeTime(run.startTime)}</span>
                  <span>{run.duration || 0}ms</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right pane: Run Details */}
        <div className="w-2/3 bg-surface/20 flex flex-col relative overflow-hidden">
          {selectedRunId ? (
            <RunDetailView workflowId={flowId} runId={selectedRunId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
              Select a run from the list to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
