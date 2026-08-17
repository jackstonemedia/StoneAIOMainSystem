import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, X, Send, Bot, User, Loader2, Mail, Users, BarChart2, Zap } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { motion, AnimatePresence } from 'motion/react';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    const message = userMsg;

    // Append empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const history = messages
        .filter(m => !m.content.startsWith('Error:'))
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }));

      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, route: location.pathname, history }),
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
              setMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1].content += text;
                return msgs;
              });
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch (error: any) {
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1].content = `Error: ${error.message}`;
        return msgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { icon: Mail,     text: "Write a re-engagement email for cold leads" },
    { icon: Users,    text: "How should I follow up with a warm prospect?" },
    { icon: BarChart2,text: "What metrics should I track for email campaigns?" },
    { icon: Zap,      text: "Suggest an automation workflow for new contacts" },
  ];

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-40 transition-shadow hover:shadow-[0_8px_30px_rgba(var(--primary),0.3)]"
            style={{ background: 'var(--primary)', color: 'white' }}
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 w-[380px] max-w-[calc(100vw-32px)] h-[650px] max-h-[calc(100vh-100px)] rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex flex-col z-50 overflow-hidden backdrop-blur-xl"
            style={{ background: 'color-mix(in srgb, var(--surface) 96%, transparent)', border: '1px solid var(--border)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b shrink-0 bg-transparent" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-primary/10 text-primary">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] leading-none mb-1.5" style={{ color: 'var(--text-main)' }}>Stone AI</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[11px] leading-none" style={{ color: 'var(--text-muted)' }}>Online & Ready</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth custom-scrollbar relative">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary shadow-sm">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-main)' }}>How can I help you today?</h4>
                  <p className="text-[13px] mb-8 max-w-[240px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    I can analyze your pipeline, draft emails, and manage your contacts.
                  </p>
                  <div className="w-full flex flex-col gap-2.5">
                    {quickPrompts.map((p, i) => {
                      const Icon = p.icon;
                      return (
                        <button 
                          key={i}
                          onClick={() => setInput(p.text)}
                          className="text-xs text-left px-4 py-3.5 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-sm flex items-center gap-3"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-main)', background: 'var(--bg)' }}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0 text-primary opacity-70" />
                          {p.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((m, i) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={i} 
                      className={`flex gap-3 max-w-[100%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${m.role === 'user' ? 'bg-primary text-white' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                        {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                      </div>
                      <div 
                        className={`px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed shadow-sm ${
                          m.role === 'user' 
                            ? 'bg-primary text-white rounded-tr-[4px]' 
                            : 'rounded-tl-[4px]'
                        }`}
                        style={m.role === 'assistant' ? { background: 'var(--bg)', color: 'var(--text-main)', border: '1px solid var(--border)' } : {}}
                      >
                        {m.content || (
                          <div className="flex items-center gap-1.5 h-5">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-[100%]">
                       <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 bg-primary/10 text-primary border border-primary/20 shadow-sm">
                         <Bot className="w-3.5 h-3.5" />
                       </div>
                       <div className="px-4 py-3 rounded-2xl rounded-tl-[4px] shadow-sm flex items-center gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Thinking...</span>
                       </div>
                     </motion.div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Input Area */}
            <div className="p-4 pt-2 bg-transparent shrink-0">
              <form onSubmit={handleSubmit} className="relative flex items-center rounded-2xl border shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all p-1.5" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask Stone AI..."
                  className="flex-1 h-10 px-3 text-[13.5px] outline-none bg-transparent"
                  style={{ color: 'var(--text-main)' }}
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:bg-transparent shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <div className="text-center mt-2.5">
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Stone AI can make mistakes. Verify important info.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
