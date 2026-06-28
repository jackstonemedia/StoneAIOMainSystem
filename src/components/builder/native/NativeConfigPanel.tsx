import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, Copy, Trash2, TestTube2, Braces, Zap, History, AlertTriangle } from 'lucide-react';
import { useChannelConnections } from '../../../hooks/useConversations';
import { channelConnectionsApi } from '../../../lib/api/conversations';

// ─── Inline Autocomplete ──────────────────────────────────────────────────────
// Appears right below an input/textarea when the user types {{

const STANDARD_VARS = [
  { label: 'Email', path: '$trigger.data.email' },
  { label: 'First Name', path: '$trigger.data.firstName' },
  { label: 'Last Name', path: '$trigger.data.lastName' },
  { label: 'Phone', path: '$trigger.data.phone' },
  { label: 'Record ID', path: '$trigger.data.id' },
  { label: 'Event Type', path: '$trigger.eventType' },
  { label: 'Trigger Event', path: '$trigger.event' },
  { label: 'Now (ISO)', path: '$now' },
];

function VarInput({
  fieldKey,
  value,
  onChange,
  onSave,
  onFocus,
  placeholder,
  multiline,
  className,
  type = 'text',
}: {
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onFocus: (key: string, el: HTMLElement) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  type?: string;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const insertVar = useCallback((path: string) => {
    const el = inputRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const next = before + `{{${path}}}` + after;
    
    onChange(next);
    setShowDropdown(false);
    onSave();

    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + `{{${path}}}`.length;
      el.setSelectionRange(pos, pos);
    });
  }, [value, onChange, onSave]);

  const baseClass = className ?? (multiline
    ? 'w-full pl-3 pr-10 py-2 bg-bg border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-primary font-mono min-h-[80px] resize-y transition-colors'
    : 'w-full pl-3 pr-10 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-primary font-mono transition-colors');

  return (
    <div ref={wrapRef} className="relative group">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocus(fieldKey, inputRef.current!)}
          onBlur={onSave}
          placeholder={placeholder}
          className={baseClass}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocus(fieldKey, inputRef.current!)}
          onBlur={onSave}
          placeholder={placeholder}
          className={baseClass}
        />
      )}

      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className={`absolute right-2 top-2 p-1.5 rounded transition-colors ${
          showDropdown 
            ? 'bg-primary text-white' 
            : 'text-text-muted hover:bg-surface hover:text-text-main'
        }`}
        title="Insert Variable"
      >
        <Braces className="w-3.5 h-3.5" />
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 z-[200] w-64 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-bg/50">
            <Braces className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] font-semibold text-text-main uppercase tracking-wider">Insert Variable</span>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {STANDARD_VARS.map((m, i) => (
              <button
                key={`${m.path}-${i}`}
                type="button"
                onClick={() => insertVar(m.path)}
                className="w-full flex flex-col items-start px-3 py-2 hover:bg-bg rounded-lg transition-colors text-left group/btn"
              >
                <span className="text-xs font-medium text-text-main group-hover/btn:text-primary">{m.label}</span>
                <span className="text-[10px] font-mono text-text-muted truncate w-full">{`{{${m.path}}}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Config Panel ────────────────────────────────────────────────────────

export function NativeConfigPanel({
  node,
  nodeImpl,
  onUpdate,
  onClose,
  onDelete,
  onDuplicate,
  onTestNode,
  lastRunData,
}: {
  node: any;
  nodeImpl: any;
  onUpdate: (node: any) => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTestNode?: (nodeId: string, inputItems?: any[]) => Promise<{ output: any[]; duration: number }>;
  lastRunData?: any[] | null;
}) {
  const [localNode, setLocalNode] = useState(node ?? { id: '', type: '', label: '', config: {} });
  const [isTesting, setIsTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<any[] | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testDuration, setTestDuration] = useState<number | null>(null);

  const { data: channels = [] } = useChannelConnections();
  const hasGmail = channels.some((c) => c.provider === 'gmail' && c.isActive);

  // Track which field is focused
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);
  const [focusedFieldLabel, setFocusedFieldLabel] = useState<string | null>(null);
  const focusedElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (node) {
      setLocalNode(node);
      setTestOutput(null);
      setTestError(null);
      setTestDuration(null);
    }
  }, [node]);

  if (!node || !localNode?.type) return null;

  // Update local state without pushing to parent yet
  const handleChange = (field: string, value: any) => {
    setLocalNode((prev: any) => ({
      ...prev,
      config: { ...(prev.config || {}), [field]: value },
    }));
  };

  // Push local state to parent
  const handleSave = () => onUpdate(localNode);

  // Insert expression into currently focused field
  const insertIntoFocused = (expr: string) => {
    if (!focusedFieldKey || !focusedElRef.current) return;
    const el = focusedElRef.current as HTMLInputElement | HTMLTextAreaElement;
    const cursor = el.selectionStart ?? (el.value ?? '').length;
    const before = (el.value ?? '').slice(0, cursor);
    const after = (el.value ?? '').slice(cursor);
    const next = before + expr + after;
    handleChange(focusedFieldKey, next);
    // Auto save immediately since we clicked a button
    setTimeout(() => handleSave(), 0);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + expr.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // Instant update (local + parent) for toggles/selects
  const handleInstantChange = (field: string, value: any) => {
    const nextNode = {
      ...localNode,
      config: { ...(localNode.config || {}), [field]: value },
    };
    setLocalNode(nextNode);
    onUpdate(nextNode);
  };

  const handleTestClick = async () => {
    if (!onTestNode) return;
    setIsTesting(true);
    setTestOutput(null);
    setTestError(null);
    setTestDuration(null);
    try {
      const result = await onTestNode(localNode.id, [{ json: {} }]);
      setTestOutput(result.output);
      setTestDuration(result.duration);
    } catch (err: any) {
      setTestError(err.message || 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleFieldFocus = (key: string, el: HTMLElement, label?: string) => {
    setFocusedFieldKey(key);
    setFocusedFieldLabel(label ?? key);
    focusedElRef.current = el;
  };

  const configFields: any[] = Array.isArray(nodeImpl?.configSchema)
    ? (nodeImpl.configSchema as any[])
    : [];

  const basicFields = configFields.filter((f: any) => !f.advanced);
  const advancedFields = configFields.filter((f: any) => f.advanced);

  const renderField = (field: any) => {
    const key = field.key as string;
    const label = field.label || key;
    const fieldType = field.type as string;
    const value = (localNode.config && localNode.config[key] !== undefined)
      ? localNode.config[key]
      : field.default ?? '';

    // Select dropdown
    if (fieldType === 'select' && Array.isArray(field.options)) {
      return (
        <div key={key} className="space-y-1.5">
          <label className="text-xs font-medium text-text-main">{label}</label>
          <select
            value={value}
            onChange={(e) => handleInstantChange(key, e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-primary"
          >
            <option value="">Select option...</option>
            {field.options.map((opt: any) => (
              <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {field.description && <p className="text-[10px] text-text-muted">{field.description}</p>}
        </div>
      );
    }

    // Boolean toggle
    if (fieldType === 'boolean') {
      return (
        <div key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            id={key}
            checked={!!value}
            onChange={(e) => handleInstantChange(key, e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary bg-bg"
          />
          <label htmlFor={key} className="text-xs font-medium text-text-main">{label}</label>
        </div>
      );
    }

    const isTextArea = fieldType === 'textarea' || fieldType === 'code' || fieldType === 'json';
    const supportsVariables = fieldType === 'text' || fieldType === 'textarea' || fieldType === 'expression';

    return (
      <div key={key} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-text-main">{label}</label>
          {supportsVariables && (
            <span className="text-[10px] text-text-muted font-mono opacity-60">
              type {'{{'}
            </span>
          )}
        </div>

        {supportsVariables ? (
          <VarInput
            fieldKey={key}
            value={String(value ?? '')}
            onChange={(v) => handleChange(key, v)}
            onSave={handleSave}
            onFocus={(k, el) => handleFieldFocus(k, el, label)}
            placeholder={field.placeholder || (field.default ? `Default: ${field.default}` : `Type or use {{ to insert variables`)}
            multiline={isTextArea}
          />
        ) : isTextArea ? (
          <textarea
            value={String(value ?? '')}
            onChange={(e) => handleChange(key, e.target.value)}
            onBlur={handleSave}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-primary font-mono min-h-[80px] resize-y"
          />
        ) : (
          <input
            type={fieldType === 'number' ? 'number' : 'text'}
            value={String(value ?? '')}
            onChange={(e) => handleChange(key, fieldType === 'number' ? Number(e.target.value) : e.target.value)}
            onBlur={handleSave}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-primary"
          />
        )}

        {field.description && <p className="text-[10px] text-text-muted">{field.description}</p>}
      </div>
    );
  };

  return (
    <div className="w-80 border-l border-border bg-surface flex flex-col h-full z-10 shrink-0 overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg/50 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold"
            style={{ backgroundColor: nodeImpl?.color || '#52677D' }}
          >
            {nodeImpl?.displayName?.charAt(0) ?? '?'}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-main truncate w-40">
              {localNode.label || localNode.type || 'Node'}
            </h3>
            <p className="text-xs text-text-muted">{nodeImpl?.displayName || 'Unknown'}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {localNode.type === 'communication.send_email' && !hasGmail && (
          <div className="m-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-yellow-200">
                You haven't connected an email provider yet. Emails will fail to send.
              </p>
              <button
                onClick={() => channelConnectionsApi.connectGmail()}
                className="text-[11px] font-medium text-yellow-500 hover:text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 px-2 py-1 rounded transition-colors"
              >
                Connect Gmail Provider
              </button>
            </div>
          </div>
        )}

        <div className="p-4 space-y-5">
          {/* Node Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-main uppercase tracking-wider">Node Name</label>
            <input
              type="text"
              value={localNode.label ?? ''}
              onChange={(e) => setLocalNode({ ...localNode, label: e.target.value })}
              onBlur={handleSave}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Config Fields */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-text-main uppercase tracking-wider border-b border-border pb-1">
              Configuration
            </h4>

            {configFields.length === 0 ? (
              <p className="text-xs text-text-muted">No configuration required for this node.</p>
            ) : (
              <>
                {basicFields.map(renderField)}
                
                {advancedFields.length > 0 && (
                  <details className="group border border-border rounded-lg bg-surface/50 overflow-hidden mt-4">
                    <summary className="text-xs font-semibold text-text-main uppercase tracking-wider p-3 cursor-pointer select-none hover:bg-bg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-between">
                      Advanced Settings
                      <span className="text-text-muted group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="p-4 pt-2 border-t border-border space-y-4">
                      {advancedFields.map(renderField)}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>

          {/* Node Settings */}
          <div className="space-y-2.5 pt-2 border-t border-border">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Node Settings</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!localNode.continueOnFail}
                onChange={(e) => {
                  const nextNode = { ...localNode, continueOnFail: e.target.checked };
                  setLocalNode(nextNode);
                  onUpdate(nextNode);
                }}
                className="rounded border-border text-primary focus:ring-primary bg-bg"
              />
              <span className="text-xs text-text-main">Continue on failure</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!localNode.disabled}
                onChange={(e) => {
                  const nextNode = { ...localNode, disabled: e.target.checked };
                  setLocalNode(nextNode);
                  onUpdate(nextNode);
                }}
                className="rounded border-border text-primary focus:ring-primary bg-bg"
              />
              <span className="text-xs text-text-muted">Disable this node</span>
            </label>
          </div>
          

        </div>

        {/* History / Last Run Log */}
        {lastRunData && !isTesting && !testOutput && !testError && (
          <div className="border-t border-border mt-4">
            <div className="p-4 bg-surface/50 border-b border-border flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-main flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-accent" />
                Last Run Data
              </h4>
            </div>
            <div className="p-4 bg-[#0F1115] overflow-x-auto max-h-[300px]">
              <pre className="text-[11px] text-green-400 font-mono">
                {JSON.stringify(lastRunData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Test Output */}
        {(testOutput || testError || isTesting) && (
          <div className="mx-4 mb-3">
            {testError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                <p className="font-semibold mb-1">Test failed</p>
                <p className="font-mono">{testError}</p>
              </div>
            )}
            {testOutput && (
              <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-green-400">Test passed</span>
                  {testDuration !== null && (
                    <span className="text-[10px] text-text-muted">{testDuration}ms</span>
                  )}
                </div>
                <pre className="text-[10px] font-mono text-text-main overflow-auto max-h-32 whitespace-pre-wrap">
                  {JSON.stringify(testOutput, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border bg-bg/50 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleTestClick}
            disabled={isTesting || localNode.type?.startsWith('trigger.') || !onTestNode}
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
