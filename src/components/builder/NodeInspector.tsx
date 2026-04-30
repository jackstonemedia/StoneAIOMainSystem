import React from 'react';
import { Settings, X } from 'lucide-react';
import { WORKFLOW_NODES, ConfigField } from '../../data/workflowNodes';

interface NodeInspectorProps {
  selectedNode: any;
  setSelectedNode: (node: any) => void;
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  showAdvanced: boolean;
}

export default function NodeInspector({ selectedNode, setSelectedNode, setNodes, showAdvanced }: NodeInspectorProps) {
  if (!selectedNode) return null;

  const def = WORKFLOW_NODES.find(n => n.id === selectedNode.data.nodeDefId);

  const updateField = (key: string, val: any) => {
    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: val } } : n));
    setSelectedNode((prev: any) => ({ ...prev, data: { ...prev.data, [key]: val } }));
  };

  const renderField = (field: ConfigField) => {
    const val = selectedNode.data[field.key] ?? field.default;
    const inputCls = 'w-full px-3 py-2 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

    switch (field.type) {
      case 'select':
        return (
          <select value={val} onChange={e => updateField(field.key, e.target.value)} className={inputCls}>
            {(field.options || []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        );
      case 'toggle':
        return (
          <button
            onClick={() => updateField(field.key, !val)}
            className={`relative w-10 h-5 rounded-full transition-colors ${val ? 'bg-primary' : 'bg-border'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-transform ${val ? 'left-5' : 'left-0.5'}`} />
          </button>
        );
      case 'textarea':
        return (
          <textarea
            value={val || ''}
            onChange={e => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={`${inputCls} resize-none`}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={val ?? ''}
            onChange={e => updateField(field.key, parseFloat(e.target.value) || 0)}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.max && field.validation.max <= 2 ? 0.1 : 1}
            className={inputCls}
          />
        );
      case 'code':
        return (
          <textarea
            value={val || ''}
            onChange={e => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={8}
            className={`${inputCls} font-mono text-xs resize-y bg-[#1e1e1e] text-[#d4d4d4] border-[#333]`}
          />
        );
      default:
        return (
          <input
            type="text"
            value={val || ''}
            onChange={e => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={inputCls}
          />
        );
    }
  };

  return (
    <aside className="w-80 border-l border-border/50 bg-surface/40 backdrop-blur-xl flex flex-col shrink-0 z-10 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-200">
        <div className="p-4 border-b border-border flex items-center justify-between bg-bg/50">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-text-muted" /> Node Settings
          </h2>
          <button onClick={() => setSelectedNode(null)} className="text-text-muted hover:text-text-main p-1 rounded-md hover:bg-surface-hover">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Node Name</label>
            <input 
              type="text" 
              value={selectedNode.data.label} 
              onChange={(e) => {
                setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n));
                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, label: e.target.value } });
              }}
              className="w-full px-3 py-2 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {def && <p className="text-xs text-text-muted pb-2 border-b border-border">{def.description}</p>}

          {def && def.configFields
            .filter(f => {
              if (f.advanced && !showAdvanced) return false;
              if (f.dependsOn) return selectedNode.data[f.dependsOn.field] === f.dependsOn.value;
              return true;
            })
            .map(field => (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-text-main">
                    {field.label} {field.required && <span className="text-red">*</span>}
                  </label>
                  {field.advanced && <span className="text-[9px] uppercase tracking-wider text-amber border border-amber/30 bg-amber/10 px-1.5 py-0.5 rounded">Advanced</span>}
                </div>
                {field.description && <p className="text-[10px] text-text-muted leading-tight mb-1">{field.description}</p>}
                {renderField(field)}
              </div>
            ))
          }
        </div>
      </div>
    </aside>
  );
}
