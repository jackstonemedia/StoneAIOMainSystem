import { useState, useEffect } from 'react';
import { X, Save, Copy, Trash2, TestTube2, AlertTriangle } from 'lucide-react';

export function NativeConfigPanel({
  node,
  nodeImpl,
  onUpdate,
  onClose,
  onDelete,
  onDuplicate,
  onTestNode
}: {
  node: any;
  nodeImpl: any;
  onUpdate: (node: any) => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTestNode: () => void;
}) {
  const [localNode, setLocalNode] = useState(node);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    setLocalNode(node);
    setTestResult(null);
  }, [node]);

  const handleChange = (field: string, value: any) => {
    setLocalNode((prev: any) => ({
      ...prev,
      data: {
        ...prev.data,
        config: { ...prev.data.config, [field]: value }
      }
    }));
  };

  const handleSave = () => {
    onUpdate(localNode);
  };

  const handleTestClick = async () => {
    setIsTesting(true);
    try {
      await onTestNode();
      setTestResult({ success: true, message: 'Test completed' });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const schemaProps = Object.entries(nodeImpl?.configSchema?.properties || {});

  return (
    <div className="w-96 border-l border-border bg-surface flex flex-col h-full z-10 shrink-0">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg/50 shrink-0">
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner text-white"
            style={{ backgroundColor: nodeImpl?.color || '#52677D' }}
          >
            {/* simple initial or icon */}
            {nodeImpl?.displayName?.charAt(0) || '?'}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-main truncate w-40">{localNode.label}</h3>
            <p className="text-xs text-text-muted">{nodeImpl?.displayName || 'Unknown'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Name override */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-main uppercase tracking-wider">Node Name</label>
          <input
            type="text"
            value={localNode.label}
            onChange={(e) => setLocalNode({ ...localNode, label: e.target.value })}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Dynamic Config Form based on Schema */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-text-main uppercase tracking-wider border-b border-border pb-1">Configuration</h4>
          
          {schemaProps.length === 0 ? (
            <p className="text-xs text-text-muted">No configuration required for this node.</p>
          ) : (
            schemaProps.map(([key, prop]: [string, any]) => {
              const value = localNode.data?.config?.[key] ?? prop.default ?? '';
              
              if (prop.enum) {
                return (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-medium text-text-main">{prop.title || key}</label>
                    <select
                      value={value}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-primary"
                    >
                      <option value="">Select option...</option>
                      {prop.enum.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {prop.description && <p className="text-[10px] text-text-muted">{prop.description}</p>}
                  </div>
                );
              }

              if (prop.type === 'boolean') {
                return (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={key}
                      checked={!!value}
                      onChange={(e) => handleChange(key, e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary bg-bg"
                    />
                    <label htmlFor={key} className="text-xs font-medium text-text-main">{prop.title || key}</label>
                  </div>
                );
              }
              
              return (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-text-main">{prop.title || key}</label>
                  <input
                    type={prop.type === 'number' ? 'number' : 'text'}
                    value={value}
                    onChange={(e) => handleChange(key, prop.type === 'number' ? Number(e.target.value) : e.target.value)}
                    placeholder={prop.default ? `Default: ${prop.default}` : ''}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-primary font-mono"
                  />
                  {prop.description && <p className="text-[10px] text-text-muted">{prop.description}</p>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border bg-bg/50 space-y-3">
        {testResult && (
          <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${testResult.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {testResult.message}
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Save className="w-4 h-4" />
            Apply Changes
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <button 
            onClick={handleTestClick}
            disabled={isTesting || localNode.type.startsWith('trigger.')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-main bg-surface border border-border rounded-md hover:bg-bg transition-colors disabled:opacity-50"
            title="Test this node with dummy data"
          >
            <TestTube2 className="w-3.5 h-3.5" />
            {isTesting ? 'Testing...' : 'Test Step'}
          </button>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={onDuplicate}
              className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface rounded-md transition-colors"
              title="Duplicate"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onDelete}
              className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
