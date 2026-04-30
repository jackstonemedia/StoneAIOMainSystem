import { NodeProps, Handle, Position } from '@xyflow/react';
import { Box } from 'lucide-react';
import { WORKFLOW_NODES } from '../../data/workflowNodes';

export const WorkflowCustomNode = ({ data }: NodeProps) => {
  const def = WORKFLOW_NODES.find(n => n.id === data.nodeDefId);
  const Icon = def ? def.icon : Box;
  const color = def ? def.colorClass : 'text-text-muted';
  const border = def ? def.colorClass.replace('text-', 'border-') : 'border-border';
  
  const hasInput = def ? def.category !== 'Triggers' : true;
  const hasOutput = def ? def.type !== 'output' : true;

  return (
    <div className={`bg-surface border-2 ${border} rounded-lg p-4 shadow-sm w-56 group hover:shadow-md transition-all`}>
      {hasInput && <Handle type="target" position={Position.Left} className={`w-3 h-3 ${def?.bgClass} border-2 border-bg`} />}
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${def?.bgClass} ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-sm">{def ? def.name : 'Unknown Node'}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">{def ? def.category : ''}</div>
        </div>
      </div>
      <div className="text-xs text-text-main font-medium mt-3 bg-bg/50 p-2 rounded border border-border/50 truncate">
        {data.label as string}
      </div>
      {hasOutput && <Handle type="source" position={Position.Right} className={`w-3 h-3 ${def?.bgClass} border-2 border-bg`} />}
    </div>
  );
};
