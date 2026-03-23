import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, Paperclip, Send, Settings, History, 
  Sparkles, FileText, Image as ImageIcon, Code, 
  ChevronRight, Bot, MoreHorizontal, Maximize2, X, Plus
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your Stone AIO Assistant. I can help you manage your CRM, build workflows, analyze data, or write code. What would you like to build today?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(() => window.innerWidth > 768);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm analyzing your request. Since I'm currently in a preview mode, I'm simply mirroring back your thoughts. Once connected to an LLM provider in Settings, I will generate dynamic intelligence.",
        timestamp: new Date().toISOString()
      }]);
    }, 1000);
  };

  return (
    <div className="flex-1 flex h-full bg-bg font-sans overflow-hidden relative">
      
      {/* Sidebar: Chat History */}
      <div className={`border-r border-border bg-surface transition-all duration-300 flex flex-col shrink-0 absolute md:relative z-30 h-full ${showHistory ? 'w-full sm:w-80 md:w-64' : 'w-0 overflow-hidden border-r-0'}`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-main font-semibold">
            <History className="w-4 h-4" />
            <span className="text-sm">History</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-surface-hover rounded-md text-text-muted hover:text-text-main transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowHistory(false)}
              className="md:hidden p-1 hover:bg-surface-hover rounded-md text-text-muted hover:text-text-main transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-2 mt-2">Today</div>
          <button className="w-full text-left px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium truncate">
            Drafting marketing emails
          </button>
          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-hover text-text-main text-sm truncate transition-colors">
            Analyze Q3 CRM Data
          </button>
          
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-2 mt-6">Previous 7 Days</div>
          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-hover text-text-main text-sm truncate transition-colors">
            Setup customer onboarding
          </button>
          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-hover text-text-main text-sm truncate transition-colors">
            Webhook integration help
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[var(--bg)]">
        
        {/* Top Navigation Bar */}
        <header className="h-14 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-4 shrink-0 absolute top-0 left-0 right-0 z-10 w-full">
          <div className="flex items-center gap-3">
            {!showHistory && (
              <button 
                onClick={() => setShowHistory(true)}
                className="p-1.5 hover:bg-surface-hover rounded-md text-text-muted transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-text-main">Stone Assistant</span>
              <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-[10px] font-medium text-text-muted uppercase tracking-wider">GPT-4o</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-surface-hover rounded-md text-text-muted transition-colors" title="Settings">
              <Settings className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-surface-hover rounded-md text-text-muted transition-colors" title="Expand">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowHistory(false)}
              className={`p-2 hover:bg-surface-hover rounded-md text-text-muted transition-colors ${!showHistory ? 'hidden' : ''}`} 
              title="Close Sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Chat Timeline */}
        <div className="flex-1 overflow-y-auto px-4 pt-20 pb-32 flex flex-col items-center">
          <div className="w-full max-w-3xl space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`rounded-2xl px-5 py-3.5 max-w-[85%] text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white ml-12 rounded-tr-sm' 
                    : 'bg-surface border border-border text-text-main text-left mr-12 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-text-main">JS</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Box Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-bg via-bg to-transparent pt-10">
          <div className="max-w-3xl mx-auto relative">
            
            {/* Context Tool Bar (Claude-style) */}
            <div className="absolute -top-12 left-0 flex items-center gap-2 px-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-xs font-medium text-text-main hover:bg-surface-hover hover:border-primary/50 transition-colors shadow-sm cursor-pointer group">
                <FileText className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors" />
                Add Document
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-xs font-medium text-text-main hover:bg-surface-hover hover:border-primary/50 transition-colors shadow-sm cursor-pointer group">
                <ImageIcon className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors" />
                Add Image
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-xs font-medium text-text-main hover:bg-surface-hover hover:border-primary/50 transition-colors shadow-sm cursor-pointer group">
                <Code className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors" />
                Attach Code
              </button>
            </div>

            <div className="bg-surface border border-border rounded-xl shadow-lg ring-1 ring-black/5 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all flex flex-col p-2">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Stone Assistant..."
                className="w-full bg-transparent border-none focus:ring-0 p-3 text-sm text-text-main resize-none min-h-[60px] max-h-[200px]"
                rows={1}
              />
              <div className="flex items-center justify-between px-2 pt-2 border-t border-border/50">
                <button className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-md transition-colors">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                    input.trim() ? 'bg-primary text-white shadow-sm' : 'bg-surface-hover text-text-muted cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-center mt-3 text-[10px] text-text-muted">
              AI Assistant can make mistakes. Please verify important information.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
