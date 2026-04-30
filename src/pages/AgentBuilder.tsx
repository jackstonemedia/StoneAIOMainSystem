import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { WorkflowCustomNode } from '../components/builder/WorkflowCustomNode';
import AIBuilderChat from '../components/builder/AIBuilderChat';
import NodeInspector from '../components/builder/NodeInspector';
import NodeLibrary from '../components/builder/NodeLibrary';

const nodeTypes = {
  custom: WorkflowCustomNode,
};

const initialNodes = [
  { id: '1', type: 'custom', position: { x: 50, y: 200 }, data: { label: 'Webhook Received', nodeDefId: 'trigger-webhook', description: 'POST /api/v1/webhook/...' } },
  { id: '2', type: 'custom', position: { x: 400, y: 200 }, data: { label: 'Extract Data', nodeDefId: 'ai-extract', model: 'claude-3-5-sonnet' } },
  { id: '3', type: 'custom', position: { x: 750, y: 200 }, data: { label: 'Google Sheets', nodeDefId: 'int-http', action: 'Append Row' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#52677D', strokeWidth: 2 } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#52677D', strokeWidth: 2 } },
];

export default function AgentBuilder() {
  const [searchParams] = useSearchParams();
  const agentType = searchParams.get('type') || 'workflow';
  const isCanvasType = agentType === 'workflow';

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
        id: `dnd_${Date.now()}`,
        type: 'custom',
        position,
        data: { label: nodeData.name, nodeDefId: nodeData.id, ...getNodeDefaults(nodeData.id) },
      };

      setNodes((nds) => nds.concat(newNode as any));
    },
    [reactFlowInstance, setNodes]
  );

  const agentId = searchParams.get('id') || 'default';

  const handleSaveWorkflow = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/workflow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      if (!res.ok) throw new Error('Failed to save');
      alert('Workflow saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Error saving workflow');
    }
  };

  const handleTestRun = async () => {
    await handleSaveWorkflow();
    setIsExecuting(true);
    setShowLogs(true);
    setExecutionLogs([]);
    
    const eventSource = new EventSource(`/api/agents/${agentId}/run`, { withCredentials: false });

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'log') {
          setExecutionLogs(prev => {
            const existingIdx = prev.findIndex(l => l.nodeId === data.nodeId);
            if (existingIdx >= 0 && data.status !== 'running') {
              const newLogs = [...prev];
              newLogs[existingIdx] = { ...newLogs[existingIdx], status: data.status, message: data.message };
              return newLogs;
            }
            return [...prev, {
              nodeId: data.nodeId,
              status: data.status,
              time: data.time || new Date().toLocaleTimeString(),
              message: data.message
            }];
          });
        } else if (data.type === 'done') {
          setIsExecuting(false);
          eventSource.close();
        } else if (data.type === 'error') {
          setExecutionLogs(prev => [...prev, {
            nodeId: 'system',
            status: 'error',
            time: new Date().toLocaleTimeString(),
            message: data.message
          }]);
          setIsExecuting(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('SSE Error:', err);
      }
    };

    eventSource.onerror = () => {
      setIsExecuting(false);
      eventSource.close();
    };
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
          <Link to="/agents" className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-md transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-semibold">Untitled Agent</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider ${getTypeColor()}`}>{agentType}</span>
            <span className="w-2 h-2 rounded-full bg-text-muted ml-2" title="Draft" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted flex items-center gap-1"><Save className="w-3.5 h-3.5" /> Saved just now</span>
          <div className="h-6 w-px bg-border mx-1" />
          <button onClick={handleSaveWorkflow} className="px-3 py-1.5 rounded-md text-sm font-medium text-text-main hover:bg-surface-hover border border-border transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Config
          </button>
          <button onClick={handleTestRun} disabled={isExecuting} className="px-3 py-1.5 rounded-md text-sm font-medium text-text-main hover:bg-surface-hover border border-border transition-colors flex items-center gap-2 disabled:opacity-50">
            <Play className="w-4 h-4" /> {isExecuting ? 'Running...' : 'Test Run'}
          </button>
          <button className="bg-primary text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            Deploy
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
              
              {showLogs && (
                <div className="absolute bottom-0 left-0 right-0 h-64 bg-surface/95 backdrop-blur-xl border-t border-border z-40 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-5">
                  <div className="p-3 border-b border-border flex items-center justify-between bg-bg/80">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-green" />
                      <h3 className="text-sm font-semibold">Execution Logs</h3>
                      {isExecuting && <span className="flex h-2 w-2 relative ml-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green"></span></span>}
                    </div>
                    <button onClick={() => setShowLogs(false)} className="text-text-muted hover:text-text-main p-1 rounded-md hover:bg-surface-hover">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2">
                    {executionLogs.length === 0 && <div className="text-text-muted flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" /> Waiting for execution to start...</div>}
                    {executionLogs.map((log, i) => (
                      <div key={i} className={`flex items-start gap-4 p-2 rounded border ${log.status === 'running' ? 'border-primary/30 bg-primary/5 text-primary' : log.status === 'success' ? 'border-green/30 bg-green/5 text-green' : 'border-red/30 bg-red/5 text-red'}`}>
                        <span className="text-text-muted shrink-0">[{log.time}]</span>
                        <span className="flex-1 font-medium">{log.message}</span>
                        {log.status === 'running' && <span className="animate-pulse">...</span>}
                      </div>
                    ))}
                  </div>
                </div>
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

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-surface/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Box className="w-4 h-4 text-green" /> Attached Tools</h3>
                      <button className="text-xs font-medium text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                    </div>
                    <div className="space-y-2">
                      {attachedTools.map((tool, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-bg border border-border rounded-lg group">
                          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-green/10 flex items-center justify-center text-green shrink-0"><Box className="w-4 h-4" /></div><span className="text-sm font-medium">{tool}</span></div>
                          <button className="text-text-muted hover:text-red transition-colors opacity-0 group-hover:opacity-100"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-surface/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Database className="w-4 h-4 text-amber" /> Knowledge Base</h3>
                      <button className="text-xs font-medium text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                    </div>
                    <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg bg-bg text-center px-4">
                      <Database className="w-6 h-6 text-text-muted mb-2" />
                      <p className="text-xs text-text-muted">No knowledge sources attached. Add documents or URLs to give your agent context.</p>
                    </div>
                  </div>
                </div>
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
            <NodeLibrary />
          )
        )}
      </div>
    </div>
  );
}
