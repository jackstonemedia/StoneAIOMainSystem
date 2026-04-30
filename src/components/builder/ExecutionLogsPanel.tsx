import { X, Zap } from 'lucide-react';

interface LogEntry {
  nodeId: string;
  status: 'running' | 'success' | 'error';
  time: string;
  message: string;
}

interface ExecutionLogsPanelProps {
  logs: LogEntry[];
  isExecuting: boolean;
  onClose: () => void;
}

export default function ExecutionLogsPanel({ logs, isExecuting, onClose }: ExecutionLogsPanelProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-64 bg-surface/95 backdrop-blur-xl border-t border-border z-40 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-5">
      <div className="p-3 border-b border-border flex items-center justify-between bg-bg/80">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-green" />
          <h3 className="text-sm font-semibold">Execution Logs</h3>
          {isExecuting && (
            <span className="flex h-2 w-2 relative ml-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
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

      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2">
        {logs.length === 0 && (
          <div className="text-text-muted flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Waiting for execution to start...
          </div>
        )}
        {logs.map((log, i) => (
          <div
            key={i}
            className={`flex items-start gap-4 p-2 rounded border ${
              log.status === 'running'
                ? 'border-primary/30 bg-primary/5 text-primary'
                : log.status === 'success'
                ? 'border-green/30 bg-green/5 text-green'
                : 'border-red/30 bg-red/5 text-red'
            }`}
          >
            <span className="text-text-muted shrink-0">[{log.time}]</span>
            <span className="flex-1 font-medium">{log.message}</span>
            {log.status === 'running' && <span className="animate-pulse">...</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
