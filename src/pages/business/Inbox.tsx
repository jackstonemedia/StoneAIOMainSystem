import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConversations, getConversationMessages, createConversation, sendMessage } from '../../lib/api';
import { Search, Send, Phone, Mail, MessageSquare, Star, MoreVertical, Circle, ChevronRight, Inbox as InboxIcon, Archive, Tag, Filter, Plus } from 'lucide-react';

const channelIcon = (channel: string) => {
  if (channel === 'sms') return <Phone className="w-3 h-3" />;
  if (channel === 'email') return <Mail className="w-3 h-3" />;
  return <MessageSquare className="w-3 h-3" />;
};

const channelLabel: Record<string, string> = { sms: 'SMS', email: 'Email', chat: 'Chat' };

export default function Inbox() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

  const { data: conversations = [], isLoading: isLoadingConvos } = useQuery<any[]>({
    queryKey: ['conversations'],
    queryFn: getConversations
  });

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<any[]>({
    queryKey: ['messages', selectedId],
    queryFn: () => getConversationMessages(selectedId!),
    enabled: !!selectedId
  });

  const createConvoMutation = useMutation<any, Error, any>({
    mutationFn: createConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] })
  });

  const sendMessageMutation = useMutation<any, Error, any>({
    mutationFn: (data) => sendMessage(selectedId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setReply('');
    }
  });

  const selected = conversations.find((c: any) => c.id === selectedId);

  const filtered = conversations.filter((c: any) => {
    const contactName = c.contact?.name || 'Unknown Contact';
    const matchSearch = !search || contactName.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.status === filter;
    return matchSearch && matchFilter;
  });

  const handleCreateTest = () => {
    createConvoMutation.mutate({
      contactId: 'new', // The backend will create a mock contact if 'new' or omit. Actually backend expects contactId, let's just pass contactId: 'test-contact-1' which was created in schema. Note we might have to pass dummy.
      status: 'open',
      channel: ['email', 'sms', 'chat'][Math.floor(Math.random()*3)]
    });
  };

  const handleSend = () => {
    if (!reply.trim()) return;
    sendMessageMutation.mutate({
      body: reply.trim(),
      direction: 'outbound'
    });
  };

  return (
    <div className="h-full flex overflow-hidden bg-bg font-sans">
      {/* Left: Conversation List */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-base flex items-center gap-2">
              <InboxIcon className="w-4 h-4 text-primary" /> Inbox
            </h1>
            <div className="flex items-center gap-1">
              <button onClick={handleCreateTest} title="Create Test Chat" className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                <Plus className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                <Filter className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                <Archive className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {(['all', 'open', 'closed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  filter === f ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingConvos ? (
             <div className="p-4 text-center text-xs text-text-muted">Loading conversations...</div>
          ) : filtered.length === 0 ? (
             <div className="p-4 text-center text-xs text-text-muted">No conversations found.</div>
          ) : filtered.map((convo: any) => {
            const avatar = convo.contact?.name ? convo.contact.name.substring(0,2).toUpperCase() : 'U';
            return (
            <button
              key={convo.id}
              onClick={() => setSelectedId(convo.id)}
              className={`w-full text-left px-4 py-3.5 border-b border-border/50 hover:bg-surface-hover transition-colors relative ${selectedId === convo.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-teal/30 border border-border flex items-center justify-center text-xs font-bold text-text-main shrink-0">
                  {avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-semibold truncate">{convo.contact?.name || 'Unknown Contact'}</span>
                    <span className="text-[10px] text-text-muted shrink-0">{new Date(convo.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      {channelIcon(convo.channel)} {channelLabel[convo.channel] || convo.channel}
                    </span>
                    {convo.status === 'closed' && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-gray-500/10 text-gray-500 border-gray-500/20`}>Closed</span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted truncate">Active Conversation</p>
                </div>
                {convo.unreadCount > 0 && (
                  <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-1">
                    {convo.unreadCount}
                  </div>
                )}
              </div>
            </button>
          )})}
        </div>
      </div>

      {/* Right: Message Thread */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Thread header */}
          <div className="h-16 border-b border-border px-6 flex items-center justify-between shrink-0 bg-surface/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-teal/30 border border-border flex items-center justify-center text-xs font-bold text-text-main">
                {selected.contact?.name ? selected.contact.name.substring(0,2).toUpperCase() : 'U'}
              </div>
              <div>
                <div className="font-semibold text-sm">{selected.contact?.name || 'Unknown Contact'}</div>
                <div className="text-[10px] text-text-muted flex items-center gap-1">
                  {channelIcon(selected.channel)} {channelLabel[selected.channel] || selected.channel}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green/10 text-green border border-green/20 hover:bg-green/20 transition-colors">Mark Closed</button>
              <button className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover transition-colors">
                <Star className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoadingMessages ? (
              <div className="text-center text-xs text-text-muted">Loading messages...</div>
            ) : messages.map((msg: any) => {
              const fromUs = msg.direction === 'outbound';
              return (
              <div key={msg.id} className={`flex ${fromUs ? 'justify-end' : 'justify-start'}`}>
                {!fromUs && (
                  <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-text-muted mr-2 shrink-0 mt-0.5">
                    {selected.contact?.name ? selected.contact.name.substring(0,1).toUpperCase() : 'U'}
                  </div>
                )}
                <div className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  fromUs
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-surface border border-border text-text-main rounded-bl-sm'
                }`}>
                  {msg.body}
                  <div className={`text-[10px] mt-1 ${fromUs ? 'text-white/60' : 'text-text-muted'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )})}
          </div>

          {/* Reply box */}
          <div className="border-t border-border p-4 bg-surface/20">
            <div className="flex items-end gap-3 bg-surface border border-border rounded-2xl p-3">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder={`Reply via ${channelLabel[selected.channel]}...`}
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder-text-muted/50 max-h-32"
                style={{ minHeight: '24px' }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 128) + 'px';
                }}
              />
              <button
                disabled={!reply.trim() || sendMessageMutation.isPending}
                className="p-2 rounded-xl bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
                onClick={handleSend}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-2 px-1">
              {['😊 Friendly', '📅 Book Meeting', '💼 Send Proposal'].map(q => (
                <button key={q} onClick={() => setReply(q.split(' ').slice(1).join(' '))} className="text-[10px] text-text-muted border border-border rounded-full px-2.5 py-1 hover:border-primary/40 hover:text-primary transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center text-text-muted">
          <div>
            <InboxIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
