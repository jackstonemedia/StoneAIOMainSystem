// @ts-nocheck
import React from 'react';
import { Settings, X, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { WORKFLOW_NODES } from '../../data/workflowNodes';

interface NodeInspectorProps {
  selectedNode: any;
  setSelectedNode: (node: any) => void;
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  showAdvanced: boolean;
}

export default function NodeInspector({ selectedNode, setSelectedNode, setNodes, showAdvanced }: NodeInspectorProps) {
  if (!selectedNode) return null;

  const pieceName = selectedNode.data.nodeDefId;
  const isTrigger = selectedNode.data.type === 'TRIGGER' || pieceName?.includes('trigger');
  
  const pieceDataRaw = null;
  const isLoading = false;
  const connections: any[] = [];

  // Fallback to static mock node if Activepieces is offline
  const fallbackNode = WORKFLOW_NODES.find(n => n.id === pieceName);
  const pieceData = pieceDataRaw || (fallbackNode ? {
    name: fallbackNode.id,
    displayName: fallbackNode.name,
    description: fallbackNode.description,
    logoUrl: '',
    version: '1.0.0',
    actions: !isTrigger ? [{
      name: 'action',
      displayName: 'Default Action',
      description: 'Execute this node',
      props: fallbackNode.configFields.reduce((acc, f) => {
        acc[f.key] = {
          type: f.type === 'select' ? 'DROPDOWN' : f.type === 'toggle' ? 'CHECKBOX' : f.type === 'textarea' ? 'LONG_TEXT' : 'SHORT_TEXT',
          displayName: f.label,
          description: f.helpText,
          required: f.required || false,
          defaultValue: f.default,
          options: f.options ? { options: f.options } : undefined
        };
        return acc;
      }, {} as any)
    }] : [],
    triggers: isTrigger ? [{
      name: 'trigger',
      displayName: 'Default Trigger',
      description: 'Trigger this workflow',
      props: fallbackNode.configFields.reduce((acc, f) => {
        acc[f.key] = {
          type: f.type === 'select' ? 'DROPDOWN' : f.type === 'toggle' ? 'CHECKBOX' : f.type === 'textarea' ? 'LONG_TEXT' : 'SHORT_TEXT',
          displayName: f.label,
          description: f.helpText,
          required: f.required || false,
          defaultValue: f.default,
          options: f.options ? { options: f.options } : undefined
        };
        return acc;
      }, {} as any)
    }] : []
  } : null);

  const updateData = (updates: Record<string, any>) => {
    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, ...updates } } : n));
    setSelectedNode((prev: any) => ({ ...prev, data: { ...prev.data, ...updates } }));
  };

  const actionOptions = React.useMemo(() => {
    if (!pieceData) return [];
    const items = isTrigger ? pieceData.triggers : pieceData.actions;
    return Array.isArray(items) ? items : Object.values(items || {});
  }, [pieceData, isTrigger]);

  const selectedActionName = isTrigger ? selectedNode.data.triggerName : selectedNode.data.actionName;

  // Auto-select the first available action/trigger if none is selected
  React.useEffect(() => {
    if (!selectedActionName && actionOptions && actionOptions.length > 0) {
      if (isTrigger) {
        updateData({ triggerName: actionOptions[0].name, input: {} });
      } else {
        updateData({ actionName: actionOptions[0].name, input: {} });
      }
    }
  }, [selectedActionName, actionOptions, isTrigger]);

  const selectedActionDef = actionOptions?.find(a => a.name === selectedActionName);

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
        
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {isLoading ? (
            <div className="text-xs text-text-muted text-center py-6">Loading piece schema...</div>
          ) : !pieceData ? (
            <div className="text-xs text-red-400 text-center py-6">Failed to load piece data</div>
          ) : (
            <>
              {/* Basic Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg border border-border/50 bg-bg flex items-center justify-center">
                    {pieceData.logoUrl ? <img src={pieceData.logoUrl} alt="" className="w-6 h-6 object-contain" /> : <Settings className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-main leading-tight">{pieceData.displayName}</h3>
                    <p className="text-[10px] text-text-muted mt-0.5">v{pieceData.version}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Node Name</label>
                  <input 
                    type="text" 
                    value={selectedNode.data.label} 
                    onChange={(e) => updateData({ label: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {/* Action / Trigger Selection */}
              <div className="space-y-1.5 pt-3 border-t border-border">
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  {isTrigger ? 'Select Trigger' : 'Select Action'}
                </label>
                <div className="relative">
                  <select 
                    value={selectedActionName || ''} 
                    onChange={(e) => {
                      if (isTrigger) updateData({ triggerName: e.target.value, input: {} });
                      else updateData({ actionName: e.target.value, input: {} });
                    }}
                    className="w-full pl-3 pr-8 py-2.5 bg-bg border border-border rounded-md text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="" disabled>-- Choose an option --</option>
                    {actionOptions?.map((opt: any) => (
                      <option key={opt.name} value={opt.name}>{opt.displayName}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
                {selectedActionDef?.description && (
                  <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed">{selectedActionDef.description}</p>
                )}
              </div>

              {/* Dynamic Inputs */}
              {selectedActionDef && (
                <div className="space-y-4 pt-3 border-t border-border">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Configuration</h4>
                  
                  {/* Global Authentication for the Action if required */}
                  {(selectedActionDef.requireAuth !== false && (pieceData as any).auth) && (
                    <div className="space-y-1.5 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <label className="flex items-center justify-between text-xs font-semibold text-primary">
                        <span>Connection <span className="text-red-500">*</span></span>
                      </label>
                      <p className="text-[10px] text-text-muted leading-tight mb-1">Select an existing connection or authenticate a new one.</p>
                      <div className="relative">
                        <select 
                          value={(selectedNode.data.input || {}).connection || ''} 
                          onChange={(e) => {
                            if (e.target.value === 'new') {
                              alert('Connection Modal will open here. To bypass for testing, select an existing or dummy connection.');
                              updateData({ input: { ...(selectedNode.data.input || {}), connection: `conn_${Date.now()}` } });
                            } else {
                              updateData({ input: { ...(selectedNode.data.input || {}), connection: e.target.value } });
                            }
                          }}
                          className="w-full pl-3 pr-8 py-2 bg-bg border border-border rounded-md text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="" disabled>Select Connection...</option>
                          {connections.map((conn: any) => (
                            <option key={conn.name} value={conn.name}>{conn.displayName || conn.name}</option>
                          ))}
                          <option value="new">+ Create New Connection</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {Object.entries(selectedActionDef.props || {}).map(([key, prop]: [string, any]) => {
                    // Skip auth props if they are handled globally
                    if (['OAUTH2', 'CUSTOM_AUTH', 'SECRET_TEXT', 'BASIC_AUTH', 'API_KEY'].includes(prop.type) && (pieceData as any).auth) return null;

                    const val = (selectedNode.data.input || {})[key] ?? prop.defaultValue ?? '';
                    const setVal = (newVal: any) => updateData({ input: { ...(selectedNode.data.input || {}), [key]: newVal } });

                    return (
                      <div key={key} className="space-y-1.5">
                        <label className="flex items-center justify-between text-xs font-semibold text-text-main">
                          <span>{prop.displayName} {prop.required && <span className="text-red-500">*</span>}</span>
                        </label>
                        {prop.description && <p className="text-[10px] text-text-muted leading-tight mb-1">{prop.description}</p>}
                        
                        {prop.type === 'CHECKBOX' ? (
                          <button
                            onClick={() => setVal(!val)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${val ? 'bg-primary' : 'bg-border'}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-transform ${val ? 'left-5' : 'left-0.5'}`} />
                          </button>
                        ) : prop.type === 'DROPDOWN' || prop.type === 'STATIC_DROPDOWN' ? (
                          <div className="relative">
                            <select 
                              value={val} 
                              onChange={(e) => setVal(e.target.value)} 
                              className="w-full pl-3 pr-8 py-2 bg-bg border border-border rounded-md text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              <option value="" disabled>Select...</option>
                              {(prop.options?.options || []).map((opt: any) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                          </div>
                        ) : prop.type === 'LONG_TEXT' ? (
                          <textarea
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                          />
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            className="w-full px-3 py-2 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
