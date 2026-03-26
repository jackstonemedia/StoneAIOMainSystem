import type React from 'react';
import { useState } from 'react';
import { 
  MessageSquare, Folder, Zap, Settings, Plus, Maximize2, 
  FileText, Terminal, BarChart2, CheckCircle2, Bot, ArrowUp,
  Image as ImageIcon, Sparkles, Hash, GripVertical, X
} from 'lucide-react';

export default function ComputerDashboard() {
  const [activeWorkspace, setActiveWorkspace] = useState('chat');
  const [activeRightPanel, setActiveRightPanel] = useState<'none' | 'terminal' | 'file' | 'dashboard'>('none');
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', content: "Hello. I'm your Cloud Computer. I can write code, analyze data, and manipulate files in this workspace. What would you like to build today?" }
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessage = inputMessage;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: newMessage }]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI opening a terminal tool
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        role: 'ai', 
        content: `I'm setting up a new Python environment for you to handle that request. I'll open the terminal so you can see the progress.` 
      }]);
      setActiveRightPanel('terminal');
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="flex-1 flex bg-bg h-full overflow-hidden font-sans text-text-main">
      
      {/* Zo.computer style ultra-thin sidebar */}
      <nav className="w-16 border-r border-border bg-surface/30 flex flex-col items-center py-4 gap-4 shrink-0 z-20">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
          <Sparkles className="w-5 h-5" />
        </div>
        
        <div className="flex flex-col gap-2 w-full px-2">
          <button 
            onClick={() => setActiveWorkspace('chat')}
            className={`w-full aspect-square rounded-xl flex items-center justify-center transition-colors ${activeWorkspace === 'chat' ? 'bg-surface shadow border border-border text-primary' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}
            title="Chat & Workspace"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveWorkspace('files')}
            className={`w-full aspect-square rounded-xl flex items-center justify-center transition-colors ${activeWorkspace === 'files' ? 'bg-surface shadow border border-border text-primary' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}
            title="File System"
          >
            <Folder className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveWorkspace('dashboards')}
            className={`w-full aspect-square rounded-xl flex items-center justify-center transition-colors ${activeWorkspace === 'dashboards' ? 'bg-surface shadow border border-border text-primary' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}
            title="Dashboards"
          >
            <BarChart2 className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-auto flex flex-col gap-2 w-full px-2">
          <button className="w-full aspect-square rounded-xl flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 mx-auto rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/20 mt-2">
            JS
          </div>
        </div>
      </nav>

      {/* Main OS Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Chat / Commands Pane */}
        <div className={`${activeRightPanel === 'none' ? 'max-w-4xl mx-auto w-full' : 'w-[450px] shrink-0 border-r border-border'} flex flex-col h-full bg-bg transition-all duration-300`}>
          
          {/* Header */}
          <div className="h-14 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-2">
              <span className="font-medium">Cloud Computer v2</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-green bg-green/10 border border-green/20">Online</span>
            </div>
            <button className="p-1.5 text-text-muted hover:text-text-main rounded-md hover:bg-surface-hover transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white ml-12 rounded-tr-sm' 
                    : 'bg-surface border border-border mr-12 rounded-tl-sm text-text-main'
                }`}>
                  {msg.role === 'ai' && (
                    <div className="flex items-center gap-2 mb-2 text-primary font-medium text-xs">
                      <Bot className="w-4 h-4" /> Zo.Computer
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex flex-col items-start">
                <div className="bg-surface border border-border rounded-2xl rounded-tl-sm p-4 text-sm text-text-muted flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div className="h-4" />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-bg border-t border-border shrink-0">
            <form onSubmit={handleSendMessage} className="relative">
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                <textarea 
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask the computer to do anything..."
                  className="w-full bg-transparent border-none p-4 text-sm resize-none focus:outline-none placeholder:text-text-muted/60 max-h-32 min-h-14"
                  rows={Math.min(Math.max(inputMessage.split('\n').length, 1), 5)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <div className="flex items-center justify-between px-3 pb-3 pt-1">
                  <div className="flex items-center gap-1">
                    <button type="button" className="p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-surface-hover transition-colors">
                      <Hash className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-surface-hover transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    type="submit"
                    disabled={!inputMessage.trim() || isTyping}
                    className="p-1.5 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors shadow-sm"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-center mt-2 text-[10px] text-text-muted font-medium">
                AI controls your workspace. Press Shift+Enter for new line.
              </div>
            </form>
          </div>

        </div>

        {/* Dynamic Right Panel (The Canvas) */}
        {activeRightPanel !== 'none' && (
          <div className="flex-1 flex flex-col bg-surface/30 relative h-full animate-in slide-in-from-right-8 duration-500">
            
            {/* Panel Header */}
            <div className="h-12 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-3">
                {activeRightPanel === 'terminal' && <><Terminal className="w-4 h-4 text-text-muted" /><span className="text-sm font-medium">Instance Terminal</span></>}
                {activeRightPanel === 'file' && <><FileText className="w-4 h-4 text-text-muted" /><span className="text-sm font-medium">dataset_analysis.py</span></>}
                {activeRightPanel === 'dashboard' && <><BarChart2 className="w-4 h-4 text-text-muted" /><span className="text-sm font-medium">Analytics Dashboard</span></>}
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 text-text-muted hover:text-text-main rounded hover:bg-surface-hover transition-colors">
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setActiveRightPanel('none')}
                  className="p-1.5 text-text-muted hover:text-red-500 rounded hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Panel Content (Terminal specific for now as requested by user command earlier) */}
            <div className="flex-1 overflow-auto bg-[#0a0a0a] p-4 font-mono text-sm">
              {activeRightPanel === 'terminal' && (
                <div className="space-y-2 text-gray-300">
                  <div className="text-emerald-500 mb-4"># Terminal synchronized with AI Agent workspace...</div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">root@zo</span>:<span className="text-blue-400">~</span>$ 
                    <span className="text-gray-100">pip install numpy pandas</span>
                  </div>
                  <div className="text-gray-400">Collecting numpy</div>
                  <div className="text-gray-400">Downloading numpy-1.26.4-cp312-cp312-manylinux_2_17-x86_64.whl (18.2 MB)</div>
                  <div className="text-gray-400">Collecting pandas</div>
                  <div className="text-gray-400">Downloading pandas-2.2.1-cp312-cp312-manylinux_2_17-x86_64.whl (13.0 MB)</div>
                  <div className="text-white mt-1">Installing collected packages: numpy, pandas</div>
                  <div className="text-emerald-500 mb-4">Successfully installed numpy-1.26.4 pandas-2.2.1</div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">root@zo</span>:<span className="text-blue-400">~</span>$ 
                    <span className="w-2 h-4 bg-gray-400 animate-pulse inline-block" />
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
