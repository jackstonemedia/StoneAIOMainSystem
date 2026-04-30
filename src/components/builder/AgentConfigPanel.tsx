import { Box, Database, Plus, X } from 'lucide-react';

interface AgentConfigPanelProps {
  attachedTools: string[];
  onRemoveTool: (index: number) => void;
}

export default function AgentConfigPanel({ attachedTools, onRemoveTool }: AgentConfigPanelProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Attached Tools */}
      <div className="bg-surface/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Box className="w-4 h-4 text-green" /> Attached Tools
          </h3>
          <button className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {attachedTools.map((tool, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-bg border border-border rounded-lg group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-green/10 flex items-center justify-center text-green shrink-0">
                  <Box className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{tool}</span>
              </div>
              <button
                onClick={() => onRemoveTool(i)}
                className="text-text-muted hover:text-red transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="bg-surface/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 text-amber" /> Knowledge Base
          </h3>
          <button className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg bg-bg text-center px-4">
          <Database className="w-6 h-6 text-text-muted mb-2" />
          <p className="text-xs text-text-muted">
            No knowledge sources attached. Add documents or URLs to give your agent context.
          </p>
        </div>
      </div>
    </div>
  );
}
