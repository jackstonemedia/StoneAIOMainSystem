import React, { useRef, useEffect } from 'react';
import { Sparkles, User, Bot, ArrowLeft } from 'lucide-react';

export interface ChatMessage {
  role: string;
  content: string;
}

interface AIBuilderChatProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AIBuilderChat({ messages, input, onInputChange, onSubmit }: AIBuilderChatProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <aside className="w-80 border-r border-border/50 bg-surface/40 backdrop-blur-xl flex flex-col shrink-0 z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="p-4 border-b border-border/50 bg-bg/40 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">AI Builder</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
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
        <form onSubmit={onSubmit} className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Ask AI to build or modify..." 
            className="w-full pl-4 pr-10 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
          />
          <button 
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        </form>
      </div>
    </aside>
  );
}
