import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection,
  BackgroundVariant, MarkerType, ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ArrowLeft, Play, Rocket, Save, History, Loader2, AlertTriangle } from 'lucide-react';
import {
  useWorkflow, useUpdateWorkflow,
  useWorkflowRuns,
  useNativeWorkflowDefinition, useSaveNativeDefinition,
  usePublishNativeWorkflow, usePauseNativeWorkflow,
  useTestNativeWorkflow, useTestNativeNode, useNativeWorkflowRunDetail
} from '../../hooks/useWorkflows';

// Native Components
import { NativeStepNode } from '../../components/builder/native/NativeStepNode';
import { NativeNodeLibrary } from '../../components/builder/native/NativeNodeLibrary';
import { NativeConfigPanel } from '../../components/builder/native/NativeConfigPanel';
import { RunLogPanel } from '../../components/builder/RunLogPanel';

import { nanoid } from 'nanoid';
import { apiClient } from '../../lib/apiClient';

const NODE_TYPES = {
  nativeStep: NativeStepNode,
  triggerStep: NativeStepNode
};

export default function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Basic Details
  const { data: workflow, isLoading: isLoadingWorkflow, error } = useWorkflow(id!);
  const [title, setTitle] = useState<string>('');

  const updateWorkflow = useUpdateWorkflow(id!);
  const { data: runs = [] } = useWorkflowRuns(id!);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Native Hooks
  const { data: nativeDef } = useNativeWorkflowDefinition(id!);
  const saveNativeDef = useSaveNativeDefinition(id!);
  const publishNative = usePublishNativeWorkflow(id!);
  const pauseNative = usePauseNativeWorkflow(id!);
  const testNative = useTestNativeWorkflow(id!);
  const testNativeNode = useTestNativeNode(id!);
  const { data: nativeRunDetail } = useNativeWorkflowRunDetail(selectedRunId ?? '');

  // Canvas State
  const [nodes, setNodes, onNodesChangeReactFlow] = useNodesState<Node<any>>([]);
  const [edges, setEdges, onEdgesChangeReactFlow] = useEdgesState<Edge>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Undo/Redo State
  const historyRef = useRef<{ nodes: any[]; edges: any[] }[]>([]);
  const historyIndexRef = useRef(-1);

  // UI State
  const [selectedNativeNodeId, setSelectedNativeNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Catalog — stored in a ref so it doesn't re-trigger the canvas load effect
  const catalogRef = useRef<Record<string, any>>({});
  const [catalogReady, setCatalogReady] = useState(false);
  const canvasLoadedRef = useRef(false); // guard: only load canvas once

  // Click-to-add position tracker: stagger nodes so they don't stack
  const addPositionRef = useRef({ x: 200, y: 150 });

  // --- Load catalog once ---
  useEffect(() => {
    apiClient.get('/workflows/nodes/catalog')
      .then(res => {
        const map: Record<string, any> = {};
        (res.data as { category: string; nodes: any[] }[]).forEach(group => {
          group.nodes.forEach(n => { map[n.type] = n; });
        });
        catalogRef.current = map;
        setCatalogReady(true);
      })
      .catch(console.error);
  }, []);

  // --- Load canvas ONCE when both nativeDef and catalog are ready ---
  useEffect(() => {
    if (!nativeDef || !catalogReady || canvasLoadedRef.current) return;
    canvasLoadedRef.current = true;

    if (workflow) setTitle(workflow.name);

    let loadedNodes = nativeDef.nodes;
    if (!loadedNodes || loadedNodes.length === 0) {
      loadedNodes = [{
        id: 'trigger_1',
        type: 'triggerStep',
        position: { x: 400, y: 150 },
        data: { node: { id: 'trigger_1', type: 'trigger.manual', label: 'Manual Trigger', config: {} } }
      }];
    }

    const hydratedNodes = loadedNodes.map((n: any) => {
      const savedNode = n.data?.node ?? {
        id: n.id,
        type: n.data?.type ?? n.type,
        label: n.data?.label ?? n.data?.type ?? n.type ?? 'Node',
        config: n.data?.config ?? {},
      };
      const implType = n.data?.nodeImplType ?? savedNode.type;
      const nodeImpl = catalogRef.current[implType] ?? null;

      return {
        ...n,
        type: savedNode.type?.startsWith('trigger.') ? 'triggerStep' : (n.type ?? 'nativeStep'),
        data: { node: savedNode, nodeImpl },
      };
    });

    setNodes(hydratedNodes);
    setEdges(nativeDef.edges || []);
    setIsDirty(false);

    // Seed undo history
    historyRef.current = [{ nodes: hydratedNodes, edges: nativeDef.edges || [] }];
    historyIndexRef.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeDef, catalogReady]);

  // --- Update run status overlay without re-loading the whole canvas ---
  useEffect(() => {
    if (!selectedRunId || !nativeRunDetail) return;
    const runData = nativeRunDetail?.runData as Record<string, any[]> | null;
    const overallFailed = nativeRunDetail?.status === 'FAILED';
    const failedNodeId = nativeRunDetail?.errorMessage
      ? Object.keys(runData ?? {}).at(-1) // heuristic: last node that ran is the failed one
      : null;

    setNodes(nds => nds.map(n => {
      if (!runData) return n;
      const nodeOutput = runData[n.id];
      let runStatus: string | undefined;
      if (nodeOutput !== undefined) {
        // Node produced output — check if it was the failing node
        runStatus = (overallFailed && n.id === failedNodeId) ? 'FAILED' : 'SUCCEEDED';
      } else if (overallFailed && n.id === failedNodeId) {
        runStatus = 'FAILED';
      }
      return { ...n, data: { ...n.data, runStatus } };
    }));
  }, [nativeRunDetail, selectedRunId, setNodes]);

  // --- Workflow title sync ---
  useEffect(() => {
    if (workflow && !title) setTitle(workflow.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow]);

  // --- Unsaved changes guard ---
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // --- History helpers ---
  const pushHistory = useCallback((newNodes: any[], newEdges: any[]) => {
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push({ nodes: newNodes, edges: newEdges });
    if (next.length > 50) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(snap.nodes);
    setEdges(snap.edges);
  }, [setNodes, setEdges]);

  // --- Canvas event handlers ---
  const onNodesChange = useCallback((changes: any) => {
    onNodesChangeReactFlow(changes);
    setIsDirty(true);
  }, [onNodesChangeReactFlow]);

  const onEdgesChange = useCallback((changes: any) => {
    onEdgesChangeReactFlow(changes);
    setIsDirty(true);
  }, [onEdgesChangeReactFlow]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      let label: string | undefined;
      if (connection.sourceHandle === 'true') label = 'True';
      else if (connection.sourceHandle === 'false') label = 'False';
      else if (connection.sourceHandle === 'loop') label = 'Loop';

      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${connection.sourceHandle || 'default'}`,
        targetHandle: connection.targetHandle || undefined,
        type: 'smoothstep',
        label,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#475569' },
        style: { stroke: '#334155', strokeWidth: 1.5 },
        labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#0f111a', fillOpacity: 1, rx: 4 },
        labelBgPadding: [4, 6] as [number, number],
      };
      const result = addEdge(newEdge, eds);
      // push history with current nodes + new edges
      setNodes(nds => { pushHistory(nds, result); return nds; });
      return result;
    });
    setIsDirty(true);
  }, [setEdges, setNodes, pushHistory]);

  // Drag/Drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const nodeImplStr = event.dataTransfer.getData('application/reactflow-native-node');
    if (!nodeImplStr) return;
    const nodeImpl = JSON.parse(nodeImplStr);

    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const position = reactFlowBounds ? {
      x: event.clientX - reactFlowBounds.left - 120,
      y: event.clientY - reactFlowBounds.top - 40,
    } : { x: 300, y: 300 };

    const newNodeId = `node_${nanoid(8)}`;
    const newNode: Node<any> = {
      id: newNodeId,
      type: nodeImpl.type.startsWith('trigger.') ? 'triggerStep' : 'nativeStep',
      position,
      data: {
        node: { id: newNodeId, type: nodeImpl.type, label: nodeImpl.displayName, config: {} },
        nodeImpl,
      },
    };

    setNodes((nds) => {
      const next = [...nds, newNode];
      pushHistory(next, edges);
      return next;
    });
    setIsDirty(true);
  // edges intentionally captured at call time via closure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, pushHistory]);

  // Click-to-add from library (staggered positions so nodes don't pile up)
  const handleAddNodeFromLibrary = useCallback((impl: any) => {
    const newNodeId = `node_${nanoid(8)}`;

    // Stagger position
    const pos = { ...addPositionRef.current };
    addPositionRef.current = {
      x: pos.x + 280,
      y: pos.y,
    };
    // Wrap to next row after 3 columns
    if (addPositionRef.current.x > 1200) {
      addPositionRef.current = { x: 200, y: pos.y + 160 };
    }

    const newNode: Node<any> = {
      id: newNodeId,
      type: impl.type.startsWith('trigger.') ? 'triggerStep' : 'nativeStep',
      position: pos,
      data: {
        node: { id: newNodeId, type: impl.type, label: impl.displayName, config: {} },
        nodeImpl: impl,
      },
    };

    setNodes((nds) => {
      const next = [...nds, newNode];
      pushHistory(next, edges);
      return next;
    });
    setIsDirty(true);
  // edges captured at call time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, pushHistory]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<any>) => {
    setSelectedNativeNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNativeNodeId(null);
  }, []);

  const handleNativeNodeUpdate = useCallback((updatedNativeNode: any) => {
    setNodes((nds) => {
      const next = nds.map((n) =>
        n.id === updatedNativeNode.id ? { ...n, data: { ...n.data, node: updatedNativeNode } } : n
      );
      pushHistory(next, edges);
      return next;
    });
    setIsDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, pushHistory]);

  const handleNativeDelete = useCallback(() => {
    if (!selectedNativeNodeId) return;
    setEdges((eds) => eds.filter(e => e.source !== selectedNativeNodeId && e.target !== selectedNativeNodeId));
    setNodes((nds) => {
      const next = nds.filter(n => n.id !== selectedNativeNodeId);
      pushHistory(next, edges);
      return next;
    });
    setSelectedNativeNodeId(null);
    setIsDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNativeNodeId, setEdges, setNodes, pushHistory]);

  const handleNativeDuplicate = useCallback(() => {
    if (!selectedNativeNodeId) return;
    setNodes((nds) => {
      const target = nds.find(n => n.id === selectedNativeNodeId);
      if (!target) return nds;
      const newId = `node_${nanoid(8)}`;
      const newNode = {
        ...target,
        id: newId,
        position: { x: target.position.x + 60, y: target.position.y + 60 },
        data: {
          ...target.data,
          node: { ...target.data.node, id: newId, label: `${target.data.node.label} (Copy)` }
        }
      };
      const next = [...nds, newNode];
      pushHistory(next, edges);
      setSelectedNativeNodeId(newId);
      return next;
    });
    setIsDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNativeNodeId, setNodes, pushHistory]);



  // --- Save ---
  const handleSave = useCallback(async () => {
    const payloadNodes = nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        node: {
          id: n.id,
          type: n.data.node?.type ?? n.type,
          label: n.data.node?.label ?? n.data.node?.type ?? 'Node',
          config: n.data.node?.config ?? {},
          continueOnFail: n.data.node?.continueOnFail,
          disabled: n.data.node?.disabled,
        },
        nodeImplType: n.data.nodeImpl?.type ?? n.data.node?.type,
      }
    }));
    await saveNativeDef.mutateAsync({ nodes: payloadNodes, edges });

    if (title !== workflow?.name) {
      await updateWorkflow.mutateAsync({ name: title });
    }

    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [nodes, edges, title, workflow, saveNativeDef, updateWorkflow]);

  const handleTest = useCallback(async () => {
    setTestError(null);
    try {
      await handleSave();
      const run = await testNative.mutateAsync({});
      setSelectedRunId(run.runId);
    } catch (e: any) {
      setTestError(e.message ?? 'Test failed');
    }
  }, [handleSave, testNative]);

  const handleTogglePublish = useCallback(async () => {
    if (isDirty) {
      await handleSave();
    }
    if (workflow?.status === 'published') {
      await pauseNative.mutateAsync();
    } else {
      await publishNative.mutateAsync();
    }
  }, [workflow, pauseNative, publishNative, isDirty, handleSave]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.shiftKey && e.key === 'z') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, undo, redo]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoadingWorkflow) {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-yellow-400" />
          <p className="text-sm">Workflow not found</p>
          <button onClick={() => navigate('/automations')} className="text-accent hover:underline">← Back</button>
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
              if (!isDirty || window.confirm('Leave with unsaved changes?')) navigate('/automations');
            }}
            className="p-2 hover:bg-bg rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-text-muted" />
          </button>
          <div className="flex items-center group">
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
              className="font-semibold text-text-main bg-transparent border-transparent hover:border-border focus:border-accent focus:outline-none rounded px-2 transition-colors"
              style={{ width: `${Math.max(10, title.length + 1)}ch` }}
            />
            {isDirty && <span className="ml-2 text-xs text-text-muted">• Unsaved changes</span>}
          </div>

          <div className="flex items-center ml-4 gap-2">
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Native Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {testError && <span className="text-xs text-red-400 max-w-xs truncate">{testError}</span>}
          {saveSuccess && <span className="text-xs text-green-400">Saved!</span>}

          <button
            onClick={() => setSelectedRunId(runs[0]?.id ?? null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-text-main bg-bg hover:bg-surface border border-border rounded-lg"
          >
            <History className="w-3.5 h-3.5" />
            History
            {runs.length > 0 && <span className="ml-1 text-xs bg-accent/20 text-accent px-1.5 rounded-full">{runs.length}</span>}
          </button>

          <button
            onClick={handleTest}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-main bg-bg hover:bg-surface border border-border rounded-lg"
          >
            <Play className="w-3.5 h-3.5" /> Test
          </button>

          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-main bg-bg hover:bg-surface border border-border rounded-lg disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>

          <button
            onClick={handleTogglePublish}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              workflow.status === 'published'
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                : 'bg-accent text-white hover:bg-accent/90'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            {workflow.status === 'published' ? 'Pause' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Main canvas area — LEFT: config panel | CENTER: canvas | RIGHT: node library */}
      <div className="flex flex-1 overflow-hidden min-w-0" ref={reactFlowWrapper}>

        {/* Config Panel — left, only when a node is selected */}
        {selectedNativeNodeId && (
          <NativeConfigPanel
            node={nodes.find(n => n.id === selectedNativeNodeId)?.data.node}
            nodeImpl={nodes.find(n => n.id === selectedNativeNodeId)?.data.nodeImpl}
            lastRunData={nativeRunDetail?.runData?.[selectedNativeNodeId] ?? null}
            onUpdate={handleNativeNodeUpdate}
            onClose={() => setSelectedNativeNodeId(null)}
            onDelete={handleNativeDelete}
            onDuplicate={handleNativeDuplicate}
            onTestNode={async (nodeId, inputItems) => {
              const res = await testNativeNode.mutateAsync({ nodeId, inputItems });
              return res;
            }}
          />
        )}

        {/* Run Logs Panel — left, when History button clicked and run is selected */}
        {selectedRunId && !selectedNativeNodeId && (
          <RunLogPanel
            workflowId={id!}
            onClose={() => setSelectedRunId(null)}
            selectedRunId={selectedRunId}
            onRunSelect={setSelectedRunId}
            canvasNodes={nodes}
          />
        )}

        {/* Canvas — center, takes all remaining space */}
        <div className="flex-1 relative min-w-0" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={NODE_TYPES}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{
              stroke: '#334155',
              strokeWidth: 1.5,
            }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: false,
              markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#475569' },
              style: { stroke: '#334155', strokeWidth: 1.5 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} color="var(--color-border)" />
            <Controls className="!bg-surface !border-border" />
            <MiniMap className="!bg-surface !border-border" nodeColor="var(--color-accent)" />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-text-muted text-sm font-medium">Start building your workflow</p>
                <p className="text-text-muted text-xs mt-1">Add nodes from the panel on the right →</p>
              </div>
            </div>
          )}
        </div>

        {/* Node Library — right side */}
        <NativeNodeLibrary onAddNode={handleAddNodeFromLibrary} />
      </div>
    </div>
  );
}
