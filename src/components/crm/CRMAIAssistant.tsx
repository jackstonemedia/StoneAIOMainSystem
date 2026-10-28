import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Sparkles, Loader2, Maximize2, Minimize2, GripHorizontal, User, Paperclip, Check, RefreshCw, Plus, History } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

interface PendingAction {
  id: string;
  toolName: string;
  label?: string;
  status: string;
  result?: unknown;
}

interface PastConversation {
  id: string;
  updatedAt: string;
  messages: { content: string }[];
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

  // Phase 0: approvals live in chat. Pending AIAction rows, refreshed whenever
  // the panel opens and after every completed chat response.
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [approvalsError, setApprovalsError] = useState('');

  // Phase 2: agent service — persisted conversations, display name, mode.
  const [agentName, setAgentName] = useState('AI Agent');
  const [agentMode, setAgentMode] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pastConversations, setPastConversations] = useState<PastConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/agent/settings');
      if (!res.ok) return;
      const body = await res.json();
      if (body.name) {
        setAgentName(body.name);
        setMessages(prev =>
          prev.length === 1 && prev[0].role === 'ai'
            ? [{ ...prev[0], content: `Hi there! I am ${body.name}. Ask me to find contacts, summarize deals, or draft follow-up emails.` }]
            : prev,
        );
      }
      if (body.mode) setAgentMode(body.mode);
    } catch { /* settings stay defaulted */ }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiFetch('/api/agent/conversations');
      if (!res.ok) return;
      const body = await res.json();
      setPastConversations(body.conversations ?? []);
    } catch { /* history stays hidden */ }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchConversations();
    }
  }, [isOpen, fetchSettings, fetchConversations]);

  const startNewChat = () => {
    setConversationId(null);
    setShowHistory(false);
    setMessages([{ id: '1', role: 'ai', content: `Hi there! I am ${agentName}. Ask me to find contacts, summarize deals, or draft follow-up emails.` }]);
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await apiFetch(`/api/agent/conversations/${id}`);
      if (!res.ok) throw new Error('Could not load conversation');
      const body = await res.json();
      const loaded: Message[] = (body.messages ?? []).map((m: { role: string; content: string }, i: number) => ({
        id: `${Date.now()}-${i}`,
        role: m.role === 'model' ? 'ai' : 'user',
        content: m.content,
      }));
      setMessages(loaded.length > 0 ? loaded : [{ id: '1', role: 'ai', content: `Hi there! I am ${agentName}.` }]);
      setConversationId(id);
      setShowHistory(false);
    } catch { /* keep current messages */ }
  };

  const fetchPending = useCallback(async () => {
    try {
      const res = await apiFetch('/api/ai/actions?status=pending');
      if (!res.ok) throw new Error('Could not load pending approvals');
      const body = await res.json();
      setPendingActions(body.actions ?? []);
      setApprovalsError('');
    } catch (err: any) {
      setApprovalsError(err.message || 'Could not load pending approvals');
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchPending();
  }, [isOpen, fetchPending]);

  const actOnAction = async (id: string, action: 'approve' | 'reject') => {
    const target = pendingActions.find(a => a.id === id);
    setActingId(id);
    try {
      const res = await apiFetch(`/api/ai/actions/${id}/${action}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `${action} failed`);
      const label = target?.label || target?.toolName || 'action';
      const outcome = action === 'approve'
        ? (body?.result?.message || body?.result?.error || 'Done')
        : 'Rejected — nothing was changed.';
      setMessages(prev => [...prev, { id: `${Date.now()}`, role: 'ai', content: `${action === 'approve' ? 'Approved' : 'Rejected'}: ${label} — ${typeof outcome === 'string' ? outcome : JSON.stringify(outcome)}` }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: `${Date.now()}`, role: 'ai', content: `Error: ${err.message || `${action} failed`}` }]);
    } finally {
      setActingId(null);
      fetchPending();
    }
  };
  
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

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: userText },
      { id: aiMsgId, role: 'ai', content: '' }
    ]);
    setIsLoading(true);

    try {
      // Phase 2: the agent service owns history via persisted
      // conversations. Create one on first send; fall back to local
      // history only if creation fails (stateless path).
      let convId = conversationId;
      if (!convId) {
        try {
          const created = await apiFetch('/api/agent/conversations', { method: 'POST' });
          if (created.ok) {
            const body = await created.json();
            convId = body.conversation?.id ?? null;
            if (convId) setConversationId(convId);
          }
        } catch { convId = null; }
      }
      const fallbackHistory = convId
        ? undefined
        : messages
          .filter(m => m.content && !m.content.startsWith('Error:'))
          .map(m => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.content }));

      const res = await apiFetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, route: location.pathname, conversationId: convId ?? undefined, history: fallbackHistory }),
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
          let parsed: any;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue; // ignore malformed SSE chunks
          }
          // Errors must surface (previously the throw was swallowed by
          // the JSON catch, leaving the panel stuck on dots).
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.conversation_id) setConversationId(parsed.conversation_id);
          // action_proposal events refresh via fetchPending below.
          if (parsed.text) {
            setMessages(prev =>
              prev.map(m => (m.id === aiMsgId ? { ...m, content: m.content + parsed.text } : m))
            );
          }
        }
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m => (m.id === aiMsgId ? { ...m, content: `Error: ${err.message || 'AI request failed'}` } : m))
      );
    } finally {
      setIsLoading(false);
      fetchPending();
      fetchSettings();
      fetchConversations();
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
              <h3 className="font-medium text-[13px]" style={{ color: 'var(--text-main)' }}>{agentName}</h3>
              {agentMode && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-md border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  {agentMode}
                </span>
              )}
              <GripHorizontal className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover/header:opacity-40 transition-opacity ml-1" />
            </div>
            <div className="flex items-center gap-0.5 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                title="Past chats"
              >
                <History className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={startNewChat}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                title="New chat"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
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

          {/* Past chats (Phase 2: history viewable) */}
          {showHistory && (
            <div className="px-4 pt-3 pb-1 shrink-0 max-h-[180px] overflow-y-auto custom-scrollbar" onPointerDown={(e) => e.stopPropagation()}>
              {pastConversations.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No past chats yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {pastConversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => loadConversation(c.id)}
                      className="w-full text-left rounded-lg border px-2.5 py-2 hover:bg-black/5"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="block text-[13px] truncate" style={{ color: 'var(--text-main)' }}>
                        {c.messages?.[0]?.content || 'Chat'}
                      </span>
                      <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {new Date(c.updatedAt).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {/* Pending approvals (Phase 0: approvals live in chat) */}
          {(pendingActions.length > 0 || approvalsError) && (
            <div className="px-4 pb-2 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold" style={{ color: 'var(--text-main)' }}>
                  Pending approvals{pendingActions.length > 0 ? ` (${pendingActions.length})` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => fetchPending()}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5"
                  style={{ color: 'var(--text-muted)' }}
                  title="Refresh approvals"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {approvalsError && (
                <p className="text-[12px] mb-2" style={{ color: 'var(--text-muted)' }}>{approvalsError}</p>
              )}
              <div className="space-y-2">
                {pendingActions.map((a) => (
                  <div key={a.id} className="rounded-lg border p-2.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <p className="text-[13px] leading-snug" style={{ color: 'var(--text-main)' }}>{a.label || a.toolName}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        disabled={actingId === a.id}
                        onClick={() => actOnAction(a.id, 'approve')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium disabled:opacity-40"
                        style={{ background: 'var(--text-main)', color: 'var(--bg)' }}
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingId === a.id}
                        onClick={() => actOnAction(a.id, 'reject')}
                        className="px-2.5 py-1 rounded-md text-[12px] border disabled:opacity-40"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-main)' }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
