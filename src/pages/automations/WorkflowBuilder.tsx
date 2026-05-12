import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection,
  BackgroundVariant, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ArrowLeft, Play, Rocket, Save, History, Loader2, AlertTriangle } from 'lucide-react';
import {
  useWorkflow, useUpdateWorkflow, usePublishWorkflow,
  useTestWorkflow, useWorkflowRuns, useWorkflowRun,
} from '../../hooks/useWorkflows';
import { APStepNode } from '../../components/builder/ap/APStepNode';
import { APStepConfigPanel } from '../../components/builder/ap/APStepConfigPanel';
import { APNodeLibrary } from '../../components/builder/ap/APNodeLibrary';
import { APRunLogDrawer } from '../../components/builder/ap/APRunLogDrawer';
import type { APStep, WorkflowNodeData } from '../../types/automation';

// Map AP step names to @xyflow/react nodes
const NODE_TYPES = { apStep: APStepNode };

/**
 * Converts the AP flow version (trigger is a nested linked list via .nextAction/.onSuccessAction etc.)
 * into @xyflow/react nodes + edges with auto-layout.
 * The real AP API returns nested objects, NOT flat nextActionName strings.
 */
function stepsToGraph(trigger: any): {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<WorkflowNodeData>[] = [];
  const edges: Edge[] = [];
  const visited = new Set<string>();

  // Walk the nested AP step tree and flatten it
  const walk = (step: any, index: { v: number }) => {
    if (!step || visited.has(step.name)) return;
    visited.add(step.name);

    nodes.push({
      id: step.name,
      type: 'apStep',
      position: { x: 250, y: index.v * 160 },
      data: { stepName: step.name, step: step as APStep },
    });
    index.v += 1;

    const pushEdge = (source: string, target: any, label?: string) => {
      if (!target) return;
      edges.push({
        id: `${source}-${target.name}`,
        source,
        target: target.name,
        label,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--text-muted)', fontSize: 10 },
      });
      walk(target, index);
    };

    // AP nested step fields (real API uses these object refs)
    pushEdge(step.name, step.nextAction);
    pushEdge(step.name, step.onSuccessAction, 'True');
    pushEdge(step.name, step.onFailureAction, 'False');
    pushEdge(step.name, step.firstLoopAction, 'Loop');

    // Also handle flat name refs (from our local state after user edits)
    if (!step.nextAction && step.nextActionName) {
      // these won't resolve to nodes unless we have an actionsMap — skip visual edge
    }
  };

  walk(trigger, { v: 0 });
  return { nodes, edges };
}

export default function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: workflow, isLoading, error } = useWorkflow(id!);
  const updateWorkflow = useUpdateWorkflow(id!);
  const publishWorkflow = usePublishWorkflow(id!);
  const testWorkflow = useTestWorkflow(id!);
  const { data: runs = [] } = useWorkflowRuns(id!);

  const [nodes, setNodes, onNodesChangeReactFlow] = useNodesState<Node<WorkflowNodeData>>([]);
  const [edges, setEdges, onEdgesChangeReactFlow] = useEdgesState<Edge>([]);
  
  const onEdgesChange = useCallback((changes: any) => {
    console.log('[WorkflowBuilder] onEdgesChange:', changes);
    onEdgesChangeReactFlow(changes);
  }, [onEdgesChangeReactFlow]);
  
  const onNodesChange = useCallback((changes: any) => {
    console.log('[WorkflowBuilder] onNodesChange:', changes);
    onNodesChangeReactFlow(changes);
  }, [onNodesChangeReactFlow]);
  const [selectedStep, setSelectedStep] = useState<APStep | null>(null);
  const [showRunLog, setShowRunLog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [title, setTitle] = useState<string>('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Unsaved changes native blocker (for page reloads/closes)
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const { data: runDetail } = useWorkflowRun(id!, selectedRunId ?? '');

  // Hydrate canvas from AP flow data
  useEffect(() => {
    if (workflow) setTitle(workflow.name);
    if (!workflow?.apFlow?.version) return;
    const version = workflow.apFlow.version;
    const trigger = version.trigger;
    if (!trigger) return;

    // AP API returns nested step tree — walk it directly
    const { nodes: newNodes, edges: newEdges } = stepsToGraph(trigger);

    // Overlay run statuses if available
    const nodesWithStatus = newNodes.map((n) => {
      const stepRun = runDetail?.steps?.[n.id];
      return stepRun ? { ...n, data: { ...n.data, runStatus: stepRun.status } } : n;
    });

    setNodes(nodesWithStatus);
    setEdges(newEdges);
    setIsDirty(false);
  }, [workflow?.apFlow?.version?.id, workflow?.name, runDetail]);

  const onConnect = useCallback((connection: Connection) => {
    console.log('[WorkflowBuilder] onConnect triggered', connection);
    setEdges((eds) => {
      let label;
      if (connection.sourceHandle === 'true') label = 'True';
      else if (connection.sourceHandle === 'false') label = 'False';
      else if (connection.sourceHandle === 'loop') label = 'Loop';
      
      const newEdge = {
        ...connection,
        label,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: 'var(--bg)', fillOpacity: 0.8 },
      };
      
      return addEdge(newEdge, eds);
    });
    setIsDirty(true);
  }, []);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<WorkflowNodeData>) => {
    setSelectedStep(node.data.step);
  }, []);

  const handleStepUpdate = (updatedStep: APStep) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === updatedStep.name ? { ...n, data: { ...n.data, step: updatedStep } } : n
      )
    );
    if (selectedStep?.name === updatedStep.name) {
      setSelectedStep(updatedStep);
    }
    setIsDirty(true);
  };

  const handleAddStep = (step: APStep) => {
    const newNode: Node<WorkflowNodeData> = {
      id: step.name,
      type: 'apStep',
      position: { x: 200 + Math.random() * 100, y: nodes.length * 160 },
      data: { stepName: step.name, step },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedStep(step);
    setIsDirty(true);
  };

  const handleDeleteStep = (stepName: string) => {
    // Find incoming and outgoing edges for the deleted node
    const incomingEdge = edges.find((e) => e.target === stepName);
    const outgoingEdge = edges.find((e) => e.source === stepName && (!e.sourceHandle || e.sourceHandle === 'source') && !e.label);

    setEdges((eds) => {
      let newEdges = eds.filter((e) => e.source !== stepName && e.target !== stepName);
      // Stitch together if there's a simple chain
      if (incomingEdge && outgoingEdge) {
        newEdges.push({
          id: `${incomingEdge.source}-${outgoingEdge.target}`,
          source: incomingEdge.source,
          sourceHandle: incomingEdge.sourceHandle,
          target: outgoingEdge.target,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: 'var(--primary)', strokeWidth: 2 },
        });
      }
      return newEdges;
    });

    setNodes((nds) => nds.filter((n) => n.id !== stepName));
    if (selectedStep?.name === stepName) setSelectedStep(null);
    setIsDirty(true);
  };

  const handleDuplicateStep = (step: APStep) => {
    const newName = `${step.name}_copy_${Math.random().toString(36).substr(2, 4)}`;
    const newStep = { ...step, name: newName, displayName: `${step.displayName} (Copy)` };
    
    // Position it slightly offset from the original
    const originalNode = nodes.find(n => n.id === step.name);
    const position = originalNode 
      ? { x: originalNode.position.x + 50, y: originalNode.position.y + 50 } 
      : { x: 200, y: nodes.length * 160 };

    const newNode: Node<WorkflowNodeData> = {
      id: newStep.name,
      type: 'apStep',
      position,
      data: { stepName: newStep.name, step: newStep },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedStep(newStep);
    setIsDirty(true);
  };

  const handleSave = async () => {
    // Reconstruct trigger and actions from current nodes
    const triggerNode = nodes.find((n) => n.data.step.type === 'TRIGGER');
    if (!triggerNode) return;

    // Deep clone to avoid mutating state
    const triggerStep = JSON.parse(JSON.stringify(triggerNode.data.step));

    const buildTree = (stepName: string): any => {
      const stepNode = nodes.find((n) => n.id === stepName);
      if (!stepNode) return undefined;
      const step = JSON.parse(JSON.stringify(stepNode.data.step));

      const nextEdge = edges.find((e) => e.source === stepName && (!e.sourceHandle || e.sourceHandle === 'source') && !e.label);
      if (nextEdge) {
        step.nextAction = buildTree(nextEdge.target);
      }

      if (step.type === 'BRANCH') {
        const trueEdge = edges.find((e) => e.source === stepName && e.label === 'True');
        if (trueEdge) step.onSuccessAction = buildTree(trueEdge.target);

        const falseEdge = edges.find((e) => e.source === stepName && e.label === 'False');
        if (falseEdge) step.onFailureAction = buildTree(falseEdge.target);
      }

      if (step.type === 'LOOP_ON_ITEMS') {
        const loopEdge = edges.find((e) => e.source === stepName && e.label === 'Loop');
        if (loopEdge) step.firstLoopAction = buildTree(loopEdge.target);
      }

      return step;
    };

    const nextEdge = edges.find((e) => e.source === triggerStep.name);
    if (nextEdge) {
      triggerStep.nextAction = buildTree(nextEdge.target);
    }

    await updateWorkflow.mutateAsync({
      name: title,
      trigger: triggerStep,
    });
    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleTest = async () => {
    setTestError(null);
    try {
      const run = await testWorkflow.mutateAsync(undefined);
      setSelectedRunId(run.id);
      setShowRunLog(true);
    } catch (e: any) {
      setTestError(e.message ?? 'Test failed');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
          <p className="text-sm text-text-muted">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-yellow-400" />
          <p className="text-sm text-text-main font-medium">Workflow not found</p>
          <button onClick={() => navigate('/automations')} className="text-sm text-accent hover:underline">
            ← Back to Automations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!isDirty || window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                navigate('/automations');
              }
            }}
            className="p-2 hover:bg-bg rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-text-muted" />
          </button>
          <div className="flex items-center group">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsDirty(true);
              }}
              className="font-semibold text-text-main bg-transparent border border-transparent hover:border-border focus:border-accent focus:outline-none rounded px-2 py-0.5 transition-colors"
              style={{ width: `${Math.max(10, title.length + 1)}ch` }}
            />
            {isDirty && (
              <span className="ml-2 text-xs text-text-muted shrink-0">• Unsaved changes</span>
            )}
          </div>
          {workflow.status === 'published' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
              Live
            </span>
          )}
          {workflow.status === 'paused' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border">
              Paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {testError && (
            <span className="text-xs text-red-400 max-w-xs truncate">{testError}</span>
          )}
          {saveSuccess && (
            <span className="text-xs text-green-400">Saved!</span>
          )}
          <button
            onClick={() => setShowRunLog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-text-main bg-bg hover:bg-surface border border-border rounded-lg transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            History
            {runs.length > 0 && (
              <span className="ml-1 text-xs bg-accent/20 text-accent px-1.5 rounded-full">{runs.length}</span>
            )}
          </button>
          <button
            onClick={handleTest}
            disabled={testWorkflow.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-main bg-bg hover:bg-surface border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            {testWorkflow.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Play className="w-3.5 h-3.5" />}
            Test
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || updateWorkflow.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-main bg-bg hover:bg-surface border border-border rounded-lg disabled:opacity-50 transition-colors"
          >
            {updateWorkflow.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
          <button
            onClick={() => publishWorkflow.mutate()}
            disabled={publishWorkflow.isPending || workflow.status === 'published'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent text-white rounded-lg disabled:opacity-50 hover:bg-accent/90 transition-colors"
          >
            {publishWorkflow.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Rocket className="w-3.5 h-3.5" />}
            {workflow.status === 'published' ? 'Published' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Main canvas area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — node library */}
        <APNodeLibrary onAddStep={handleAddStep} />

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode="Delete"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} color="var(--color-border)" />
            <Controls className="!bg-surface !border-border" />
            <MiniMap className="!bg-surface !border-border" nodeColor="var(--color-accent)" />
          </ReactFlow>

          {/* Empty state overlay */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-text-muted text-sm font-medium">Add nodes from the left panel</p>
                <p className="text-text-muted text-xs mt-1">Start with a Trigger, then add Actions</p>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar — step config */}
        {selectedStep && (
          <APStepConfigPanel
            step={selectedStep}
            allSteps={nodes.map((n) => n.data.step)}
            onUpdate={handleStepUpdate}
            onClose={() => setSelectedStep(null)}
            onDelete={() => handleDeleteStep(selectedStep.name)}
            onDuplicate={() => handleDuplicateStep(selectedStep)}
          />
        )}
      </div>

      {/* Run log drawer */}
      {showRunLog && id && (
        <APRunLogDrawer
          workflowId={id}
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          onClose={() => setShowRunLog(false)}
        />
      )}

    </div>
  );
}
