import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Settings, Play, Copy, Edit2, Trash2, MoreVertical, Zap } from 'lucide-react';

export const NativeStepNode = memo(({ data, selected }: NodeProps) => {
  const node = data.node as any;
  const nodeImpl = data.nodeImpl as any;
  const runStatus = data.runStatus as string | undefined;

  const isTrigger = node.type.startsWith('trigger.');

  // Default color if nodeImpl doesn't provide one
  const color = nodeImpl?.color || '#52677D';
  const icon = nodeImpl?.iconName || (isTrigger ? 'zap' : 'box');

  let statusBorder = '';
  if (runStatus === 'SUCCEEDED') statusBorder = 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]';
  else if (runStatus === 'FAILED') statusBorder = 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
  else if (runStatus === 'RUNNING') statusBorder = 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]';

  return (
    <div className={`w-[240px] rounded-xl bg-surface border shadow-sm transition-all
      ${selected ? `ring-2 ring-[${color}] border-transparent` : 'border-border hover:shadow-md'}
      ${statusBorder}
      ${node.disabled ? 'opacity-50' : 'opacity-100'}
    `}>
      {/* Target handle for non-triggers */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-surface border-2 border-border"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        {/* Icon */}
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-inner"
          style={{ backgroundColor: color }}
        >
          {isTrigger ? <Zap className="w-5 h-5 text-white" /> : <Settings className="w-5 h-5 text-white" />}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase font-semibold text-text-muted tracking-wider truncate">
            {isTrigger ? 'Trigger' : nodeImpl?.displayName || node.type}
          </p>
          <p className={`text-sm font-medium text-text-main truncate ${node.disabled ? 'line-through' : ''}`}>
            {node.label || nodeImpl?.displayName || 'Unknown Node'}
          </p>
        </div>

        {/* Menu (Placeholder) */}
        <button className="p-1 hover:bg-bg rounded transition-colors text-text-muted shrink-0">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Output handles */}
      {nodeImpl?.outputHandles?.length > 0 ? (
        nodeImpl.outputHandles.map((handle: any, i: number) => {
          // Spread them out if multiple
          const leftPercent = nodeImpl.outputHandles.length === 1 ? 50 : 25 + (50 * i) / (nodeImpl.outputHandles.length - 1);
          return (
            <Handle
              key={handle.id}
              type="source"
              position={Position.Bottom}
              id={handle.id}
              style={{ left: `${leftPercent}%` }}
              className="w-3 h-3 bg-surface border-2 border-border z-10"
            >
              <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap">
                {handle.label}
              </span>
            </Handle>
          );
        })
      ) : (
        /* Default single output handle */
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-surface border-2 border-border z-10"
        />
      )}
    </div>
  );
});
