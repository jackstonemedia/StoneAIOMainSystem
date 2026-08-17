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
import { nanoid } from 'nanoid';
import {
  Mail, Clock, GitBranch, Tag, Target, Globe,
  LogOut, Plus, Save, ArrowLeft, Zap, List,
  UserMinus, UserPlus, Edit3, Loader2,
} from 'lucide-react';

// ── Custom Node styles ────────────────────────────────────────────────────────

const NODE_STYLES: Record<string, { bg: string; border: string; icon: any; label: string }> = {
  TRIGGER:          { bg: 'bg-violet-900/60', border: 'border-violet-500', icon: Zap,         label: 'Trigger' },
  SEND_EMAIL:       { bg: 'bg-blue-900/60',   border: 'border-blue-500',   icon: Mail,        label: 'Send Email' },
  WAIT:             { bg: 'bg-amber-900/60',  border: 'border-amber-500',  icon: Clock,       label: 'Wait' },
  CONDITION_BRANCH: { bg: 'bg-orange-900/60', border: 'border-orange-500', icon: GitBranch,   label: 'Condition' },
  ADD_TAG:          { bg: 'bg-green-900/60',  border: 'border-green-500',  icon: Tag,         label: 'Add Tag' },
  REMOVE_TAG:       { bg: 'bg-red-900/60',    border: 'border-red-500',    icon: Tag,         label: 'Remove Tag' },
  UPDATE_FIELD:     { bg: 'bg-indigo-900/60', border: 'border-indigo-500', icon: Edit3,       label: 'Update Field' },
  ADD_TO_LIST:      { bg: 'bg-teal-900/60',   border: 'border-teal-500',   icon: UserPlus,    label: 'Add to List' },
  REMOVE_FROM_LIST: { bg: 'bg-pink-900/60',   border: 'border-pink-500',   icon: UserMinus,   label: 'Remove from List' },
  WEBHOOK_CALL:     { bg: 'bg-cyan-900/60',   border: 'border-cyan-500',   icon: Globe,       label: 'Webhook' },
  GOAL_CHECK:       { bg: 'bg-emerald-900/60',border: 'border-emerald-500',icon: Target,      label: 'Goal Check' },
  EXIT_AUTOMATION:  { bg: 'bg-gray-800',      border: 'border-gray-600',   icon: LogOut,      label: 'Exit' },
};

// ── Custom Node Component ─────────────────────────────────────────────────────

import { Handle, Position } from '@xyflow/react';

function AutomationNode({ data, selected }: { data: any; selected?: boolean }) {
  const cfg = NODE_STYLES[data.stepType] || NODE_STYLES.TRIGGER;
  const Icon = cfg.icon;
  const isBranch = data.stepType === 'CONDITION_BRANCH';

  return (
    <div className={`min-w-48 rounded-xl border-2 ${cfg.border} ${cfg.bg} ${selected ? 'ring-2 ring-white/30' : ''} backdrop-blur-sm shadow-xl overflow-hidden`}>
      {/* Input handle */}
      {data.stepType !== 'TRIGGER' && (
        <Handle type="target" position={Position.Top} className="!bg-white/40 !border-white/60 !w-3 !h-3" />
      )}

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-white opacity-80" />
          <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">{cfg.label}</span>
        </div>
        <div className="text-white font-medium text-sm leading-snug">{data.label || cfg.label}</div>
        {data.description && <div className="text-white/50 text-xs mt-1">{data.description}</div>}
      </div>

      {/* Output handles */}
      {isBranch ? (
        <>
          <div className="flex justify-between px-4 pb-3">
            <span className="text-xs text-green-400">Yes</span>
            <span className="text-xs text-red-400">No</span>
          </div>
          <Handle id="TRUE_PATH"  type="source" position={Position.Bottom} style={{ left: '30%' }}  className="!bg-green-400 !border-green-300 !w-3 !h-3" />
          <Handle id="FALSE_PATH" type="source" position={Position.Bottom} style={{ left: '70%' }}  className="!bg-red-400 !border-red-300 !w-3 !h-3" />
        </>
      ) : data.stepType !== 'EXIT_AUTOMATION' ? (
        <Handle type="source" position={Position.Bottom} className="!bg-white/40 !border-white/60 !w-3 !h-3" />
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
  // Default: single trigger node
  return [{
    id: 'trigger',
    type: 'automationNode',
    position: { x: 250, y: 50 },
    data: {
      stepType: 'TRIGGER',
      label: TRIGGER_LABELS[automation.triggerType] || automation.triggerType,
      description: 'Automation starts here',
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
  const isNew = !automationId || automationId === 'new';

  const [automationName, setAutomationName] = useState('New Automation');
  const [triggerType, setTriggerType] = useState('CONTACT_CREATED');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

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
      setSavedId(id);
      if (isNew) navigate(`/email-marketing/automations/${id}`, { replace: true });
    },
  });

  const onConnect = useCallback((params: Connection) => {
    const edgeDefaults: Partial<Edge> = { animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 } };
    setEdges(eds => addEdge({ ...params, ...edgeDefaults } as Edge, eds));
  }, [setEdges]);

  const addStepNode = (stepType: string) => {
    const cfg = NODE_STYLES[stepType];
    const newNode: Node = {
      id: nanoid(),
      type: 'automationNode',
      position: { x: 250 + Math.random() * 100, y: 200 + nodes.length * 120 },
      data: { stepType, label: cfg.label, description: '' },
    };
    setNodes(nds => [...nds, newNode]);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-6 py-3 bg-gray-900 border-b border-white/10 flex-shrink-0">
        <button onClick={() => navigate('/email-marketing/automations')} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <input
          value={automationName}
          onChange={e => setAutomationName(e.target.value)}
          className="bg-transparent text-white font-semibold border-b border-transparent hover:border-white/20 focus:border-violet-500 outline-none px-1"
        />
        <select
          value={triggerType}
          onChange={e => setTriggerType(e.target.value)}
          disabled={!isNew}
          className="bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex-1" />
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-all"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-950"
        >
          <Background color="#374151" gap={20} />
          <Controls className="!bg-gray-900 !border-white/10 !shadow-xl" />
          <MiniMap className="!bg-gray-900 !border-white/10" nodeColor="#6366f1" />

          {/* Step type palette panel */}
          <Panel position="top-left" className="!left-4 !top-4">
            <div className="bg-gray-900 border border-white/10 rounded-xl p-3 shadow-xl w-52">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Add Step</div>
              <div className="space-y-1">
                {STEP_PALETTE.map(stepType => {
                  const cfg = NODE_STYLES[stepType];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={stepType}
                      onClick={() => addStepNode(stepType)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-all text-left"
                    >
                      <Plus className="w-3 h-3 text-gray-500" />
                      <Icon className="w-3.5 h-3.5 text-gray-400" />
                      {cfg.label}
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
