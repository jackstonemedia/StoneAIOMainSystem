/**
 * AutomationConfigPanel — the detail panel for the Automation canvas.
 * Select a node to edit its label/description/config; select the Trigger
 * node to edit when the automation fires. All edits land in the canvas
 * nodes / triggerConfig state and are saved by the canvas Save button.
 */
import type { Node } from '@xyflow/react';
import {
  defaultStepConfig,
  defaultTriggerConfig,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  UPDATE_FIELDS,
  WAIT_UNITS,
} from '../../lib/automationCanvas';

const inputCls = 'w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text-main';
const labelCls = 'block text-xs font-semibold text-text-muted mb-1';

interface Option {
  id: string;
  label: string;
}

interface Props {
  node: Node | null;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  onTriggerConfigChange: (patch: Record<string, unknown>) => void;
  onNodeDataChange: (patch: Record<string, unknown>) => void;
  onDeleteNode: () => void;
  onClose: () => void;
  stageOptions: Option[];
  campaignOptions: { id: string; name?: string; title?: string; subject?: string }[];
  pageOptions: { id: string; name: string; slug: string }[];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function ConditionFields({
  cfg,
  onChange,
}: {
  cfg: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const field = typeof cfg.field === 'string' ? cfg.field : 'tag';
  const operator = typeof cfg.operator === 'string' ? cfg.operator : 'contains';
  const needsValue = operator !== 'exists' && operator !== 'not_exists';
  return (
    <>
      <Field label="Field">
        <select
          className={inputCls}
          value={field}
          onChange={(e) => onChange({ field: e.target.value })}
        >
          {CONDITION_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </Field>
      {field === 'customField' && (
        <Field label="Custom field name">
          <input
            className={inputCls}
            value={typeof cfg.customFieldName === 'string' ? cfg.customFieldName : ''}
            onChange={(e) => onChange({ customFieldName: e.target.value })}
            placeholder="e.g. company_size"
          />
        </Field>
      )}
      <Field label="Condition">
        <select
          className={inputCls}
          value={operator}
          onChange={(e) => onChange({ operator: e.target.value })}
        >
          {CONDITION_OPERATORS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      {needsValue && (
        <Field label="Value">
          <input
            className={inputCls}
            value={typeof cfg.value === 'string' ? cfg.value : ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={field === 'tag' ? 'e.g. vip' : 'Value to match'}
          />
        </Field>
      )}
    </>
  );
}

export default function AutomationConfigPanel({
  node,
  triggerType,
  triggerConfig,
  onTriggerConfigChange,
  onNodeDataChange,
  onDeleteNode,
  onClose,
  stageOptions,
  campaignOptions,
  pageOptions,
}: Props) {
  if (!node) {
    return (
      <div className="absolute right-5 top-5 w-80 bg-surface/90 border border-border/60 rounded-2xl shadow-luxury backdrop-blur-md p-4 z-30 text-xs text-text-muted leading-relaxed">
        Select a step on the canvas to configure it — or the Trigger node to set when this automation fires.
      </div>
    );
  }

  const stepType = String((node.data as any)?.stepType || '');
  const isTrigger = stepType === 'TRIGGER';
  const cfg: Record<string, unknown> = isTrigger
    ? {}
    : { ...defaultStepConfig(stepType), ...(((node.data as any)?.config || {}) as Record<string, unknown>) };
  const updateCfg = (patch: Record<string, unknown>) => onNodeDataChange({ config: { ...cfg, ...patch } });

  return (
    <div className="absolute right-5 top-5 bottom-5 w-80 overflow-y-auto bg-surface/95 border border-border/60 rounded-2xl shadow-luxury backdrop-blur-md p-4 z-30">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
            {isTrigger ? 'Trigger' : 'Step'}
          </div>
          <div className="text-text-main font-bold">
            {isTrigger ? 'When this runs' : String((node.data as any)?.label || stepType)}
          </div>
        </div>
        <button onClick={onClose} className="px-2 py-1 rounded-lg border border-border/60 text-text-muted hover:text-text-main" title="Close panel">
          ✕
        </button>
      </div>

      {isTrigger ? (
        <>
          <p className="text-xs text-text-muted mb-4 leading-relaxed">
            Trigger: <span className="text-text-main font-semibold">{triggerType.replace(/_/g, ' ')}</span>
            {triggerType === 'MANUAL_ENROLLMENT' && ' — this automation only runs for contacts you enroll by hand.'}
            {triggerType === 'CONTACT_CREATED' && ' — fires for every new contact.'}
          </p>
          {(triggerType === 'TAG_ADDED' || triggerType === 'TAG_REMOVED') && (
            <Field label="Tag">
              <input
                className={inputCls}
                value={typeof triggerConfig.tag === 'string' ? triggerConfig.tag : ''}
                onChange={(e) => onTriggerConfigChange({ tag: e.target.value })}
                placeholder="e.g. vip"
              />
            </Field>
          )}
          {triggerType === 'DEAL_STAGE_CHANGED' && (
            <Field label="Stage">
              <select
                className={inputCls}
                value={typeof triggerConfig.stageId === 'string' ? triggerConfig.stageId : ''}
                onChange={(e) => onTriggerConfigChange({ stageId: e.target.value })}
              >
                <option value="">Any stage</option>
                {stageOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>
          )}
          {(triggerType === 'EMAIL_OPENED' || triggerType === 'EMAIL_LINK_CLICKED') && (
            <Field label="Campaign">
              <select
                className={inputCls}
                value={typeof triggerConfig.campaignId === 'string' ? triggerConfig.campaignId : ''}
                onChange={(e) => onTriggerConfigChange({ campaignId: e.target.value })}
              >
                <option value="">Any campaign</option>
                {campaignOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || c.title || c.subject || c.id}</option>
                ))}
              </select>
            </Field>
          )}
          {triggerType === 'DATE_BASED' && (
            <Field label="Date field">
              <select
                className={inputCls}
                value={typeof triggerConfig.dateField === 'string' ? triggerConfig.dateField : 'dateOfBirth'}
                onChange={(e) => onTriggerConfigChange({ dateField: e.target.value })}
              >
                <option value="dateOfBirth">Birthday (contact date of birth)</option>
                <option value="createdAt">Contact created anniversary</option>
              </select>
            </Field>
          )}
          {triggerType === 'FORM_SUBMITTED' && (
            <Field label="Landing page">
              <select
                className={inputCls}
                value={typeof triggerConfig.pageId === 'string' ? triggerConfig.pageId : ''}
                onChange={(e) => onTriggerConfigChange({ pageId: e.target.value })}
              >
                <option value="">Any page</option>
                {pageOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                ))}
              </select>
            </Field>
          )}
          {triggerType === 'CUSTOM_FIELD_CHANGED' && (
            <Field label="Custom field name">
              <input
                className={inputCls}
                value={typeof triggerConfig.field === 'string' ? triggerConfig.field : ''}
                onChange={(e) => onTriggerConfigChange({ field: e.target.value })}
                placeholder="e.g. company_size"
              />
            </Field>
          )}
          <p className="text-[11px] text-text-muted leading-relaxed">
            Trigger settings save with the automation. Change the trigger type itself only when creating a new automation.
          </p>
        </>
      ) : (
        <>
          <Field label="Step name">
            <input
              className={inputCls}
              value={typeof (node.data as any)?.label === 'string' ? (node.data as any).label : ''}
              onChange={(e) => onNodeDataChange({ label: e.target.value })}
            />
          </Field>
          <Field label="Description (optional)">
            <input
              className={inputCls}
              value={typeof (node.data as any)?.description === 'string' ? (node.data as any).description : ''}
              onChange={(e) => onNodeDataChange({ description: e.target.value })}
              placeholder="What this step does"
            />
          </Field>

          {stepType === 'SEND_EMAIL' && (
            <>
              <Field label="Subject">
                <input
                  className={inputCls}
                  value={typeof cfg.subject === 'string' ? cfg.subject : ''}
                  onChange={(e) => updateCfg({ subject: e.target.value })}
                  placeholder="e.g. Welcome, {{firstName}}!"
                />
              </Field>
              <Field label="Body">
                <textarea
                  className={inputCls}
                  rows={6}
                  value={typeof cfg.body === 'string' ? cfg.body : ''}
                  onChange={(e) => updateCfg({ body: e.target.value })}
                  placeholder="Hi {{firstName}}, ..."
                />
              </Field>
              <Field label="From name (optional)">
                <input
                  className={inputCls}
                  value={typeof cfg.fromName === 'string' ? cfg.fromName : ''}
                  onChange={(e) => updateCfg({ fromName: e.target.value })}
                  placeholder="Your business name"
                />
              </Field>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Sent to the enrolled contact from a connected mailbox. Use {'{{firstName}}'}, {'{{email}}'} and other contact fields in the subject and body.
              </p>
            </>
          )}

          {stepType === 'WAIT' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <Field label="Wait">
                  <input
                    className={inputCls}
                    type="number"
                    min={1}
                    value={typeof cfg.amount === 'number' ? cfg.amount : 1}
                    onChange={(e) => updateCfg({ amount: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Unit">
                  <select
                    className={inputCls}
                    value={typeof cfg.unit === 'string' ? cfg.unit : 'days'}
                    onChange={(e) => updateCfg({ unit: e.target.value })}
                  >
                    {WAIT_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {(stepType === 'CONDITION_BRANCH' || stepType === 'GOAL_CHECK') && (
            <>
              <ConditionFields cfg={cfg} onChange={updateCfg} />
              {stepType === 'GOAL_CHECK' && (
                <p className="text-[11px] text-text-muted leading-relaxed">
                  When the condition is met the contact exits the automation (goal met). Otherwise they continue to the next step.
                </p>
              )}
            </>
          )}

          {(stepType === 'ADD_TAG' || stepType === 'REMOVE_TAG') && (
            <Field label="Tag">
              <input
                className={inputCls}
                value={typeof cfg.tag === 'string' ? cfg.tag : ''}
                onChange={(e) => updateCfg({ tag: e.target.value })}
                placeholder="e.g. vip"
              />
            </Field>
          )}

          {stepType === 'UPDATE_FIELD' && (
            <>
              <Field label="Field">
                <select
                  className={inputCls}
                  value={typeof cfg.field === 'string' ? cfg.field : 'firstName'}
                  onChange={(e) => updateCfg({ field: e.target.value })}
                >
                  {UPDATE_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </Field>
              {cfg.field === 'customField' && (
                <Field label="Custom field name">
                  <input
                    className={inputCls}
                    value={typeof cfg.customFieldName === 'string' ? cfg.customFieldName : ''}
                    onChange={(e) => updateCfg({ customFieldName: e.target.value })}
                    placeholder="e.g. company_size"
                  />
                </Field>
              )}
              <Field label="New value">
                <input
                  className={inputCls}
                  value={typeof cfg.value === 'string' ? cfg.value : ''}
                  onChange={(e) => updateCfg({ value: e.target.value })}
                />
              </Field>
            </>
          )}

          {stepType === 'WEBHOOK_CALL' && (
            <>
              <Field label="URL">
                <input
                  className={inputCls}
                  value={typeof cfg.url === 'string' ? cfg.url : ''}
                  onChange={(e) => updateCfg({ url: e.target.value })}
                  placeholder="https://example.com/hook"
                />
              </Field>
              <Field label="Method">
                <select
                  className={inputCls}
                  value={typeof cfg.method === 'string' ? cfg.method : 'POST'}
                  onChange={(e) => updateCfg({ method: e.target.value })}
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </Field>
            </>
          )}

          {stepType === 'EXIT_AUTOMATION' && (
            <p className="text-xs text-text-muted leading-relaxed">
              Exits the automation for this contact. No further steps run for them.
            </p>
          )}

          <button
            onClick={onDeleteNode}
            className="mt-2 px-3 py-2 rounded-lg border border-red-500/50 text-red-400 text-xs font-semibold hover:bg-red-500/10"
          >
            Delete this step
          </button>
        </>
      )}
    </div>
  );
}
