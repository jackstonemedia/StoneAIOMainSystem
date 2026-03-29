import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

export default function CRMAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'ai', content: 'Hi there! I am your CRM AI Assistant. Ask me to find contacts, summarize deals, or draft follow-up emails.' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isExpanded]);

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      // Stubbing the logic for now, in a real implementation this hooks to the /api/workflow-ai/chat or similar
      await new Promise(r => setTimeout(r, 1500));
      return `I understand you're asking about "${text}". I have analyzed the CRM data and found relevant records. How else can I assist?`;
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: data }]);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || mutation.isPending) return;

    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: message.trim() }]);
    mutation.mutate(message.trim());
    setMessage('');
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-all z-50 animate-in fade-in zoom-in group"
      >
        <Sparkles className="w-5 h-5 absolute z-10 opacity-0 group-hover:opacity-100 group-hover:animate-ping transition-all delay-100" />
        <Bot className="w-6 h-6 z-20" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 flex flex-col bg-surface/90 backdrop-blur-xl border border-border/60 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 z-50 ${
      isExpanded ? 'w-[600px] h-[800px] max-h-[90vh]' : 'w-[380px] h-[600px] max-h-[80vh]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-bg/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Stone CRM AI</h3>
            <p className="text-[10px] text-text-muted flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green inline-block"></span> Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-surface-hover hover:text-text-main rounded-md transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-surface-hover hover:text-text-main rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar flex flex-col bg-gradient-to-b from-transparent to-bg/5">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-2xl p-3.5 text-[13px] leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-primary text-primary-foreground rounded-br-sm' 
                : 'bg-bg border border-border/50 rounded-bl-sm text-text-main group'
            }`}>
              {msg.role === 'ai' && (
                <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-medium text-text-muted opacity-60 group-hover:opacity-100 transition-opacity">
                  <Sparkles className="w-3 h-3" /> AI Assistant
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-bg border border-border/50 rounded-bl-sm p-4 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-text-muted font-medium">Analyzing CRM data...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border/50 bg-surface shrink-0">
        <div className="relative flex items-end gap-2 bg-bg border border-border/60 rounded-xl p-1 focus-within:border-primary/50 focus-within:ring-1 transition-all">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask about deals, contacts, or try drafting an email..."
            className="w-full max-h-32 min-h-[44px] bg-transparent border-none resize-none px-3 py-3 text-sm focus:outline-none custom-scrollbar"
            rows={1}
          />
          <button
            type="submit"
            disabled={!message.trim() || mutation.isPending}
            className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:scale-100 active:scale-95 shrink-0 m-1"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto custom-scrollbar pb-1">
          {['Any hot leads?', 'Draft follow up for Q3 License', 'Summarize my tasks'].map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setMessage(suggestion)}
              className="whitespace-nowrap px-3 py-1.5 bg-bg border border-border/50 rounded-full text-[11px] font-medium text-text-muted hover:text-text-main hover:border-primary/30 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
