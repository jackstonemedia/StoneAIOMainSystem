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
  NodeProps,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  ArrowLeft, Play, Save, Settings, Zap, Bot, Box, MessageSquare, 
  Code, GitBranch, Repeat, Clock, Send, Mic, Sparkles, Volume2, 
  User, Database, Plus, X, Users
} from 'lucide-react';

import { WORKFLOW_NODES } from '../data/workflowNodes';
import VoiceAgentBuilder from './VoiceAgentBuilder';

// --- Custom Nodes for Canvas Builder ---
const WorkflowCustomNode = ({ data }: NodeProps) => {
  const def = WORKFLOW_NODES.find(n => n.id === data.nodeDefId);
  const Icon = def ? def.icon : Box;
  const color = def ? def.colorClass : 'text-text-muted';
  const border = def ? def.colorClass.replace('text-', 'border-') : 'border-border';
  
  const hasInput = def ? def.category !== 'Triggers' : true;
  const hasOutput = def ? def.type !== 'output' : true;

  return (
    <div className={`bg-surface border-2 ${border} rounded-lg p-4 shadow-sm w-56 group hover:shadow-md transition-all`}>
      {hasInput && <Handle type="target" position={Position.Left} className={`w-3 h-3 ${def?.bgClass} border-2 border-bg`} />}
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${def?.bgClass} ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-sm">{def ? def.name : 'Unknown Node'}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">{def ? def.category : ''}</div>
        </div>
      </div>
      <div className="text-xs text-text-main font-medium mt-3 bg-bg/50 p-2 rounded border border-border/50 truncate">
        {data.label as string}
      </div>
      {hasOutput && <Handle type="source" position={Position.Right} className={`w-3 h-3 ${def?.bgClass} border-2 border-bg`} />}
    </div>
  );
};

const nodeTypes = {
  custom: WorkflowCustomNode,
};

const initialNodes = [
  { id: '1', type: 'custom', position: { x: 50, y: 200 }, data: { label: 'Webhook Received', nodeDefId: 'trigger-webhook', description: 'POST /api/v1/webhook/...' } },
  { id: '2', type: 'custom', position: { x: 400, y: 200 }, data: { label: 'Extract Data', nodeDefId: 'ai-extract', model: 'claude-3-5-sonnet' } },
  { id: '3', type: 'custom', position: { x: 750, y: 200 }, data: { label: 'Google Sheets', nodeDefId: 'int-http', action: 'Append Row' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#4361EE', strokeWidth: 2 } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#F77F00', strokeWidth: 2 } },
];

// --- Main Component ---
export default function AgentBuilder() {
  const [searchParams] = useSearchParams();
  const agentType = searchParams.get('type') || 'workflow';
  const isCanvasType = agentType === 'workflow';

  // Canvas State
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Prompt/Config State (Voice & Autonomous)
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant designed to resolve customer inquiries efficiently and politely.');
  const [voiceId, setVoiceId] = useState('rachel');
  const [attachedTools, setAttachedTools] = useState(['Zendesk Search', 'Stripe Refunds']);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: `Hi! I'm your AI builder. Describe what you want this ${agentType} agent to do, and I'll configure it for you.` }
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<{nodeId: string, status: 'running'|'success'|'error', time: string, message: string}[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
        data: { label: nodeData.name, nodeDefId: nodeData.id, ...nodeData.defaults },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const handleTestRun = () => {
    setIsExecuting(true);
    setShowLogs(true);
    setExecutionLogs([]);
    
    // Simulate node-by-node execution
    const executionPath = nodes; 
    let delay = 0;
    
    executionPath.forEach((node, idx) => {
      setTimeout(() => {
        setExecutionLogs(prev => [...prev, {
          nodeId: node.id,
          status: 'running',
          time: new Date().toLocaleTimeString(),
          message: `Executing node: ${node.data.label}...`
        }]);
        
        setTimeout(() => {
          setExecutionLogs(prev => prev.map(log => 
            log.nodeId === node.id 
              ? { ...log, status: 'success', message: `✅ Successfully completed ${node.data.label}` }
              : log
          ));
          
          if (idx === executionPath.length - 1) {
            setIsExecuting(false);
          }
        }, 1500);
        
      }, delay);
      delay += 2000;
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    setChatInput('');
    
    // Mock AI response
    setTimeout(() => {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I've updated the ${isCanvasType ? 'workflow canvas' : 'agent configuration'} based on your request. I added the necessary steps to handle that logic.` 
      }]);
      
      // Mock updating canvas
      if (isCanvasType) {
        const newNode = {
          id: Date.now().toString(),
          type: 'output',
          position: { x: 1100, y: 200 },
          data: { label: 'Send Slack Alert' }
        };
        setNodes(nds => [...nds, newNode]);
        setEdges(eds => [...eds, { id: `e3-${newNode.id}`, source: '3', target: newNode.id, animated: true, style: { stroke: '#06D6A0', strokeWidth: 2 } }]);
      } else {
        // Mock updating config
        setAttachedTools(prev => [...prev, 'Slack Notifications']);
      }
    }, 1500);
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
    <div className="h-screen w-full flex flex-col bg-bg text-text-main font-sans overflow-hidden">
      {/* Topbar */}
      <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Link to="/agents" className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-md transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-semibold">Untitled Agent</span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider ${getTypeColor()}`}>
              {agentType}
            </span>
            <span className="w-2 h-2 rounded-full bg-text-muted ml-2" title="Draft" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Save className="w-3.5 h-3.5" /> Saved just now
          </span>
          <div className="h-6 w-px bg-border mx-1" />
          <button 
            onClick={handleTestRun}
            disabled={isExecuting}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-main hover:bg-surface-hover border border-border transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> {isExecuting ? 'Running...' : 'Test Run'}
          </button>
          <button className="bg-primary text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            Deploy
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Panel - AI Builder Chat */}
        <aside className="w-80 border-r border-border bg-surface flex flex-col shrink-0 z-10">
          <div className="p-4 border-b border-border bg-bg/50 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">AI Builder</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-surface border border-border' : 'bg-primary/10 text-primary'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-text-muted" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-3 rounded-xl text-sm leading-relaxed max-w-[80%] ${
                  msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-bg border border-border rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-border bg-bg/50">
            <form onSubmit={handleSendMessage} className="relative">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask AI to build or modify..." 
                className="w-full pl-4 pr-10 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </form>
          </div>
        </aside>

        {/* Center - Main Builder Area */}
        <main className="flex-1 relative bg-bg flex flex-col overflow-hidden">
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
              className="bg-bg"
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
                  return '#eee';
                }}
              />
            </ReactFlow>
            
            {/* Execution Logs Drawer */}
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
            <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-bg">
              <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Agent Configuration</h2>
                  <p className="text-text-muted">Define the persona, instructions, and capabilities of your {agentType} agent.</p>
                </div>

                {/* System Instructions */}
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" /> System Instructions
                  </h3>
                  <textarea 
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono leading-relaxed"
                    placeholder="You are a helpful customer support agent..."
                  />
                </div>

                {/* Voice Settings (if voice) */}
                {agentType === 'voice' && (
                  <>
                    <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-light-purple" /> Voice Settings
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-2">Provider</label>
                          <select className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                            <option>ElevenLabs</option>
                            <option>OpenAI</option>
                            <option>PlayHT</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-2">Voice Model</label>
                          <select 
                            value={voiceId}
                            onChange={(e) => setVoiceId(e.target.value)}
                            className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <option value="rachel">Rachel (American, Female)</option>
                            <option value="drew">Drew (American, Male)</option>
                            <option value="mimik">Mimik (British, Female)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-pink-500" /> CRM Integration
                      </h3>
                      <div className="space-y-4">
                        <label className="flex items-center gap-3">
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                          <span className="text-sm">Auto-log calls to AgentForge CRM</span>
                        </label>
                        <p className="text-xs text-text-muted pl-7">
                          When enabled, this agent will automatically create an activity record in the CRM after every call, including a summary and transcript link.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Autonomous Settings (if autonomous) */}
                {agentType === 'autonomous' && (
                  <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4 text-pink-500" /> CRM Permissions
                    </h3>
                    <div className="space-y-4">
                      <p className="text-sm text-text-muted mb-4">
                        Control what this autonomous agent can read and write in your AgentForge CRM.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg">
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                          <span className="text-sm font-medium">Read Contacts</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg">
                          <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                          <span className="text-sm font-medium">Write Contacts</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg">
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                          <span className="text-sm font-medium">Read Deals</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg">
                          <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                          <span className="text-sm font-medium">Write Deals</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Assistant Settings (if assistant) */}
                {agentType === 'assistant' && (
                  <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" /> Assistant Settings
                    </h3>
                    <div className="space-y-4">
                      <p className="text-sm text-text-muted mb-4">
                        Configure how this AI Assistant interacts with the user and the workspace.
                      </p>
                      
                      <div className="space-y-4">
                        <label className="flex items-center gap-3">
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                          <span className="text-sm">App-wide visibility (Omnipresent)</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                          <span className="text-sm">Access to Cloud Computer environment</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" />
                          <span className="text-sm">Access to user's personalized Calendar</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tools & Knowledge */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Box className="w-4 h-4 text-green" /> Attached Tools
                      </h3>
                      <button className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {attachedTools.map((tool, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-bg border border-border rounded-lg group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-green/10 flex items-center justify-center text-green shrink-0">
                              <Box className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-medium">{tool}</span>
                          </div>
                          <button className="text-text-muted hover:text-red transition-colors opacity-0 group-hover:opacity-100">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Database className="w-4 h-4 text-amber" /> Knowledge Base
                      </h3>
                      <button className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add
                      </button>
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

        {/* Right Panel - Contextual (Library or Inspector) */}
        {isCanvasType && (
          <aside className="w-80 border-l border-border bg-surface flex flex-col shrink-0 z-10">
            {selectedNode ? (
              // Node Inspector
              <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-200">
                <div className="p-4 border-b border-border flex items-center justify-between bg-bg/50">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4 text-text-muted" /> Node Settings
                  </h2>
                  <button onClick={() => setSelectedNode(null)} className="text-text-muted hover:text-text-main p-1 rounded-md hover:bg-surface-hover">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Node Name</label>
                    <input 
                      type="text" 
                      value={selectedNode.data.label} 
                      onChange={(e) => {
                        setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n));
                        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, label: e.target.value } });
                      }}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>

                  {(() => {
                    const def = WORKFLOW_NODES.find(n => n.id === selectedNode.data.nodeDefId);
                    if (!def || !def.defaults) return null;
                    
                    return Object.keys(def.defaults).map(key => (
                      <div key={key}>
                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                        <input 
                          type="text" 
                          value={selectedNode.data[key] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: val } } : n));
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, [key]: val } });
                          }}
                          className="w-full px-3 py-2 bg-bg border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    ));
                  })()}

                  <div className="pt-4 border-t border-border mt-auto">
                    <button className="w-full py-2 bg-primary/10 text-primary border border-primary/20 rounded-md text-sm font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
                      <Play className="w-4 h-4" /> Test this step
                    </button>
                    <button 
                      onClick={() => {
                        setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
                        setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
                        setSelectedNode(null);
                      }}
                      className="w-full mt-3 py-2 bg-bg text-red border border-red/20 rounded-md text-sm font-medium hover:bg-red/5 transition-colors flex items-center justify-center gap-2"
                    >
                      Delete Node
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Node Library
              <div className="flex flex-col h-full animate-in fade-in duration-200">
                <div className="p-4 border-b border-border bg-bg/50">
                  <h2 className="font-semibold text-sm mb-3">Node Library</h2>
                  <input 
                    type="text" 
                    placeholder="Search nodes..." 
                    className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  <div className="space-y-6 pb-20">
                    {['Triggers', 'AI & Logic', 'Data & CRM', 'Communication', 'Integrations'].map((category) => (
                      <div key={category}>
                        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{category}</h3>
                        <div className="space-y-2">
                          {WORKFLOW_NODES.filter(n => n.category === category).map(node => (
                            <div 
                              key={node.id}
                              draggable 
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/reactflow', JSON.stringify(node));
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              className={`flex items-center gap-3 p-2 rounded-md border border-border bg-bg cursor-grab transition-colors ${node.borderClass}`}
                            >
                              <div className={`p-1.5 rounded ${node.bgClass} ${node.colorClass}`}>
                                {(() => {
                                  const Icon = node.icon;
                                  return <Icon className="w-4 h-4" />;
                                })()}
                              </div>
                              <span className="text-sm font-medium">{node.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
