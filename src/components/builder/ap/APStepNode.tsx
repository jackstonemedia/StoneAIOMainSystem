import { type NodeProps, Handle, Position } from '@xyflow/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { WorkflowNodeData } from '../../../types/automation';

const STEP_TYPE_COLORS: Record<string, string> = {
  TRIGGER:       'border-purple-500/60 bg-purple-500/10',
  PIECE:         'border-blue-500/60 bg-blue-500/10',
  CODE:          'border-orange-500/60 bg-orange-500/10',
  LOOP_ON_ITEMS: 'border-cyan-500/60 bg-cyan-500/10',
  BRANCH:        'border-yellow-500/60 bg-yellow-500/10',
};

const STEP_TYPE_ACCENT: Record<string, string> = {
  TRIGGER:       'text-purple-400',
  PIECE:         'text-blue-400',
  CODE:          'text-orange-400',
  LOOP_ON_ITEMS: 'text-cyan-400',
  BRANCH:        'text-yellow-400',
};

export function APStepNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as WorkflowNodeData;
  const step = data.step;
  const colors = STEP_TYPE_COLORS[step.type] ?? 'border-border bg-surface';
  const accent = STEP_TYPE_ACCENT[step.type] ?? 'text-text-muted';
  const isTrigger = step.type === 'TRIGGER';

  return (
    <div
      className={`
        border-2 ${colors} rounded-xl p-3 w-60 shadow-sm
        ${selected ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''}
        transition-all cursor-pointer
      `}
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          id="target"
          className="!w-3 !h-3 !bg-accent !border-2 !border-bg !z-50"
        />
      )}

      <div className="flex items-start gap-2.5">
        {/* Piece logo or fallback */}
        <div className={`w-8 h-8 rounded-lg border ${colors} flex items-center justify-center shrink-0`}>
          {data.pieceMetadata?.logoUrl ? (
            <img src={data.pieceMetadata.logoUrl} alt="" className="w-5 h-5 object-contain" />
          ) : (
            <span className={`text-xs font-bold ${accent}`}>
              {step.type.slice(0, 2)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] uppercase tracking-wider font-medium ${accent} mb-0.5`}>
            {step.type === 'TRIGGER' ? 'Trigger' : step.type.replace(/_/g, ' ')}
          </div>
          <div className="text-sm font-semibold text-text-main truncate">{step.displayName}</div>
          {step.settings.pieceName && (
            <div className="text-xs text-text-muted truncate mt-0.5">
              {step.settings.pieceName.replace('@activepieces/piece-', '')}
              {step.settings.actionName && ` · ${step.settings.actionName}`}
            </div>
          )}
        </div>
        {/* Valid/Status indicator */}
        <div className="shrink-0 mt-0.5 flex flex-col items-end gap-1">
          {step.valid
            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            : <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
          }
          {data.runStatus === 'SUCCEEDED' && <div className="bg-green-500 text-white rounded text-[9px] font-bold px-1 py-0.5">✅</div>}
          {data.runStatus === 'FAILED' && <div className="bg-red-500 text-white rounded text-[9px] font-bold px-1 py-0.5">❌</div>}
          {data.runStatus === 'SKIPPED' && <div className="bg-text-muted text-white rounded text-[9px] font-bold px-1 py-0.5">⏭</div>}
          {data.runStatus === 'RUNNING' && <div className="bg-blue-500 text-white rounded text-[9px] font-bold px-1 py-0.5 animate-pulse">⚙️</div>}
        </div>
      </div>

      {step.type === 'BRANCH' ? (
        <>
          <span className="text-[9px] font-bold text-green-500 absolute -bottom-5 left-[20%] transform -translate-x-1/2">TRUE</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!w-4 !h-4 !bg-green-500 !border-2 !border-bg !z-50"
            style={{ left: '20%' }}
          />
          <span className="text-[9px] font-bold text-red-400 absolute -bottom-5 left-[80%] transform -translate-x-1/2">FALSE</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-4 !h-4 !bg-red-400 !border-2 !border-bg !z-50"
            style={{ left: '80%' }}
          />
        </>
      ) : step.type === 'LOOP_ON_ITEMS' ? (
        <>
          <span className="text-[9px] font-bold text-cyan-400 absolute -bottom-5 left-[30%] transform -translate-x-1/2">LOOP</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="loop"
            className="!w-4 !h-4 !bg-cyan-400 !border-2 !border-bg !z-50"
            style={{ left: '30%' }}
          />
          <span className="text-[9px] font-bold text-text-muted absolute -bottom-5 left-[70%] transform -translate-x-1/2">NEXT</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="next"
            className="!w-3 !h-3 !bg-accent !border-2 !border-bg !z-50"
            style={{ left: '70%' }}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className="!w-3 !h-3 !bg-accent !border-2 !border-bg !z-50"
        />
      )}
    </div>
  );
}
