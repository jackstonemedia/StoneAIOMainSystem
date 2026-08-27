/**
 * Automation Canvas — Email Marketing Module (Phase 2)
 *
 * Visual nurture workflow builder using @xyflow/react.
 * Each automation is a directed graph starting from a single Trigger node.
 *
 * Custom nodes implement all AutomationStepType enum values:
 *   SEND_EMAIL, WAIT, CONDITION_BRANCH, ADD_TAG, REMOVE_TAG,
 *   UPDATE_FIELD, ADD_TO_LIST, REMOVE_FROM_LIST, WEBHOOK_CALL,
 *   GOAL_CHECK, EXIT_AUTOMATION
 *
 * Edges: standard flow; CONDITION_BRANCH has two output handles: "Yes" / "No".
 */

import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { nanoid } from 'nanoid';
import {
  Mail, Clock, GitBranch, Tag, Target, Globe,
  LogOut, Plus, Save, ArrowLeft, Zap, List,
  UserMinus, UserPlus, Edit3, Loader2, Sparkles, Check
} from 'lucide-react';

// ── Custom Node styles ────────────────────────────────────────────────────────

const NODE_STYLES: Record<string, { bg: string; border: string; icon: any; label: string }> = {
  TRIGGER:          { bg: 'bg-purple-950/80',  border: 'border-purple-500/60',  icon: Zap,         label: 'Trigger' },
  SEND_EMAIL:       { bg: 'bg-blue-950/80',    border: 'border-blue-500/60',    icon: Mail,        label: 'Send Email' },
  WAIT:             { bg: 'bg-amber-950/80',   border: 'border-amber-500/60',   icon: Clock,       label: 'Wait Delay' },
  CONDITION_BRANCH: { bg: 'bg-orange-950/80',  border: 'border-orange-500/60',  icon: GitBranch,   label: 'If / Else' },
  ADD_TAG:          { bg: 'bg-emerald-950/80', border: 'border-emerald-500/60', icon: Tag,         label: 'Add Tag' },
  REMOVE_TAG:       { bg: 'bg-rose-950/80',    border: 'border-rose-500/60',    icon: Tag,         label: 'Remove Tag' },
  UPDATE_FIELD:     { bg: 'bg-indigo-950/80',  border: 'border-indigo-500/60',  icon: Edit3,       label: 'Update Field' },
  ADD_TO_LIST:      { bg: 'bg-teal-950/80',    border: 'border-teal-500/60',    icon: UserPlus,    label: 'Add to List' },
  REMOVE_FROM_LIST: { bg: 'bg-pink-950/80',    border: 'border-pink-500/60',    icon: UserMinus,   label: 'Remove from List' },
  WEBHOOK_CALL:     { bg: 'bg-cyan-950/80',    border: 'border-cyan-500/60',    icon: Globe,       label: 'Webhook' },
  GOAL_CHECK:       { bg: 'bg-emerald-950/80', border: 'border-emerald-500/60', icon: Target,      label: 'Goal Check' },
  EXIT_AUTOMATION:  { bg: 'bg-surface/90',     border: 'border-border/80',      icon: LogOut,      label: 'Exit' },
};

// ── Custom Node Component ─────────────────────────────────────────────────────

import { Handle, Position } from '@xyflow/react';

function AutomationNode({ data, selected }: { data: any; selected?: boolean }) {
  const cfg = NODE_STYLES[data.stepType] || NODE_STYLES.TRIGGER;
  const Icon = cfg.icon;
  const isBranch = data.stepType === 'CONDITION_BRANCH';

  return (
    <div className={`min-w-52 rounded-2xl border-2 ${cfg.border} ${cfg.bg} ${selected ? 'ring-2 ring-primary shadow-luxury' : ''} backdrop-blur-md shadow-card overflow-hidden transition-all hover:border-primary`}>
      {/* Input handle */}
      {data.stepType !== 'TRIGGER' && (
        <Handle type="target" position={Position.Top} className="!bg-primary !border-white/60 !w-3 !h-3" />
      )}

      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">{cfg.label}</span>
        </div>
        <div className="text-white font-bold text-xs leading-snug">{data.label || cfg.label}</div>
        {data.description && <div className="text-white/60 text-[11px] mt-1 leading-relaxed">{data.description}</div>}
      </div>

      {/* Output handles */}
      {isBranch ? (
        <>
          <div className="flex justify-between px-4 pb-2.5 pt-1 border-t border-white/10">
            <span className="text-[10px] font-bold text-emerald-400">Yes (True)</span>
            <span className="text-[10px] font-bold text-rose-400">No (False)</span>
          </div>
          <Handle id="TRUE_PATH"  type="source" position={Position.Bottom} style={{ left: '30%' }}  className="!bg-emerald-400 !border-white !w-3 !h-3" />
          <Handle id="FALSE_PATH" type="source" position={Position.Bottom} style={{ left: '70%' }}  className="!bg-rose-400 !border-white !w-3 !h-3" />
        </>
      ) : data.stepType !== 'EXIT_AUTOMATION' ? (
        <Handle type="source" position={Position.Bottom} className="!bg-primary !border-white !w-3 !h-3" />
      ) : null}
    </div>
  );
}

const nodeTypes: NodeTypes = { automationNode: AutomationNode };

// ── Step type palette ─────────────────────────────────────────────────────────

const STEP_PALETTE = [
  'SEND_EMAIL', 'WAIT', 'CONDITION_BRANCH', 'ADD_TAG', 'REMOVE_TAG',
  'UPDATE_FIELD', 'ADD_TO_LIST', 'REMOVE_FROM_LIST', 'WEBHOOK_CALL', 'GOAL_CHECK', 'EXIT_AUTOMATION',
] as const;

// ── API ───────────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  CONTACT_CREATED: 'Contact Created', TAG_ADDED: 'Tag Added', TAG_REMOVED: 'Tag Removed',
  FORM_SUBMITTED: 'Form Submitted', LIST_JOINED: 'List Joined', DEAL_STAGE_CHANGED: 'Deal Stage Changed',
  CUSTOM_FIELD_CHANGED: 'Custom Field Changed', DATE_BASED: 'Date Based',
  EMAIL_OPENED: 'Email Opened', EMAIL_LINK_CLICKED: 'Link Clicked',
  MANUAL_ENROLLMENT: 'Manual Enrollment', API_EVENT: 'API Event',
};

async function fetchAutomation(id: string) {
  const { data } = await apiClient.get(`/email-marketing/automations/${id}`);
  return data;
}

async function saveAutomation(id: string, payload: any) {
  await apiClient.patch(`/email-marketing/automations/${id}`, payload);
}

async function createAutomation(payload: any) {
  const { data } = await apiClient.post('/email-marketing/automations', payload);
  return data;
}

// ── Helper: Build initial XY Flow nodes from canvasJson ──────────────────────

function buildInitialNodes(automation: any): Node[] {
  try {
    const canvas = automation.canvasJson as { nodes?: any[] };
    if (canvas?.nodes?.length) return canvas.nodes;
  } catch {}
  return [{
    id: 'trigger',
    type: 'automationNode',
    position: { x: 300, y: 60 },
    data: {
      stepType: 'TRIGGER',
      label: TRIGGER_LABELS[automation.triggerType] || automation.triggerType,
      description: 'Automation workflow entry point',
    },
  }];
}

function buildInitialEdges(automation: any): Edge[] {
  try {
    const canvas = automation.canvasJson as { edges?: Edge[] };
    if (canvas?.edges?.length) return canvas.edges;
  } catch {}
  return [];
}

// ── Canvas ────────────────────────────────────────────────────────────────────

export default function AutomationCanvas() {
  const { automationId } = useParams<{ automationId?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isNew = !automationId || automationId === 'new';

  const [automationName, setAutomationName] = useState('New Automation');
  const [triggerType, setTriggerType] = useState('CONTACT_CREATED');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { isLoading, data: automationData } = useQuery({
    queryKey: ['email-marketing', 'automation', automationId],
    queryFn: () => fetchAutomation(automationId!),
    enabled: !isNew,
  });

  // Populate form state when automation data loads
  useEffect(() => {
    if (!automationData) return;
    setAutomationName(automationData.name);
    setTriggerType(automationData.triggerType);
    setNodes(buildInitialNodes(automationData));
    setEdges(buildInitialEdges(automationData));
  }, [automationData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const canvasJson = { nodes, edges };
      if (isNew) {
        const created = await createAutomation({
          name: automationName,
          triggerType,
          triggerConfig: {},
          canvasJson,
          status: 'DRAFT',
        });
        return created.id as string;
      }
      await saveAutomation(automationId!, { name: automationName, canvasJson });
      return automationId!;
    },
    onSuccess: (id: string) => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'automations'] });
      toast('success', 'Workflow Saved', 'Automation changes saved successfully.');
      if (isNew) navigate(`/email-marketing/automations/${id}`, { replace: true });
    },
    onError: (err: any) => {
      toast('error', 'Save Failed', err?.message || 'Could not save automation.');
    }
  });

  const onConnect = useCallback((params: Connection) => {
    const edgeDefaults: Partial<Edge> = { animated: true, style: { stroke: 'var(--primary, #6366f1)', strokeWidth: 2 } };
    setEdges(eds => addEdge({ ...params, ...edgeDefaults } as Edge, eds));
  }, [setEdges]);

  const addStepNode = (stepType: string) => {
    const cfg = NODE_STYLES[stepType];
    const newNode: Node = {
      id: nanoid(),
      type: 'automationNode',
      position: { x: 300 + (Math.random() * 80 - 40), y: 160 + nodes.length * 110 },
      data: { stepType, label: cfg.label, description: '' },
    };
    setNodes(nds => [...nds, newNode]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-24 text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin mr-3 text-primary" /> Loading workflow canvas…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-bg text-text-main">
      {/* Top Bar / Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-surface/90 border-b border-border/60 backdrop-blur-md shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/email-marketing/automations')}
            className="p-1.5 rounded-lg border border-border/60 hover:bg-surface text-text-muted hover:text-text-main transition-colors"
            title="Back to Automations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <input
              value={automationName}
              onChange={e => setAutomationName(e.target.value)}
              className="bg-transparent text-text-main font-bold text-base border-b border-transparent hover:border-border/60 focus:border-primary outline-none px-1 transition-all"
              placeholder="Automation Name"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted bg-surface-hover/80 px-3 py-1.5 rounded-full border border-border/50">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>Trigger:</span>
            <select
              value={triggerType}
              onChange={e => setTriggerType(e.target.value)}
              disabled={!isNew}
              className="bg-transparent text-text-main font-bold focus:outline-none cursor-pointer"
            >
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                <option key={k} value={k} className="bg-surface text-text-main">{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-full text-xs font-bold transition-all shadow-interactive cursor-pointer"
          >
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Automation
          </button>
        </div>
      </div>

      {/* Visual Canvas Area */}
      <div className="flex-1 overflow-hidden relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-bg"
        >
          <Background color="rgba(255,255,255,0.08)" gap={24} size={1} />
          <Controls className="!bg-surface !border-border/60 !shadow-luxury !rounded-xl overflow-hidden" />
          <MiniMap className="!bg-surface !border-border/60 !rounded-xl shadow-luxury" nodeColor="#6366f1" />

          {/* Step type palette panel */}
          <Panel position="top-left" className="!left-5 !top-5">
            <div className="bg-surface/90 border border-border/60 rounded-2xl p-4 shadow-luxury backdrop-blur-md w-56">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Add Node Step</span>
                <Sparkles className="w-3 h-3 text-primary" />
              </div>
              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {STEP_PALETTE.map(stepType => {
                  const cfg = NODE_STYLES[stepType];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={stepType}
                      onClick={() => addStepNode(stepType)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-text-muted hover:bg-surface-hover hover:text-text-main transition-all text-left font-medium border border-transparent hover:border-border/40"
                    >
                      <Plus className="w-3 h-3 text-primary" />
                      <Icon className="w-3.5 h-3.5 text-text-muted" />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
