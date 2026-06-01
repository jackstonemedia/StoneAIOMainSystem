import { useCallback, useEffect, useState, useRef } from 'react';
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

import { nanoid } from 'nanoid';

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
  const [history, setHistory] = useState<{nodes: any[], edges: any[]}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // UI State
  const [selectedNativeNodeId, setSelectedNativeNodeId] = useState<string | null>(null);
  const [showRunLog, setShowRunLog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Unsaved changes native blocker
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Load Canvas
  useEffect(() => {
    if (workflow) setTitle(workflow.name);
    
    if (nativeDef) {
      // Hydrate native
      setNodes(nativeDef.nodes.map((n: any) => ({
        ...n,
        data: {
          ...n.data,
          runStatus: selectedRunId && nativeRunDetail?.runData?.nodeRuns?.[n.id] 
            ? nativeRunDetail.runData.nodeRuns[n.id].status 
            : undefined
        }
      })));
      setEdges(nativeDef.edges);
      setIsDirty(false);
      
      if (history.length === 0) {
        setHistory([{ nodes: nativeDef.nodes, edges: nativeDef.edges }]);
        setHistoryIndex(0);
      }
    }
  }, [workflow, nativeDef, nativeRunDetail, selectedRunId, history.length]);

  // Auto-save history snapshot on changes
  const saveHistorySnapshot = useCallback((newNodes: any[], newEdges: any[]) => {
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1);
      next.push({ nodes: newNodes, edges: newEdges });
      if (next.length > 50) next.shift(); // Max 50
      return next;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 50));
  }, [historyIndex]);

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
      let label;
      if (connection.sourceHandle === 'true') label = 'True';
      else if (connection.sourceHandle === 'false') label = 'False';
      else if (connection.sourceHandle === 'loop') label = 'Loop';
      
      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${connection.sourceHandle || ''}`,
        targetHandle: connection.targetHandle || undefined,
        label,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: 'var(--bg)', fillOpacity: 0.8 },
      };
      const result = addEdge(newEdge, eds);
      saveHistorySnapshot(nodes, result);
      return result;
    });
    setIsDirty(true);
  }, [nodes, saveHistorySnapshot, setEdges]);

  // Handle Drag/Drop from Native Node Library
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeImplStr = event.dataTransfer.getData('application/reactflow-native-node');
      if (!nodeImplStr) return;
      const nodeImpl = JSON.parse(nodeImplStr);

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = reactFlowBounds ? {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 40,
      } : { x: 250, y: 250 };

      const newNodeId = `node_${nanoid(8)}`;
      const newNode = {
        id: newNodeId,
        type: nodeImpl.type.startsWith('trigger.') ? 'triggerStep' : 'nativeStep',
        position,
        data: {
          node: {
            id: newNodeId,
            type: nodeImpl.type,
            label: nodeImpl.displayName,
            config: {}
          },
          nodeImpl
        },
      };

      setNodes((nds) => {
        const next = nds.concat(newNode);
        saveHistorySnapshot(next, edges);
        return next;
      });
      setIsDirty(true);
    },
    [setNodes, edges, saveHistorySnapshot]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<any>) => {
    setSelectedNativeNodeId(node.id);
  }, []);

  const handleNativeNodeUpdate = (updatedNativeNode: any) => {
    setNodes((nds) => {
      const next = nds.map((n) => n.id === updatedNativeNode.id ? { ...n, data: { ...n.data, node: updatedNativeNode } } : n);
      saveHistorySnapshot(next, edges);
      return next;
    });
    setIsDirty(true);
  };

  const handleNativeDelete = () => {
    if (!selectedNativeNodeId) return;
    setEdges((eds) => eds.filter(e => e.source !== selectedNativeNodeId && e.target !== selectedNativeNodeId));
    setNodes((nds) => nds.filter(n => n.id !== selectedNativeNodeId));
    setSelectedNativeNodeId(null);
    setIsDirty(true);
  };

  const handleNativeDuplicate = () => {
    if (!selectedNativeNodeId) return;
    const target = nodes.find(n => n.id === selectedNativeNodeId);
    if (!target) return;
    
    const newId = `node_${nanoid(8)}`;
    const newNode = {
      ...target,
      id: newId,
      position: { x: target.position.x + 50, y: target.position.y + 50 },
      data: {
        ...target.data,
        node: { ...target.data.node, id: newId, label: `${target.data.node.label} (Copy)` }
      }
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNativeNodeId(newId);
    setIsDirty(true);
  };

  const handleSave = async () => {
    // Save native workflow definition
    const payloadNodes = nodes.map(n => ({
      id: n.id,
      type: n.data.node.type,
      data: { config: n.data.node.config },
      position: n.position
    }));
    await saveNativeDef.mutateAsync({ nodes: payloadNodes, edges });
    
    if (title !== workflow?.name) {
      await updateWorkflow.mutateAsync({ name: title });
    }

    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleTest = async () => {
    setTestError(null);
    try {
      await handleSave(); // Auto save before test
      const run = await testNative.mutateAsync({});
      setSelectedRunId(run.runId);
      setShowRunLog(true);
    } catch (e: any) {
      setTestError(e.message ?? 'Test failed');
    }
  };

  const handleTogglePublish = async () => {
    if (workflow?.status === 'published') {
      await pauseNative.mutateAsync();
    } else {
      await publishNative.mutateAsync();
    }
  };

  const KeyboardHandler = () => {
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { 
          // Undo
          e.preventDefault();
          if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setNodes(history[historyIndex - 1].nodes);
            setEdges(history[historyIndex - 1].edges);
          }
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'z') {
          // Redo
          e.preventDefault();
          if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setNodes(history[historyIndex + 1].nodes);
            setEdges(history[historyIndex + 1].edges);
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    return null;
  };

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
      <KeyboardHandler />
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
            onClick={() => setShowRunLog(true)}
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

      {/* Main canvas area */}
      <div className="flex flex-1 overflow-hidden" ref={reactFlowWrapper}>
        {/* Library Panel */}
        <NativeNodeLibrary onAddNode={(impl) => {
          const newNodeId = `node_${nanoid(8)}`;
          const newNode = {
            id: newNodeId,
            type: impl.type.startsWith('trigger.') ? 'triggerStep' : 'nativeStep',
            position: { x: 250, y: 250 },
            data: { node: { id: newNodeId, type: impl.type, label: impl.displayName, config: {} }, nodeImpl: impl },
          };
          setNodes(nds => [...nds, newNode]);
          setIsDirty(true);
        }} />

        {/* Canvas */}
        <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={NODE_TYPES}
            snapToGrid={true}
            snapGrid={[20, 20]}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode="Delete"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} color="var(--color-border)" />
            <Controls className="!bg-surface !border-border" />
            <MiniMap className="!bg-surface !border-border" nodeColor="var(--color-accent)" />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-text-muted text-sm font-medium">Add nodes from the left panel</p>
                <p className="text-text-muted text-xs mt-1">Start with a Trigger, then add Actions</p>
              </div>
            </div>
          )}
        </div>

        {/* Config Panel */}
        {selectedNativeNodeId && (
          <NativeConfigPanel
            node={nodes.find(n => n.id === selectedNativeNodeId)?.data.node}
            nodeImpl={nodes.find(n => n.id === selectedNativeNodeId)?.data.nodeImpl}
            onUpdate={handleNativeNodeUpdate}
            onClose={() => setSelectedNativeNodeId(null)}
            onDelete={handleNativeDelete}
            onDuplicate={handleNativeDuplicate}
            onTestNode={async () => {
              await testNativeNode.mutateAsync({ nodeId: selectedNativeNodeId });
            }}
          />
        )}
      </div>
    </div>
  );
}
