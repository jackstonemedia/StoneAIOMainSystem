import { Handle, Position } from '@xyflow/react';
import { Mic } from 'lucide-react';

export function VoiceNode({ data }: { data: any }) {
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-text-muted border-2 border-surface" />
      <div className="flex items-center gap-3 p-3 border-b border-border">
        <div className="w-8 h-8 rounded-md bg-light-purple/10 flex items-center justify-center shrink-0">
          <Mic className="w-4 h-4 text-light-purple" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-text-main truncate">{data.label}</p>
          <p className="text-xs text-text-muted truncate">Voice Agent</p>
        </div>
      </div>
      <div className="p-3 bg-bg/50 text-xs text-text-muted rounded-b-lg">
        {data.input?.prompt || 'No system prompt defined'}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-text-muted border-2 border-surface" />
    </div>
  );
}
