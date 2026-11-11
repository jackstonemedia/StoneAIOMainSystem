/**
 * Live Chat — the website-widget inbox, inside the Conversations page.
 *
 * Widget chats live in the inbox system (InboxConversation), which the old
 * Conversations UI never read — visitors could write in and nobody on the
 * team would ever see it. This view lists those chats and lets an agent read
 * and reply to them (replies go through POST /api/inbox/conversations/:id/
 * messages, which delivers to the visitor in real time). It is deliberately
 * simpler than the legacy message panes: list + thread + reply, no
 * templates, AI replies, or merge — the blocker was visibility, not features.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, MessageSquare } from 'lucide-react';
import { inboxApi, type LiveChatConversation, type LiveChatMessage } from '../../../lib/api/inbox';

function contactLabel(c: LiveChatConversation): string {
  return c.inboxContact?.name || c.inboxContact?.email || `Visitor #${c.displayId}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString();
}

export default function LiveChatInbox() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: listData, isLoading } = useQuery({
    queryKey: ['inbox', 'conversations'],
    queryFn: () => inboxApi.listConversations(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
  const conversations: LiveChatConversation[] = listData?.conversations ?? [];
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const { data: messagesData } = useQuery({
    queryKey: ['inbox', 'messages', selectedId],
    queryFn: () => inboxApi.listMessages(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 5_000,
  });
  const messages: LiveChatMessage[] = messagesData?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedId]);

  const send = useMutation({
    mutationFn: (content: string) => inboxApi.sendMessage(selectedId!, content),
    onSuccess: () => {
      setDraft('');
      setSendError(null);
      qc.invalidateQueries({ queryKey: ['inbox', 'messages', selectedId] });
      qc.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
    },
    onError: (err: any) =>
      setSendError(err?.response?.data?.error || err?.message || 'Failed to send reply'),
  });

  return (
    <div className="flex-1 overflow-hidden mx-8 mt-6 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex">
      {/* ── Chat list ── */}
      <div className="w-[320px] shrink-0 border-r border-border/50 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <div className="text-[13px] font-bold text-text-main">Live chat</div>
          <div className="text-[11px] text-text-muted">Chats from your website widget</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="px-4 py-6 text-[12px] text-text-muted">Loading chats…</p>}
          {!isLoading && conversations.length === 0 && (
            <p className="px-4 py-6 text-[12px] text-text-muted">
              No live chats yet — when a visitor writes in on your website, their chat appears here.
            </p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left px-4 py-3 border-b border-border/30 transition-colors ${
                c.id === selectedId ? 'bg-primary/10' : 'hover:bg-surface-hover/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-text-main truncate">{contactLabel(c)}</span>
                {c.unreadCount > 0 && (
                  <span className="shrink-0 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5 truncate">
                {c.inboxChannel?.name || 'Website'} · {c.status} · {timeAgo(c.lastActivityAt)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Thread ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-2">
            <MessageSquare className="w-8 h-8" />
            <p className="text-[13px]">Select a chat to view it.</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-text-main">{contactLabel(selected)}</div>
                <div className="text-[11px] text-text-muted">
                  {selected.inboxContact?.email || ''} · {selected.inboxChannel?.name || 'Website'} ·{' '}
                  {selected.status}
                </div>
              </div>
              <span className="text-[11px] text-text-muted">#{selected.displayId}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-[12px] text-text-muted text-center py-8">No messages in this chat yet.</p>
              )}
              {messages.map((m: LiveChatMessage) => (
                <div key={m.id} className={`flex ${m.senderType === 'agent' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] px-3.5 py-2.5 rounded-[12px] text-[13px] leading-relaxed ${
                      m.senderType === 'agent'
                        ? 'bg-surface-hover text-text-main rounded-br-[4px]'
                        : 'bg-surface border border-border text-text-main rounded-bl-[4px]'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    <div
                      className={`text-[10px] mt-1 text-text-muted`}
                    >
                      {timeAgo(m.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-border/50 px-4 py-3">
              {sendError && <p className="text-[12px] text-red mb-2">{sendError}</p>}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draft.trim() && !send.isPending) send.mutate(draft.trim());
                  }}
                  placeholder="Reply to the visitor…"
                  className="flex-1 px-3 py-2 bg-bg border border-border rounded-[8px] text-[13px] focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => draft.trim() && !send.isPending && send.mutate(draft.trim())}
                  disabled={!draft.trim() || send.isPending}
                  className="btn-primary px-4 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
