// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { useWorkflow, useCreateWorkflow, useUpdateWorkflow, usePublishNativeWorkflow, useTestNativeWorkflow } from '../hooks/useWorkflows';
import { useToast } from '../components/ui/Toast';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  MiniMap,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  ArrowLeft, Play, Save, Settings, Zap, Bot, Box, MessageSquare, 
  Code, GitBranch, Repeat, Clock, Send, Mic, Sparkles, Volume2, 
  User, Database, Plus, X, Users
} from 'lucide-react';

import { getNodeDefaults } from '../data/workflowNodes';
import VoiceAgentBuilder from './VoiceAgentBuilder';
import { VoiceNode } from '../components/builder/VoiceNode';
import AIBuilderChat from '../components/builder/AIBuilderChat';
import NodeInspector from '../components/builder/NodeInspector';
import { NativeNodeLibrary } from '../components/builder/native/NativeNodeLibrary';
import ExecutionLogsPanel from '../components/builder/ExecutionLogsPanel';
import AgentConfigPanel from '../components/builder/AgentConfigPanel';

const nodeTypes = {
  voice: VoiceNode,
};

const initialNodes: any[] = [];
const initialEdges: any[] = [];

export default function AgentBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: agentIdFromParams, workflowId } = useParams<{ id: string, workflowId: string }>();
  const activeId = workflowId || agentIdFromParams;
  
  const agentType = searchParams.get('type') || 'workflow';
  const isCanvasType = agentType === 'workflow';
  // Determine back-navigation target based on which route we came from
  const backTarget = workflowId !== undefined ? '/workflows' : '/agents';
  const { toast } = useToast();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // React Query hooks
  const { data: workflowData } = useWorkflow(activeId || '');
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const publishWorkflow = usePublishNativeWorkflow(activeId || '');
  const testWorkflow = useTestNativeWorkflow(activeId || '');

  // Canvas State
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Prompt/Config State (Voice & Autonomous)
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant designed to resolve customer inquiries efficiently and politely.');
  const [voiceId, setVoiceId] = useState('rachel');
  const [attachedTools, setAttachedTools] = useState(['Zendesk Search', 'Stripe Refunds']);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: `Hi! I'm your AI builder. Describe what you want this ${agentType} agent to do, and I'll configure it for you.` }
  ]);
  const [chatInput, setChatInput] = useState('');

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<{nodeId: string, status: 'running'|'success'|'error', time: string, message: string}[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2 } }, eds)), [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const typeStr = event.dataTransfer.getData('application/reactflow');
      if (!typeStr || !reactFlowInstance) return;

      const nodeData = JSON.parse(typeStr);
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `step_${Math.random().toString(36).substr(2, 6)}`,
        type: 'custom',
        position,
        data: { 
          label: nodeData.name, 
          nodeDefId: nodeData.id,
          pieceVersion: nodeData.version || '~1.0.0',
          type: nodeData.type,
          input: {}
        },
      };

      setNodes((nds) => nds.concat(newNode as any));
    },
    [reactFlowInstance, setNodes]
  );

  const agentId = activeId || 'default';

  // Load workflow to canvas
  useEffect(() => {
    if (workflowData && isCanvasType && workflowData.version?.trigger) {
      const trigger = workflowData.version.trigger;
      const newNodes: any[] = [];
      const newEdges: any[] = [];
      let current: any = trigger;
      let prevId = null;
      let y = 100;
      let x = 400;
      
      while (current) {
        const nodeId = current.name || `step_${Math.random().toString(36).substr(2, 6)}`;
        newNodes.push({
          id: nodeId,
          type: 'custom',
          position: { x, y },
          data: {
            label: current.displayName || current.name,
            nodeDefId: current.settings?.pieceName || current.pieceName,
            pieceVersion: current.settings?.pieceVersion || '~1.0.0',
            actionName: current.settings?.actionName,
            triggerName: current.settings?.triggerName,
            type: current.type,
            input: current.settings?.input || {}
          }
        });
        
        if (prevId) {
          newEdges.push({
            id: `e_${prevId}_${nodeId}`,
            source: prevId,
            target: nodeId,
            animated: true,
            style: { stroke: '#52677D', strokeWidth: 2 }
          });
        }
        prevId = nodeId;
        y += 150;
        current = current.nextAction;
      }
      
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [workflowData, isCanvasType, setNodes, setEdges]);

  const buildFlowDefinition = (currentNodes: any[], currentEdges: any[]) => {
    const incomingEdges = new Set(currentEdges.map(e => e.target));
    const rootNode = currentNodes.find(n => !incomingEdges.has(n.id)) || currentNodes[0];
    
    if (!rootNode) return { trigger: { name: 'trigger', type: 'EMPTY', settings: {} } };

    const buildStep = (node: any): any => {
      const outEdge = currentEdges.find(e => e.source === node.id);
      const nextNode = outEdge ? currentNodes.find(n => n.id === outEdge.target) : null;
      
      const isTrigger = !incomingEdges.has(node.id);
      
      const step: any = {
        name: node.id,
        displayName: node.data.label,
        type: isTrigger ? 'PIECE_TRIGGER' : 'PIECE',
        valid: true,
        settings: {
          pieceName: node.data.nodeDefId,
          pieceVersion: node.data.pieceVersion || '~1.0.0',
          input: node.data.input || {}
        },
      };
      
      if (node.data.actionName) step.settings.actionName = node.data.actionName;
      if (node.data.triggerName) step.settings.triggerName = node.data.triggerName;
      
      if (nextNode) {
        step.nextAction = buildStep(nextNode);
      }
      
      return step;
    };

    return { trigger: buildStep(rootNode) };
  };

  const handleSaveWorkflow = async (): Promise<boolean> => {
    setSaveStatus('saving');
    try {
      if (isCanvasType) {
        const flowDefinition = buildFlowDefinition(nodes, edges);
        if (activeId) {
          await updateWorkflow.mutateAsync({ id: activeId, definition: flowDefinition });
        } else {
          const newFlow = await createWorkflow.mutateAsync({ name: 'Untitled Workflow', definition: flowDefinition });
          navigate(`/workflows/${newFlow.id}/builder`);
        }
      } else {
        // Fallback for non-canvas save logic if needed
        const res = await fetch(`/api/agents/${agentId}/workflow`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes, edges })
        });
        if (!res.ok) throw new Error('Failed to save');
      }

      setSaveStatus('saved');
      toast('success', 'Workflow saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
      return true;
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      toast('error', 'Failed to save workflow');
      setTimeout(() => setSaveStatus('idle'), 3000);
      return false;
    }
  };

  const handleDeploy = async () => {
    const saved = await handleSaveWorkflow();
    if (!saved || !activeId) return;
    try {
      await publishWorkflow.mutateAsync(activeId);
      toast('success', 'Workflow deployed & active!');
    } catch (err) {
      toast('error', 'Failed to deploy workflow');
    }
  };

  const handleTestRun = async () => {
    await handleSaveWorkflow();
    if (!activeId) return;
    setIsExecuting(true);
    setShowLogs(true);
    setExecutionLogs([]);
    try {
      const res = await testWorkflow.mutateAsync({});
      toast('success', 'Run started!');
      // Could poll the run id here, for now just show a dummy log or rely on other mechanism
      setExecutionLogs([{
        nodeId: 'system',
        status: 'running',
        time: new Date().toLocaleTimeString(),
        message: `Execution ${res.id} started...`
      }]);
      setTimeout(() => setIsExecuting(false), 2000);
    } catch (err) {
      toast('error', 'Run failed to start');
      setIsExecuting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    
    if (!isCanvasType) {
      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `I've updated the agent configuration based on your request.` }]);
        setAttachedTools(prev => [...prev, 'Updated Configuration']);
      }, 1000);
      return;
    }

    setChatMessages(prev => [...prev, { role: 'assistant', content: '⏳ Generating workflow...' }]);

    try {
      const existingWorkflow = nodes.length > 0 ? {
        nodes: nodes.map(n => ({ id: n.id, nodeDefId: n.data.nodeDefId, label: n.data.label, config: n.data })),
        edges: edges.map(e => ({ source: e.source, target: e.target, sourceHandle: (e as any).sourceHandle }))
      } : undefined;

      const res = await fetch('/api/workflow-ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg, existingWorkflow })
      });

      if (!res.ok) throw new Error((await res.json()).message || 'Failed to generate workflow');

      const workflow = await res.json();

      if (workflow.nodes && workflow.nodes.length > 0) {
        const X_START = 50;
        const Y_START = 200;
        const X_GAP = 300;
        const Y_GAP = 150;

        const nodeIds = workflow.nodes.map((n: any) => n.id);
        const inDegree: Record<string, number> = {};
        nodeIds.forEach((id: string) => inDegree[id] = 0);
        (workflow.edges || []).forEach((e: any) => { if (inDegree[e.target] !== undefined) inDegree[e.target]++; });

        const queue: string[] = nodeIds.filter((id: string) => inDegree[id] === 0);
        const ordered: string[] = [];
        const children: Record<string, string[]> = {};
        nodeIds.forEach((id: string) => children[id] = []);
        (workflow.edges || []).forEach((e: any) => { if (children[e.source]) children[e.source].push(e.target); });

        while (queue.length > 0) {
          const curr = queue.shift()!;
          ordered.push(curr);
          for (const child of children[curr]) {
            inDegree[child]--;
            if (inDegree[child] === 0) queue.push(child);
          }
        }
        nodeIds.forEach((id: string) => { if (!ordered.includes(id)) ordered.push(id); });

        const columnOf: Record<string, number> = {};
        const colCount: Record<number, number> = {};
        ordered.forEach((id) => {
          const parents = (workflow.edges || []).filter((e: any) => e.target === id).map((e: any) => columnOf[e.source] ?? 0);
          const col = parents.length > 0 ? Math.max(...parents) + 1 : 0;
          columnOf[id] = col;
          colCount[col] = (colCount[col] || 0) + 1;
        });

        const colRow: Record<number, number> = {};
        const newNodes = workflow.nodes.map((n: any) => {
          const col = columnOf[n.id] ?? 0;
          const row = colRow[col] || 0;
          colRow[col] = row + 1;
          const totalInCol = colCount[col] || 1;
          const yOffset = totalInCol > 1 ? (row - (totalInCol - 1) / 2) * Y_GAP : 0;
          return {
            id: n.id, type: 'custom', position: { x: X_START + col * X_GAP, y: Y_START + yOffset },
            data: { label: n.label, nodeDefId: n.nodeDefId, ...getNodeDefaults(n.nodeDefId), ...n.config }
          };
        });

        const newEdges = (workflow.edges || []).map((e: any, i: number) => ({
          id: `ai_e_${Date.now()}_${i}`, source: e.source, target: e.target, sourceHandle: e.sourceHandle || null, animated: true, style: { stroke: '#52677D', strokeWidth: 2 }
        }));

        setNodes(newNodes);
        setEdges(newEdges);
      }

      setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: workflow.explanation || 'Workflow generated! Check the canvas.' }]);
    } catch (error: any) {
      setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `❌ ${error.message || 'Failed to generate workflow. Make sure GOOGLE_AI_API_KEY is set.'}` }]);
    }
  };

  const getTypeColor = () => {
    switch (agentType) {
      case 'voice': return 'text-light-purple bg-light-purple/10 border-light-purple/20';
      case 'autonomous': return 'text-purple bg-purple/10 border-purple/20';
      case 'assistant': return 'text-primary bg-primary/10 border-primary/20';
      case 'workflow':
      default: return 'text-teal bg-teal/10 border-teal/20';
    }
  };

  if (agentType === 'voice') {
    return <VoiceAgentBuilder />;
  }

  return (
    <div className="h-screen w-full flex flex-col bg-transparent text-text-main font-sans overflow-hidden">
      <header className="h-14 border-b border-border/50 bg-surface/40 backdrop-blur-xl flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(backTarget)} className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-md transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {workflowData?.version?.displayName || workflowData?.name || (activeId ? 'Loading…' : 'New Workflow')}
            </span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider ${getTypeColor()}`}>{agentType}</span>
            {workflowData?.status === 'ENABLED' ? (
              <span className="w-2 h-2 rounded-full bg-green ml-2" title="ENABLED" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-text-muted ml-2" title="DISABLED" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="text-xs text-text-muted flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> Save failed
            </span>
          )}
          {saveStatus === 'idle' && (
            <span className="text-xs text-text-muted flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> Auto-saved
            </span>
          )}
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={handleSaveWorkflow}
            disabled={saveStatus === 'saving'}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-main hover:bg-surface-hover border border-border transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save Config
          </button>
          <button
            onClick={handleTestRun}
            disabled={isExecuting || saveStatus === 'saving'}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-main hover:bg-surface-hover border border-border transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> {isExecuting ? 'Running...' : 'Test Run'}
          </button>
          <button
            onClick={handleDeploy}
            disabled={saveStatus === 'saving' || !activeId}
            className="bg-primary text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {workflowData?.status === 'ENABLED' ? 'Publish Updates' : 'Publish'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        <AIBuilderChat 
          messages={chatMessages} 
          input={chatInput} 
          onInputChange={setChatInput} 
          onSubmit={handleSendMessage} 
        />

        <main className="flex-1 relative bg-transparent flex flex-col overflow-hidden">
          {isCanvasType ? (
            <div className="flex-1 relative">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={(_, node) => setSelectedNode(node)}
                onPaneClick={() => setSelectedNode(null)}
                nodeTypes={nodeTypes}
                fitView
                className="bg-transparent"
              >
                <Background color="var(--border)" gap={16} size={1} />
                <Controls className="bg-surface border border-border rounded-md shadow-sm" />
                <MiniMap 
                  className="bg-surface border border-border rounded-md shadow-sm"
                  nodeColor={(n) => {
                    if (n.type === 'trigger') return 'var(--color-primary)';
                    if (n.type === 'llm') return 'var(--color-amber)';
                    if (n.type === 'tool') return 'var(--color-green)';
                    if (n.type === 'output') return 'var(--color-teal)';
                    return '#526';
                  }}
                />
                <Panel position="top-right" className="bg-surface/60 backdrop-blur-xl border border-border/50 rounded-lg p-2 shadow-lg flex items-center gap-3">
                  <span className="text-xs font-semibold text-text-muted px-2">CANVAS</span>
                </Panel>
              </ReactFlow>
              
              {showLogs && activeId && (
                <ExecutionLogsPanel
                  flowId={activeId}
                  onClose={() => setShowLogs(false)}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-transparent relative">
              <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Agent Configuration</h2>
                  <p className="text-text-muted">Define the persona, instructions, and capabilities of your {agentType} agent.</p>
                </div>

                <div className="bg-surface/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> System Instructions</h3>
                  <textarea 
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono leading-relaxed"
                    placeholder="You are a helpful customer support agent..."
                  />
                </div>

                {agentType === 'voice' && (
                  <>
                    <div className="bg-surface/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Volume2 className="w-4 h-4 text-light-purple" /> Voice Settings</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-2">Provider</label>
                          <select className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                            <option>ElevenLabs</option><option>OpenAI</option><option>PlayHT</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-2">Voice Model</label>
                          <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                            <option value="rachel">Rachel (American, Female)</option><option value="drew">Drew (American, Male)</option><option value="mimik">Mimik (British, Female)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="bg-surface/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-text-muted0" /> CRM Integration</h3>
                      <div className="space-y-4">
                        <label className="flex items-center gap-3">
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                          <span className="text-sm">Auto-log calls to AgentForge CRM</span>
                        </label>
                        <p className="text-xs text-text-muted pl-7">When enabled, this agent will automatically create an activity record in the CRM after every call, including a summary and transcript link.</p>
                      </div>
                    </div>
                  </>
                )}

                {agentType === 'autonomous' && (
                  <div className="bg-surface/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-text-muted0" /> CRM Permissions</h3>
                    <div className="space-y-4">
                      <p className="text-sm text-text-muted mb-4">Control what this autonomous agent can read and write in your AgentForge CRM.</p>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg"><input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" /><span className="text-sm font-medium">Read Contacts</span></label>
                        <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" /><span className="text-sm font-medium">Write Contacts</span></label>
                        <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg"><input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" /><span className="text-sm font-medium">Read Deals</span></label>
                        <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" /><span className="text-sm font-medium">Write Deals</span></label>
                      </div>
                    </div>
                  </div>
                )}

                {agentType === 'assistant' && (
                  <div className="bg-surface/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Assistant Settings</h3>
                    <div className="space-y-4">
                      <p className="text-sm text-text-muted mb-4">Configure how this AI Assistant interacts with the user and the workspace.</p>
                      <div className="space-y-4">
                        <label className="flex items-center gap-3"><input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" /><span className="text-sm">App-wide visibility (Omnipresent)</span></label>
                        <label className="flex items-center gap-3"><input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" /><span className="text-sm">Access to Cloud Computer environment</span></label>
                        <label className="flex items-center gap-3"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" /><span className="text-sm">Access to user's personalized Calendar</span></label>
                      </div>
                    </div>
                  </div>
                )}

                <AgentConfigPanel
                  attachedTools={attachedTools}
                  onRemoveTool={(i) => setAttachedTools(prev => prev.filter((_, idx) => idx !== i))}
                />
              </div>
            </div>
          )}
        </main>

        {isCanvasType && (
          selectedNode ? (
            <NodeInspector 
              selectedNode={selectedNode} 
              setSelectedNode={setSelectedNode} 
              setNodes={setNodes} 
              showAdvanced={showAdvanced} 
            />
          ) : (
            <NativeNodeLibrary onAddNode={(impl) => {
              const newNode = {
                id: `step_${Math.random().toString(36).substr(2, 6)}`,
                type: 'custom',
                position: { x: 250, y: 250 },
                data: { label: impl.displayName, nodeDefId: impl.type, input: {} },
              };
              setNodes((nds) => nds.concat(newNode as any));
            }} />
          )
        )}
      </div>
    </div>
  );
}
