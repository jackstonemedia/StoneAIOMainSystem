import { useState, useRef } from 'react';
import { X, Link2, Plus, Trash2, Loader2, Copy, MoreHorizontal, ChevronRight, Braces } from 'lucide-react';
import { useAPConnections, useCreateAPConnection } from '../../../hooks/useWorkflows';
import { usePieceDetail as usePiece, usePieceOptions as useAPDynamicOptions } from '../../../hooks/usePieces';
import type { APStep, APPiece, APPieceProp } from '../../../types/automation';

interface Props {
  step: APStep;
  allSteps?: APStep[]; // For Data-to-Insert panel
  onUpdate: (step: APStep) => void;
  onClose: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export function APStepConfigPanel({ step, allSteps = [], onUpdate, onClose, onDelete, onDuplicate }: Props) {
  const pieceName = step.settings.pieceName ?? '';
  // Only fetch piece metadata when the pieceName is a valid AP package name.
  // Legacy / internal AP step names (like "comm-email", "trigger-schedule") do NOT have metadata.
  const isValidPieceName = pieceName.startsWith('@') || pieceName.includes('/') || pieceName.includes('piece-');
  const { data: piece, isLoading: pieceLoading } = usePiece(isValidPieceName ? pieceName : '');
  const { data: connections = [] } = useAPConnections(isValidPieceName ? pieceName : undefined);
  const createConnection = useCreateAPConnection();

  const [showNewConnForm, setShowNewConnForm] = useState(false);
  const [newConnName, setNewConnName] = useState('');
  const [newConnValue, setNewConnValue] = useState<Record<string, string>>({});
  const [showStepMenu, setShowStepMenu] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Filter previous steps up to this step
  const previousSteps = allSteps.slice(0, allSteps.findIndex(s => s.name === step.name));

  const triggersArr = Array.isArray(piece?.triggers)
    ? piece!.triggers
    : Object.values(piece?.triggers ?? {}) as any[];
  const actionsArr = Array.isArray(piece?.actions)
    ? piece!.actions
    : Object.values(piece?.actions ?? {}) as any[];

  const action = step.type === 'TRIGGER'
    ? triggersArr.find((t: any) => t.name === step.settings.triggerName)
    : actionsArr.find((a: any) => a.name === step.settings.actionName);

  const availableActions = step.type === 'TRIGGER' ? triggersArr : actionsArr;

  const validateStep = (currentStep: APStep, inputKeys: string[]) => {
    // Basic validation: must have an action/trigger selected.
    const isTrigger = currentStep.type === 'TRIGGER';
    const hasName = isTrigger ? currentStep.settings.triggerName : currentStep.settings.actionName;
    if (!hasName) return false;
    
    // If piece requires auth, ensure connectionName is present
    const requiresAuth = (piece as any)?.auth;
    if (requiresAuth && !inputKeys.includes('connectionName')) return false;

    // TODO: deeper validation of required props based on action.props
    return true;
  };

  const handleInputChange = (key: string, value: unknown) => {
    const newInput = { ...step.settings.input, [key]: value };
    const isValid = validateStep(step, Object.keys(newInput));
    onUpdate({
      ...step,
      valid: isValid,
      settings: { ...step.settings, input: newInput },
    });
  };

  const handleActionChange = (name: string) => {
    const isTrigger = step.type === 'TRIGGER';
    onUpdate({ 
      ...step, 
      valid: false, // Reset valid state when changing action
      settings: { 
        ...step.settings, 
        ...(isTrigger ? { triggerName: name } : { actionName: name }), 
        input: {} 
      } 
    });
  };

  const handleCreateConnection = async () => {
    if (!newConnName.trim()) return;
    const authDef = (piece as any)?.auth;
    const authType = Array.isArray(authDef) ? (authDef[0]?.type ?? 'SECRET_TEXT') : (authDef?.type ?? 'SECRET_TEXT');
    await createConnection.mutateAsync({ pieceName, name: newConnName, type: authType, value: newConnValue });
    setShowNewConnForm(false);
    setNewConnName('');
    setNewConnValue({});
  };

  return (
    <div className="w-80 border-l border-border bg-surface flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {piece?.logoUrl && (
            <img src={piece.logoUrl} alt="" className="w-7 h-7 rounded object-contain shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-text-main text-sm truncate">{step.displayName}</h3>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {step.type === 'CODE' ? 'Custom Code' :
               step.type === 'BRANCH' ? 'Branch / IF-ELSE' :
               step.type === 'LOOP_ON_ITEMS' ? 'Loop on Items' :
               pieceName.replace('@activepieces/piece-', '')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(onDelete || onDuplicate) && (
            <div className="relative">
              <button
                onClick={() => setShowStepMenu(!showStepMenu)}
                className="p-1.5 hover:bg-bg rounded-lg transition-colors text-text-muted"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showStepMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStepMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-surface border border-border rounded-lg shadow-xl z-20 overflow-hidden">
                    {onDuplicate && (
                      <button
                        onClick={() => { onDuplicate(); setShowStepMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-bg"
                      >
                        <Copy className="w-3.5 h-3.5" /> Duplicate Step
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => { onDelete(); setShowStepMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-bg"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Step
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={onClose} className="p-1.5 hover:bg-bg rounded-lg transition-colors shrink-0">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* CODE step editor */}
        {step.type === 'CODE' && (
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              JavaScript Code
            </label>
            <textarea
              rows={10}
              value={step.settings.sourceCode?.code ?? 'export const code = async (inputs) => {\n  return inputs;\n}'}
              onChange={(e) =>
                onUpdate({
                  ...step,
                  settings: {
                    ...step.settings,
                    sourceCode: {
                      code: e.target.value,
                      packageJson: step.settings.sourceCode?.packageJson ?? '{"dependencies":{}}',
                    },
                  },
                })
              }
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs text-text-main font-mono focus:outline-none focus:border-accent resize-none"
            />
          </div>
        )}

        {/* BRANCH step */}
        {step.type === 'BRANCH' && (
          <BranchConditionBuilder
            conditions={step.settings.conditions ?? []}
            onChange={(conditions) =>
              onUpdate({ ...step, settings: { ...step.settings, conditions } })
            }
          />
        )}

        {/* LOOP step */}
        {step.type === 'LOOP_ON_ITEMS' && (
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              Items (Array) *
            </label>
            <input
              type="text"
              value={(step.settings.items as string) ?? ''}
              onChange={(e) =>
                onUpdate({ ...step, settings: { ...step.settings, items: e.target.value } })
              }
              onFocus={() => setFocusedInput('items')}
              placeholder="{{step_1.results}}"
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-text-main focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-text-muted mt-1">
              Use <code className="bg-bg px-1 rounded">{'{{stepName.field}}'}</code> to reference previous outputs
            </p>
          </div>
        )}

        {/* PIECE / TRIGGER — requires pieceName */}
        {(step.type === 'PIECE' || step.type === 'TRIGGER') && (
          <>
            {pieceLoading && (
              <div className="flex items-center gap-2 text-xs text-text-muted py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading piece schema...
              </div>
            )}

            {!pieceLoading && piece && (
              <>
                {/* Action / Trigger Selector */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                    {step.type === 'TRIGGER' ? 'Trigger Event' : 'Action'} *
                  </label>
                  <select
                    value={step.type === 'TRIGGER' ? (step.settings.triggerName ?? '') : (step.settings.actionName ?? '')}
                    onChange={(e) => handleActionChange(e.target.value)}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent"
                  >
                    <option value="">Select {step.type === 'TRIGGER' ? 'trigger' : 'action'}...</option>
                    {availableActions.map((a: any) => (
                      <option key={a.name} value={a.name}>{a.displayName}</option>
                    ))}
                  </select>
                  {action?.description && (
                    <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{action.description}</p>
                  )}
                </div>

                {/* Connection selector */}
                {(piece as any).auth && (
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                      Connection *
                    </label>
                    {connections.length === 0 && !showNewConnForm ? (
                      <button
                        onClick={() => setShowNewConnForm(true)}
                        className="w-full flex items-center gap-2 p-3 border border-dashed border-border rounded-lg text-sm text-text-muted hover:border-accent hover:text-accent transition-colors"
                      >
                        <Link2 className="w-4 h-4" />
                        Connect {pieceName.replace('@activepieces/piece-', '')}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={(step.settings.input?.['connectionName'] as string) ?? ''}
                          onChange={(e) => {
                            if (e.target.value === '__new__') {
                              setShowNewConnForm(true);
                            } else {
                              handleInputChange('connectionName', e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent"
                        >
                          <option value="">Select connection...</option>
                          {connections.map((c: any) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                          <option value="__new__">+ Create New Connection</option>
                        </select>
                      </div>
                    )}

                    {showNewConnForm && (
                      <div className="mt-3 p-3 bg-bg border border-border rounded-lg space-y-3">
                        <p className="text-xs font-medium text-text-main">New Connection</p>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Connection Name</label>
                          <input
                            type="text"
                            value={newConnName}
                            onChange={(e) => setNewConnName(e.target.value)}
                            placeholder="My Connection"
                            className="w-full px-3 py-2 bg-surface border border-border rounded text-sm text-text-main focus:outline-none focus:border-accent"
                          />
                        </div>
                        {(() => {
                          const authDef = (piece as any).auth;
                          const authProps = Array.isArray(authDef) ? (authDef[0]?.props ?? {}) : (authDef?.props ?? {});
                          return Object.entries(authProps).map(([k, v]: [string, any]) => (
                            <div key={k}>
                              <label className="block text-xs text-text-muted mb-1">{v.displayName}</label>
                              <input
                                type={v.type === 'SECRET_TEXT' ? 'password' : 'text'}
                                value={newConnValue[k] ?? ''}
                                onChange={(e) => setNewConnValue((prev) => ({ ...prev, [k]: e.target.value }))}
                                placeholder={v.description ?? ''}
                                className="w-full px-3 py-2 bg-surface border border-border rounded text-sm text-text-main font-mono focus:outline-none focus:border-accent"
                              />
                            </div>
                          ));
                        })()}
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateConnection}
                            disabled={createConnection.isPending || !newConnName.trim()}
                            className="flex-1 py-2 bg-accent text-white text-xs rounded-lg disabled:opacity-50 hover:bg-accent/90 transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            {createConnection.isPending ? 'Saving...' : 'Save Connection'}
                          </button>
                          <button
                            onClick={() => setShowNewConnForm(false)}
                            className="px-3 py-2 border border-border rounded-lg text-xs text-text-muted hover:bg-bg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic prop form — only show when an action is selected */}
                {action?.props && Object.entries(action.props).map(([key, prop], index) => {
                    if (Object.keys(action.props)[index - 1] === 'connectionName') return null;
                    return (
                        <PropField
                          key={key}
                          propKey={key}
                          prop={prop as APPieceProp}
                          step={step}
                          piece={piece}
                          value={step.settings.input?.[key]}
                          onChange={(val) => handleInputChange(key, val)}
                          onFocus={(propKey) => setFocusedInput(propKey)}
                        />
                    );
                })}

                {/* Generate Sample Data / Test Section */}
                {action && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <h4 className="text-xs font-semibold text-text-main mb-3 uppercase tracking-wider">
                      {step.type === 'TRIGGER' ? 'Generate Sample Data' : 'Test Action'}
                    </h4>
                    {step.type === 'TRIGGER' ? (
                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            if (action.sampleData) {
                              onUpdate({ ...step, settings: { ...step.settings, inputUiInfo: { currentSelectedData: action.sampleData } } });
                            }
                          }}
                          className="w-full py-2 bg-surface border border-border text-xs text-text-main font-medium rounded-lg hover:bg-bg transition-colors"
                        >
                          Use Mock Data
                        </button>
                        {step.settings.inputUiInfo?.currentSelectedData && (
                          <div className="mt-3 bg-bg/50 border border-border rounded-lg p-3 overflow-x-auto">
                            <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">
                              {JSON.stringify(step.settings.inputUiInfo.currentSelectedData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <button
                          className="w-full py-2 bg-surface border border-border text-xs text-text-main font-medium rounded-lg hover:bg-bg transition-colors"
                        >
                          Test Step
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {!pieceLoading && !piece && pieceName && (
              <p className="text-xs text-red-400 text-center py-4">
                Could not load piece metadata. Ensure the server is running.
              </p>
            )}
          </>
        )}
      </div>

      {focusedInput && (
        <DataToInsertPanel
          steps={previousSteps}
          onInsert={(val) => {
            if (focusedInput === 'items') {
              onUpdate({ ...step, settings: { ...step.settings, items: ((step.settings.items as string) ?? '') + val } });
            } else {
              const currentVal = step.settings.input?.[focusedInput] ?? '';
              handleInputChange(focusedInput, currentVal + val);
            }
          }}
          onClose={() => setFocusedInput(null)}
        />
      )}
    </div>
  );
}

// ── Static Prop Field (no hooks) ──────────────────────────────────────────────
function PropField({
  propKey, prop, value, onChange, step, piece, onFocus,
}: {
  propKey: string;
  prop: APPieceProp;
  value: unknown;
  onChange: (val: unknown) => void;
  step: APStep;
  piece: APPiece;
  onFocus?: (propKey: string) => void;
}) {
  const isDynamic = prop.type === 'DYNAMIC' || ((prop as any).refreshers?.length > 0);

  if (isDynamic) {
    return (
      <DynamicPropField
        propKey={propKey}
        prop={prop}
        value={value}
        onChange={onChange}
        step={step}
        piece={piece}
      />
    );
  }

  return <StaticPropField propKey={propKey} prop={prop} value={value} onChange={onChange} />;
}

// ── Dynamic Prop Field (is a real React component — hooks allowed) ─────────────
function DynamicPropField({
  propKey, prop, value, onChange, step, piece,
}: {
  propKey: string;
  prop: APPieceProp;
  value: unknown;
  onChange: (val: unknown) => void;
  step: APStep;
  piece: APPiece;
}) {
  const { data: dynamicOpts = [], isFetching } = useAPDynamicOptions(
    piece.name,
    piece.version,
    step.name,
    propKey,
    step.settings.input as Record<string, any>,
    true,
  );

  const label = (
    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
      {prop.displayName}
      {prop.required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );

  return (
    <div>
      {label}
      {prop.description && (
        <p className="text-xs text-text-muted mb-1.5">{prop.description}</p>
      )}
      {isFetching ? (
        <div className="flex items-center gap-2 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-muted">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading options...
        </div>
      ) : (
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent"
        >
          <option value="">Select...</option>
          {dynamicOpts.map((opt: any) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ── Static Prop Field ─────────────────────────────────────────────────────────
function StaticPropField({
  propKey, prop, value, onChange, onFocus,
}: {
  propKey: string;
  prop: APPieceProp;
  value: unknown;
  onChange: (val: unknown) => void;
  onFocus?: (propKey: string) => void;
}) {
  const label = (
    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
      {prop.displayName}
      {prop.required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );

  if (prop.type === 'MARKDOWN') {
    return (
      <div className="text-xs text-text-muted bg-bg/50 p-3 rounded-lg border border-border">
        {prop.description}
      </div>
    );
  }

  if (prop.type === 'SHORT_TEXT') {
    return (
      <div>
        {label}
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocus?.(propKey)}
          placeholder={prop.description}
          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main font-mono focus:outline-none focus:border-accent"
        />
      </div>
    );
  }

  if (prop.type === 'SECRET_TEXT') {
    return (
      <div>
        {label}
        <input
          type="password"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocus?.(propKey)}
          placeholder={prop.description}
          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main font-mono focus:outline-none focus:border-accent"
        />
      </div>
    );
  }

  if (prop.type === 'LONG_TEXT') {
    return (
      <div>
        {label}
        <textarea
          rows={3}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocus?.(propKey)}
          placeholder={prop.description}
          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main font-mono focus:outline-none focus:border-accent resize-none"
        />
      </div>
    );
  }

  if (prop.type === 'NUMBER') {
    return (
      <div>
        {label}
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent"
        />
      </div>
    );
  }

  if (prop.type === 'CHECKBOX') {
    return (
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id={propKey}
          checked={(value as boolean) ?? false}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-accent"
        />
        <label htmlFor={propKey} className="text-sm text-text-main">{prop.displayName}</label>
      </div>
    );
  }

  if (prop.type === 'STATIC_DROPDOWN' || prop.type === 'DROPDOWN') {
    const opts = (prop as any).options?.options ?? (prop as any).options ?? [];
    return (
      <div>
        {label}
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent"
        >
          <option value="">Select...</option>
          {opts.map((opt: any) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (prop.type === 'MULTI_SELECT_DROPDOWN') {
    const opts = (prop as any).options?.options ?? (prop as any).options ?? [];
    const selected = Array.isArray(value) ? value as string[] : [];
    return (
      <div>
        {label}
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {opts.map((opt: any) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-text-main">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, opt.value]);
                  else onChange(selected.filter((v) => v !== opt.value));
                }}
                className="w-3.5 h-3.5 accent-accent"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (prop.type === 'JSON' || prop.type === 'OBJECT') {
    return (
      <div>
        {label}
        <textarea
          rows={4}
          value={value ? JSON.stringify(value, null, 2) : ''}
          onChange={(e) => {
            try { onChange(JSON.parse(e.target.value)); } catch { /* keep invalid draft */ }
          }}
          placeholder="{}"
          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs text-text-main font-mono focus:outline-none focus:border-accent resize-none"
        />
      </div>
    );
  }

  if (prop.type === 'ARRAY') {
    const arr = Array.isArray(value) ? value as string[] : [];
    return (
      <div>
        {label}
        <div className="space-y-1.5">
          {arr.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...arr];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                className="flex-1 px-3 py-1.5 bg-bg border border-border rounded text-sm text-text-main font-mono focus:outline-none focus:border-accent"
              />
              <button
                onClick={() => onChange(arr.filter((_, j) => j !== i))}
                className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange([...arr, ''])}
            className="w-full py-1.5 border border-dashed border-border rounded text-xs text-text-muted hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Item
          </button>
        </div>
      </div>
    );
  }

  // Fallback for DATE_TIME, FILE, and other unsupported types
  return (
    <div>
      {label}
      {prop.description && (
        <p className="text-xs text-text-muted mb-1.5">{prop.description}</p>
      )}
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main font-mono focus:outline-none focus:border-accent"
      />
    </div>
  );
}

// ── Branch Condition Builder ──────────────────────────────────────────────────
const OPERATORS = [
  { value: 'TEXT_CONTAINS', label: 'Contains' },
  { value: 'TEXT_EXACTLY_MATCHES', label: 'Equals' },
  { value: 'TEXT_DOES_NOT_CONTAIN', label: 'Does not contain' },
  { value: 'TEXT_STARTS_WITH', label: 'Starts with' },
  { value: 'TEXT_ENDS_WITH', label: 'Ends with' },
  { value: 'NUMBER_IS_GREATER_THAN', label: '> Greater than' },
  { value: 'NUMBER_IS_LESS_THAN', label: '< Less than' },
  { value: 'NUMBER_IS_EQUAL_TO', label: '= Equal to' },
  { value: 'BOOLEAN_IS_TRUE', label: 'Is true' },
  { value: 'BOOLEAN_IS_FALSE', label: 'Is false' },
  { value: 'EXISTS', label: 'Exists' },
  { value: 'DOES_NOT_EXIST', label: 'Does not exist' },
];

function BranchConditionBuilder({ conditions, onChange }: {
  conditions: any[][];
  onChange: (c: any[][]) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
        Conditions (IF true → continue)
      </label>
      {conditions.map((group, gi) =>
        group.map((cond, ci) => (
          <div key={`${gi}-${ci}`} className="p-3 bg-bg rounded-lg border border-border space-y-2">
            <input
              type="text"
              value={cond.firstValue}
              onChange={(e) => {
                const next = conditions.map((g, i) =>
                  i === gi ? g.map((c, j) => j === ci ? { ...c, firstValue: e.target.value } : c) : g
                );
                onChange(next);
              }}
              placeholder="{{step_1.value}}"
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text-main focus:outline-none focus:border-accent"
            />
            <select
              value={cond.operator}
              onChange={(e) => {
                const next = conditions.map((g, i) =>
                  i === gi ? g.map((c, j) => j === ci ? { ...c, operator: e.target.value } : c) : g
                );
                onChange(next);
              }}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text-main focus:outline-none focus:border-accent"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            {!['EXISTS', 'DOES_NOT_EXIST', 'BOOLEAN_IS_TRUE', 'BOOLEAN_IS_FALSE'].includes(cond.operator) && (
              <input
                type="text"
                value={cond.secondValue}
                onChange={(e) => {
                  const next = conditions.map((g, i) =>
                    i === gi ? g.map((c, j) => j === ci ? { ...c, secondValue: e.target.value } : c) : g
                  );
                  onChange(next);
                }}
                placeholder="value to compare"
                className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text-main focus:outline-none focus:border-accent"
              />
            )}
          </div>
        ))
      )}
      <button
        onClick={() =>
          onChange([...conditions, [{ firstValue: '', operator: 'TEXT_EXACTLY_MATCHES', secondValue: '' }]])
        }
        className="w-full py-2 border border-dashed border-border rounded-lg text-xs text-text-muted hover:border-accent hover:text-accent transition-colors"
      >
        + Add Condition Group
      </button>
    </div>
  );
}
