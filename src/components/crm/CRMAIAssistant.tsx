import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Loader2, Maximize2, Minimize2, GripHorizontal, User, Paperclip } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

interface CRMAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CRMAIAssistant({ isOpen, onClose }: CRMAIAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'ai', content: 'Hi there! I am your CRM AI Assistant. Ask me to find contacts, summarize deals, or draft follow-up emails.' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isExpanded, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userText = message.trim();
    setMessage('');

    const userMsgId = Date.now().toString();
    const aiMsgId = (Date.now() + 1).toString();

    // Prepare clean history for Gemini
    const history = messages
      .filter(m => m.content && !m.content.startsWith('Error:'))
      .map(m => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.content }));

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: userText },
      { id: aiMsgId, role: 'ai', content: '' }
    ]);
    setIsLoading(true);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, route: location.pathname, history }),
      });

      if (!res.ok || !res.body) throw new Error('AI request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let doneReading = false;

      while (!doneReading) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            doneReading = true;
            break;
          }
          try {
            const { text, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (text) {
              setMessages(prev =>
                prev.map(m => (m.id === aiMsgId ? { ...m, content: m.content + text } : m))
              );
            }
          } catch { /* ignore malformed SSE chunks */ }
        }
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m => (m.id === aiMsgId ? { ...m, content: `Error: ${err.message || 'AI request failed'}` } : m))
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`fixed top-24 right-8 flex flex-col rounded-xl overflow-hidden transition-[width,height] duration-200 z-50 shadow-[0_8px_40px_rgba(0,0,0,0.12)] border ${
            isExpanded ? 'w-[600px] h-[800px] max-h-[90vh]' : 'w-[420px] h-[600px] max-h-[85vh]'
          }`}
          style={{ 
            background: 'var(--bg)',
            borderColor: 'var(--border)',
            touchAction: 'none'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0 cursor-move group/header" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-[13px]" style={{ color: 'var(--text-main)' }}>AI Assistant</h3>
              <GripHorizontal className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover/header:opacity-40 transition-opacity ml-1" />
            </div>
            <div className="flex items-center gap-0.5 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 custom-scrollbar relative" onPointerDown={(e) => e.stopPropagation()}>
            {messages.map((msg) => (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={msg.id} 
                className="flex gap-3 max-w-[100%]"
              >
                <div className="w-6 h-6 shrink-0 mt-0.5 flex items-center justify-center rounded-md" 
                     style={{ 
                       background: msg.role === 'user' ? 'transparent' : 'color-mix(in srgb, var(--primary) 15%, transparent)',
                       border: msg.role === 'user' ? '1px solid var(--border)' : '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                       color: msg.role === 'user' ? 'var(--text-muted)' : 'var(--primary)'
                     }}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 pt-0.5 text-[14.5px] leading-relaxed font-serif whitespace-pre-wrap" style={{ color: 'var(--text-main)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                  {msg.content || (
                    <div className="flex items-center gap-1.5 h-5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-[100%]">
                <div className="w-6 h-6 shrink-0 mt-0.5 flex items-center justify-center rounded-md" style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', color: 'var(--primary)' }}>
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 pt-0.5 text-[14.5px] leading-relaxed flex items-center gap-2" style={{ color: 'var(--text-muted)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span className="text-[13px]">Thinking & Analyzing CRM...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Input Form */}
          <div className="p-4 pt-1 shrink-0 bg-transparent" onPointerDown={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="flex flex-col rounded-xl border focus-within:shadow-sm focus-within:border-primary/50 transition-all p-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Message Stone AI..."
                className="w-full max-h-[120px] min-h-[44px] bg-transparent border-none resize-none px-2 py-1.5 text-[14px] focus:outline-none custom-scrollbar leading-relaxed"
                style={{ color: 'var(--text-main)' }}
                rows={1}
              />
              <div className="flex items-center justify-between mt-1 px-1">
                 <button type="button" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5" style={{ color: 'var(--text-muted)' }} title="Upload attachment">
                   <Paperclip className="w-4 h-4" />
                 </button>
                 <button
                   type="submit"
                   disabled={!message.trim() || isLoading}
                   className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:scale-100 active:scale-95 shrink-0"
                   style={{ 
                     background: message.trim() ? 'var(--text-main)' : 'transparent',
                     color: message.trim() ? 'var(--bg)' : 'var(--text-muted)'
                   }}
                 >
                   <Send className="w-4 h-4" />
                 </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
