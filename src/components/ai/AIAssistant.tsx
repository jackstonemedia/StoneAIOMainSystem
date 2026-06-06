import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, X, Send, Bot, User } from 'lucide-react';
import { streamText, SYSTEM_PROMPTS } from '../../lib/gemini';

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
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    const context = `Current Route: ${location.pathname}\nUser Message: ${userMsg}`;
    
    // Create an empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      await streamText(
        context,
        (chunk) => {
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].content += chunk;
            return newMsgs;
          });
        },
        SYSTEM_PROMPTS.assistant
      );
    } catch (error: any) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1].content = `Error: ${error.message}`;
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "Summarize my pipeline",
    "Contacts not reached in 30 days",
    "Draft a follow-up email"
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform z-40 ${isOpen ? 'scale-0' : 'scale-100 hover:scale-105'}`}
        style={{ background: 'var(--primary)', color: 'white' }}
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {isOpen && (
        <div 
          className="fixed bottom-6 right-6 w-full max-w-sm h-[600px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--primary)' }}>
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">Stone AI</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4" style={{ color: 'var(--primary)' }}>
                  <Bot className="w-6 h-6" />
                </div>
                <h4 className="font-medium mb-2" style={{ color: 'var(--text-main)' }}>How can I help you today?</h4>
                <div className="flex flex-col gap-2 mt-4">
                  {quickPrompts.map((p, i) => (
                    <button 
                      key={i}
                      onClick={() => setInput(p)}
                      className="text-xs text-left px-3 py-2 rounded-lg border transition-colors hover:bg-black/5"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div 
                    className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${
                      m.role === 'user' 
                        ? 'bg-primary text-white rounded-tr-sm' 
                        : 'rounded-tl-sm'
                    }`}
                    style={m.role === 'assistant' ? { background: 'var(--bg)', color: 'var(--text-main)', border: '1px solid var(--border)' } : {}}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 h-10 px-3 rounded-lg text-sm outline-none border transition-colors focus:border-primary"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-50"
                style={{ background: 'var(--primary)', color: 'white' }}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
