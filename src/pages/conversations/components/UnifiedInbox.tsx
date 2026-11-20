/**
 * Unified inbox — ONE list + thread over BOTH conversation stores
 * (complete-platform item 2).
 *
 * Legacy email/SMS/Meta threads and website-widget live chats used to
 * live behind two tabs; a message in one never appeared in the other.
 * This view merges them into a single list ordered by last activity.
 * A thread's `source` decides where a reply / mark-read goes — the
 * reply always takes the owning store's real path, so delivery never
 * changes. Cross-system identity (merging a Gmail thread and a widget
 * chat from the same person into one thread) is item 1.23, a
 * follow-up; until then the same person can appear as two threads.
 *
 * Out of scope for this view (stated, not hidden): the legacy thread
 * pane's template picker, AI reply, and bulk actions are not wired
 * here yet — the components stay in the repo for a follow-up.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, MessageSquare, Mail, MessageCircle, Globe } from 'lucide-react';
import { unifiedInboxApi, type UnifiedThread, type UnifiedSource } from '../../../lib/api/unified-inbox';
import { useConversationsCtx } from '../context/ConversationsContext';

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

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'live_chat') return <Globe className="w-3.5 h-3.5" />;
  if (channel === 'email' || channel === 'gmail' || channel === 'outlook') return <Mail className="w-3.5 h-3.5" />;
  return <MessageCircle className="w-3.5 h-3.5" />;
}

export default function UnifiedInbox({ initialId }: { initialId?: string | null }) {
  const qc = useQueryClient();
  const { view, search } = useConversationsCtx();
  const [selected, setSelected] = useState<{ source: UnifiedSource; id: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  // The layout's view selector + search drive the unified list, so the
  // top bar keeps working exactly as it did for the legacy list.
  const listParams: Record<string, any> = { page, pageSize: 25 };
  if (search?.trim()) listParams.q = search.trim();
  if (view === 'unread') listParams.unreadOnly = true;
  else if (view === 'unassigned') listParams.assignedUserId = 'unassigned';
  else if (view === 'mine') listParams.assignedUserId = 'me';
  else if (view === 'snoozed') listParams.status = 'snoozed';
  else if (view === 'archived') listParams.status = 'archived';

  const { data: listData, isLoading } = useQuery({
    queryKey: ['unified-inbox', 'list', listParams],
    queryFn: () => unifiedInboxApi.list(listParams),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
  const threads: UnifiedThread[] = listData?.threads ?? [];
  const unreadTotal = listData?.unreadTotal ?? 0;

  // Deep link (/conversations/:id): the id alone does not say which
  // store it is in. If it is in the loaded list, select it from there
  // (source known); otherwise try the legacy store, then the live one.
  useEffect(() => {
    if (!initialId || selected) return;
    const inList = threads.find((t) => t.id === initialId);
    if (inList) {
      setSelected({ source: inList.source, id: inList.id });
      return;
    }
    if (!isLoading) {
      (async () => {
        for (const source of ['legacy', 'live'] as const) {
          try {
            await unifiedInboxApi.getThread(source, initialId);
            setSelected({ source, id: initialId });
            return;
          } catch {
            // Not in this store — try the other one.
          }
        }
      })();
    }
  }, [initialId, threads, isLoading, selected]);

  const selectedThread = selected ? threads.find((t) => t.id === selected.id) ?? null : null;

  const { data: threadData } = useQuery({
    queryKey: ['unified-inbox', 'thread', selected?.source, selected?.id],
    queryFn: () => unifiedInboxApi.getThread(selected!.source, selected!.id),
    enabled: !!selected,
    refetchInterval: 5_000,
  });
  const messages = threadData?.messages ?? [];
  const thread = threadData?.thread ?? selectedThread;

  // Opening a thread marks it read in the OWNING store, so the unread
  // badge clears — the same call the two old tabs each made on open.
  useEffect(() => {
    if (!selected) return;
    unifiedInboxApi.markRead(selected.source, selected.id).then(() => {
      qc.invalidateQueries({ queryKey: ['unified-inbox', 'list'] });
    }).catch(() => {});
  }, [selected, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: () => unifiedInboxApi.sendMessage(selected!.source, selected!.id, draft),
    onSuccess: () => {
      setDraft('');
      setSendError(null);
      qc.invalidateQueries({ queryKey: ['unified-inbox', 'thread', selected?.source, selected?.id] });
      qc.invalidateQueries({ queryKey: ['unified-inbox', 'list'] });
    },
    onError: (e: any) => {
      // The dispatch error comes back as a 400 with a plain-words
      // message (no connection, no recipient, over the daily limit) —
      // show it, do not swallow it.
      setSendError(e?.response?.data?.error || e?.message || 'Send failed');
    },
  });

  return (
    <div className="flex-1 overflow-hidden mx-8 mt-6 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex min-h-0">
      {/* ── List ── */}
      <div className="w-[340px] shrink-0 border-r border-border/50 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between shrink-0">
          <span className="text-[13px] font-bold text-text-main">Inbox</span>
          {unreadTotal > 0 && (
            <span className="text-[11px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
              {unreadTotal} unread
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading && threads.length === 0 && (
            <p className="px-4 py-6 text-[13px] text-text-muted">Loading conversations…</p>
          )}
          {!isLoading && threads.length === 0 && (
            <div className="px-4 py-10 text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-text-muted mb-2" />
              <p className="text-[13px] text-text-muted">No conversations yet.</p>
              <p className="text-[12px] text-text-muted mt-1">Messages from email, SMS, and live chat will appear here.</p>
            </div>
          )}
          {threads.map((t) => (
            <button
              key={`${t.source}:${t.id}`}
              onClick={() => setSelected({ source: t.source, id: t.id })}
              className={`w-full text-left px-4 py-3 border-b border-border/30 transition-colors ${
                selected?.id === t.id ? 'bg-primary/10' : 'hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-text-muted shrink-0"><ChannelIcon channel={t.channel} /></span>
                <span className="text-[13px] font-semibold text-text-main truncate flex-1">{t.contactLabel}</span>
                <span className="text-[11px] text-text-muted shrink-0">{timeAgo(t.lastActivityAt)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-semibold text-text-muted shrink-0">{t.channelLabel}</span>
                <span className="text-[12px] text-text-muted truncate flex-1">{t.preview ?? t.subject ?? ''}</span>
                {t.unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full shrink-0">
                    {t.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-border/50 flex items-center justify-between shrink-0">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-2.5 py-1 rounded-[6px] border border-border text-text-muted hover:text-text-main disabled:opacity-30 text-[12px]"
          >
            Prev
          </button>
          <span className="text-[12px] text-text-muted">Page {page}{listData ? ` · ${listData.total} total` : ''}</span>
          <button
            disabled={threads.length < 25}
            onClick={() => setPage((p) => p + 1)}
            className="px-2.5 py-1 rounded-[6px] border border-border text-text-muted hover:text-text-main disabled:opacity-30 text-[12px]"
          >
            Next
          </button>
        </div>
      </div>

      {/* ── Thread ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {!selected || !thread ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-text-muted">Select a conversation to read and reply.</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-border/50 flex items-center gap-3 shrink-0">
              <span className="text-text-muted"><ChannelIcon channel={thread.channel} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-text-main truncate">{thread.contactLabel}</p>
                <p className="text-[12px] text-text-muted truncate">
                  {thread.channelLabel}
                  {thread.subject ? ` · ${thread.subject}` : ''}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-text-muted shrink-0">{thread.status}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                      m.direction === 'outbound'
                        ? 'bg-primary text-white rounded-br-md'
                        : 'bg-surface text-text-main rounded-bl-md border border-border/50'
                    } ${m.private ? 'opacity-60 border-dashed' : ''}`}
                  >
                    {m.private && <span className="block text-[10px] font-bold uppercase tracking-wide opacity-70 mb-1">Private note</span>}
                    {m.body}
                    <span className={`block text-[10px] mt-1 ${m.direction === 'outbound' ? 'text-white/70' : 'text-text-muted'}`}>
                      {timeAgo(m.createdAt)}{m.status === 'failed' ? ' · failed to send' : ''}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {sendError && (
              <p className="px-5 py-2 text-[12px] text-red-400 shrink-0">{sendError}</p>
            )}
            <div className="px-5 py-3 border-t border-border/50 flex items-center gap-2 shrink-0">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (draft.trim() && !sendMutation.isPending) sendMutation.mutate();
                  }
                }}
                placeholder={`Reply via ${thread.channelLabel}…`}
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-[13px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => sendMutation.mutate()}
                disabled={!draft.trim() || sendMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
