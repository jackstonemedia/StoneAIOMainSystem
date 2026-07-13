import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  Send, Lock, Loader2, CheckCheck, User, Users, Tag,
  AlertCircle, ChevronDown, X, Check, MoreHorizontal,
  ArrowLeft, Smile, Paperclip, Mic, Image as ImageIcon,
  Bold, Italic, Link as LinkIcon, List, ListOrdered, Code, Maximize2,
  BellOff, Share, ChevronUp, Copy, Play, Plus, MessageSquare
} from 'lucide-react';
import { useInbox } from '../context/InboxContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../lib/api/inbox';
import type { InboxConversation, InboxMessage } from '../types/inbox';

const PRIORITY_OPTIONS = ['none', 'low', 'medium', 'high', 'urgent'] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: InboxMessage }) {
  const isAgent = msg.senderType === 'agent';
  const isSystem = msg.senderType === 'system';
  const isNote = msg.private;

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <span className="text-[12px] font-medium text-slate-400 bg-[#2C3036] px-4 py-1.5 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isAgent ? 'justify-end' : 'justify-start'} mb-6 group relative`}>
      {/* Contact Avatar if not agent */}
      {!isAgent && !isNote && (
        <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0 mr-3 mt-1 flex items-center justify-center">
          <User className="w-4 h-4 text-slate-400" />
        </div>
      )}

      {/* Agent Avatar if note */}
      {isNote && (
        <div className="w-8 h-8 rounded-full bg-yellow-900/30 overflow-hidden shrink-0 mr-3 mt-1 flex items-center justify-center border border-yellow-700/50">
          <Lock className="w-3.5 h-3.5 text-yellow-500" />
        </div>
      )}

      <div className={`max-w-[75%] ${isNote ? 'w-full' : ''}`}>
        <div
          className={`px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
            isNote
              ? 'bg-[#2E281F] border border-[#4D4026] text-slate-200 rounded-2xl rounded-tl-none'
              : isAgent
              ? 'bg-[#1D4ED8] text-white rounded-2xl rounded-tr-none'
              : 'bg-[#2C3036] text-white rounded-2xl rounded-tl-none'
          }`}
        >
          {msg.content}
        </div>
        
        <div className={`flex items-center gap-2 mt-1.5 ${isAgent ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[11px] text-slate-500 font-medium">
            {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
          </span>
          {isAgent && <CheckCheck className="w-3.5 h-3.5 text-[#3B82F6]" />}
        </div>
      </div>
    </div>
  );
}

function ReplyComposer({ conversationId }: { conversationId: string }) {
  const [tab, setTab] = useState<'reply' | 'note'>('reply');
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const send = useMutation({
    mutationFn: (data: { content: string; private: boolean }) =>
      inboxApi.sendMessage(conversationId, { content: data.content, private: data.private }),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
    },
  });

  const handleSend = () => {
    if (!text.trim() || send.isPending) return;
    send.mutate({ content: text.trim(), private: tab === 'note' });
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [text]);

  useEffect(() => {
    const handleDraft = (e: any) => {
      if (e.detail.conversationId === conversationId) {
        setText(e.detail.draft);
        setTab('reply');
      }
    };
    window.addEventListener('copilot:draft', handleDraft);
    return () => window.removeEventListener('copilot:draft', handleDraft);
  }, [conversationId]);

  return (
    <div className="shrink-0 p-4 bg-[#16191D]">
      <div className={`rounded-xl border transition-all ${
        tab === 'note'
          ? 'border-[#4D4026] bg-[#1F1C18]'
          : 'border-[#2C3036] bg-[#1B1D22]'
      }`}>
        {/* Tabs inside composer top */}
        <div className="flex px-2 pt-2 gap-1 relative">
          <button
            onClick={() => setTab('reply')}
            className={`px-4 py-1.5 text-[13px] font-semibold rounded-full transition-colors ${
              tab === 'reply' ? 'bg-[#374151] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Reply
          </button>
          <button
            onClick={() => setTab('note')}
            className={`px-4 py-1.5 text-[13px] font-semibold rounded-full transition-colors ${
              tab === 'note' ? 'bg-[#4D4026] text-yellow-500' : 'text-slate-400 hover:text-white'
            }`}
          >
            Private Note
          </button>
          
          <button className="absolute right-3 top-3 text-slate-400 hover:text-white">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[#2C3036]/50 opacity-60">
          <button className="p-1.5 hover:bg-[#2C3036] rounded text-slate-400"><Bold className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-[#2C3036] rounded text-slate-400"><Italic className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-slate-700 mx-1"></div>
          <button className="p-1.5 hover:bg-[#2C3036] rounded text-slate-400"><LinkIcon className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-[#2C3036] rounded text-slate-400"><List className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-[#2C3036] rounded text-slate-400"><ListOrdered className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-[#2C3036] rounded text-slate-400"><Code className="w-4 h-4" /></button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={tab === 'note' ? 'Shift + enter for new line. Start with \'@\' to mention an agent.' : 'Shift + enter for new line. Start with \'/\' to select a Canned Response.'}
          className="w-full bg-transparent p-4 text-[14px] outline-none resize-none min-h-[80px] text-white placeholder-slate-500"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        
        <div className="flex justify-between items-center px-3 py-3 border-t border-[#2C3036]/50">
          <div className="flex items-center gap-1">
            <button className="p-2 hover:bg-[#2C3036] rounded-full text-slate-400"><Smile className="w-5 h-5" /></button>
            <button className="p-2 hover:bg-[#2C3036] rounded-full text-slate-400"><Paperclip className="w-5 h-5" /></button>
            <button className="p-2 hover:bg-[#2C3036] rounded-full text-slate-400"><Mic className="w-5 h-5" /></button>
            <button className="p-2 hover:bg-[#2C3036] rounded-full text-slate-400"><ImageIcon className="w-5 h-5" /></button>
          </div>
          <button
            onClick={handleSend}
            disabled={send.isPending || !text.trim()}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              tab === 'note'
                ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white'
            } disabled:opacity-40`}
          >
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {tab === 'note' ? 'Add Note' : 'Send (↵)'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string, children?: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#2C3036]">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex items-center justify-between px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#2C3036]/30 transition-colors"
      >
        {title}
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <Plus className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function ConversationActionsPanel({ conv }: { conv: InboxConversation }) {
  const [tab, setTab] = useState<'contact' | 'copilot'>('contact');
  
  const generateDraft = useMutation({
    mutationFn: () => inboxApi.generateDraft(conv.id),
    onSuccess: (data) => {
      window.dispatchEvent(new CustomEvent('copilot:draft', { 
        detail: { conversationId: conv.id, draft: data.draft } 
      }));
    }
  });

  return (
    <div className="w-[300px] shrink-0 border-l border-[#2C3036] bg-[#16191D] flex flex-col h-full font-inter">
      {/* Tabs */}
      <div className="flex p-2 bg-[#1B1D22]">
        <button 
          onClick={() => setTab('contact')}
          className={`flex-1 py-1.5 text-[13px] font-semibold rounded-md transition-colors ${tab === 'contact' ? 'bg-[#374151] text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Contact
        </button>
        <button 
          onClick={() => setTab('copilot')}
          className={`flex-1 py-1.5 text-[13px] font-semibold rounded-md transition-colors flex items-center justify-center gap-2 ${tab === 'copilot' ? 'bg-[#374151] text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Copilot
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tab === 'contact' && (
          <>
            {/* Contact Profile */}
            <div className="p-5 border-b border-[#2C3036]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-700">
                  {conv.inboxContact?.avatarUrl ? (
                    <img src={conv.inboxContact.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">
                      {(conv.inboxContact?.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white flex items-center gap-1.5">
                    {conv.inboxContact?.name || 'Unknown Contact'}
                  </h3>
                  <p className="text-[12px] text-slate-400">Visitor</p>
                </div>
              </div>
              
              <div className="space-y-2 mt-4">
                {conv.inboxContact?.email && (
                  <div className="flex items-center gap-2 text-[12px] text-slate-300">
                    <span className="w-5 text-slate-500">✉</span> {conv.inboxContact.email}
                    <button className="ml-auto text-slate-500 hover:text-white"><Copy className="w-3 h-3" /></button>
                  </div>
                )}
                {conv.inboxContact?.phone && (
                  <div className="flex items-center gap-2 text-[12px] text-slate-300">
                    <span className="w-5 text-slate-500">📞</span> {conv.inboxContact.phone}
                    <button className="ml-auto text-slate-500 hover:text-white"><Copy className="w-3 h-3" /></button>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[12px] text-slate-300">
                  <span className="w-5 text-slate-500">🏢</span> Stone AIO Workspace
                </div>
              </div>
            </div>

            <Accordion title="Conversation Actions" defaultOpen>
              <div className="space-y-3">
                {/* Mock actions for UI */}
                <button className="w-full text-left text-[13px] text-slate-300 hover:text-white flex items-center justify-between">
                  Assign Agent
                  <span className="text-slate-500">{conv.assignedUserId ? 'Assigned' : 'Unassigned'}</span>
                </button>
                <button className="w-full text-left text-[13px] text-slate-300 hover:text-white flex items-center justify-between">
                  Assign Team
                  <span className="text-slate-500">None</span>
                </button>
                <button className="w-full text-left text-[13px] text-slate-300 hover:text-white flex items-center justify-between">
                  Priority
                  <span className="text-slate-500 capitalize">{conv.priority || 'None'}</span>
                </button>
              </div>
            </Accordion>
            <Accordion title="Conversation participants" />
            <Accordion title="Macros" />
            <Accordion title="Contact Attributes" />
            <Accordion title="Conversation Information" />
            <Accordion title="Previous Conversations" />
          </>
        )}
        
        {tab === 'copilot' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-[#1D4ED8]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#1D4ED8]/30">
              <span className="text-2xl">✨</span>
            </div>
            <h3 className="text-[15px] font-bold text-white mb-2">Captain AI Agent</h3>
            <p className="text-[13px] text-slate-400 mb-6">
              Let Captain summarize the conversation and draft the perfect reply automatically.
            </p>
            <button 
              onClick={() => generateDraft.mutate()}
              disabled={generateDraft.isPending}
              className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-[13px] py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generateDraft.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {generateDraft.isPending ? 'Generating...' : 'Generate Draft'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ConversationDetail() {
  const { selectedConversationId, setSelectedConversationId } = useInbox();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conv, isLoading: convLoading } = useQuery<InboxConversation>({
    queryKey: ['inbox', 'conversation', selectedConversationId],
    queryFn: () => inboxApi.getConversation(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  const { data: msgData, isLoading: msgsLoading } = useQuery({
    queryKey: ['inbox', 'messages', selectedConversationId],
    queryFn: () => inboxApi.listMessages(selectedConversationId!),
    enabled: !!selectedConversationId,
    refetchInterval: 10_000,
  });

  const messages: InboxMessage[] = msgData?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!selectedConversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#1B1D22] text-center p-8 border-l border-[#2C3036]">
        <div className="w-16 h-16 rounded-2xl bg-[#2C3036] flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Select a conversation</h3>
        <p className="text-sm text-slate-500">Choose a conversation from the left to view details</p>
      </div>
    );
  }

  if (convLoading || msgsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1B1D22] border-l border-[#2C3036]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  if (!conv) {
    return <div className="flex-1 flex items-center justify-center bg-[#1B1D22] text-slate-400">Conversation not found</div>;
  }

  return (
    <div className="flex-1 flex overflow-hidden border-l border-[#2C3036]">
      {/* Main conversation area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1B1D22]">
        {/* Header */}
        <div className="h-[72px] border-b border-[#2C3036] flex items-center px-6 gap-4 shrink-0 bg-[#16191D]">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              {conv.inboxContact?.avatarUrl ? (
                <img src={conv.inboxContact.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold">{(conv.inboxContact?.name || '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                {conv.inboxContact?.name || conv.inboxContact?.email || 'Unknown'}
              </h2>
              <p className="text-[12px] text-slate-400 flex items-center gap-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500"></span> Stone AIO Website</span>
                <button className="text-[#3B82F6] hover:underline">Close details</button>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button className="p-2 text-slate-400 hover:text-white hover:bg-[#2C3036] rounded-lg transition-colors">
              <BellOff className="w-4 h-4" />
            </button>
            <button className="p-2 text-slate-400 hover:text-white hover:bg-[#2C3036] rounded-lg transition-colors">
              <Share className="w-4 h-4" />
            </button>
            <div className="flex rounded-md overflow-hidden bg-[#2C3036]">
              <button className="px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#374151] transition-colors">
                Resolve
              </button>
              <button className="px-2 py-2 border-l border-[#1B1D22] text-slate-400 hover:text-white hover:bg-[#374151] transition-colors">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-slate-500">No messages yet.</p>
            </div>
          )}
          {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <ReplyComposer conversationId={conv.id} />
      </div>

      {/* Right actions panel */}
      <ConversationActionsPanel conv={conv} />
    </div>
  );
}
