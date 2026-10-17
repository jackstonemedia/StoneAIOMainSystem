import { useState, useRef, useEffect } from 'react';
import {
  Search, Plus, Filter, ArrowDownUp, Mail, MessageSquare,
  Clock, Archive, Trash2, Check,
  Circle, X, Loader2,
} from 'lucide-react';
import { formatDistanceToNow, addHours, addDays, nextMonday } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../../lib/api/conversations';
import { queryKeys } from '../../../lib/queryKeys';
import { useConversationsCtx } from '../context/ConversationsContext';
import type { Conversation, ConversationStatus } from '../../../types/conversation';
import NewConversationModal from './NewConversationModal';

// ── Channel Icon ──────────────────────────────────────────────────────────────
function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'email') return <Mail className="w-3.5 h-3.5" />;
  return <MessageSquare className="w-3.5 h-3.5" />;
}

// ── Snooze Duration Picker ────────────────────────────────────────────────────
function SnoozePicker({ onPick }: { onPick: (until: string) => void }) {
  const [custom, setCustom] = useState('');
  const options = [
    { label: '1 hour', value: () => addHours(new Date(), 1).toISOString() },
    { label: 'Tomorrow 9 AM', value: () => { const d = addDays(new Date(), 1); d.setHours(9, 0, 0, 0); return d.toISOString(); } },
    { label: 'Next week', value: () => nextMonday(new Date()).toISOString() },
  ];
  return (
    <div className="absolute z-50 right-0 top-full mt-1 w-48 bg-surface border border-border shadow-luxury ring-1 ring-white/5 rounded-xl overflow-hidden text-[13px]">
      {options.map(o => (
        <button key={o.label} onClick={() => onPick(o.value())} className="w-full text-left px-4 py-2 text-text-main hover:bg-surface-hover transition-colors">
          {o.label}
        </button>
      ))}
      <div className="px-3 py-2 border-t border-border">
        <input
          type="datetime-local"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          className="w-full bg-surface-hover text-text-main text-[12px] px-2 py-1 rounded border border-border focus:outline-none"
        />
        {custom && (
          <button onClick={() => onPick(new Date(custom).toISOString())} className="mt-1.5 w-full py-1 bg-primary text-white text-[12px] font-semibold rounded">
            Set snooze
          </button>
        )}
      </div>
    </div>
  );
}

// ── Filter Popover ────────────────────────────────────────────────────────────
export function FilterPopover({ onClose, placement = 'bottom' }: { onClose: () => void; placement?: 'bottom' | 'top' }) {
  const {
    statusFilter, setStatusFilter,
    assigneeFilter, setAssigneeFilter,
    tagFilter, setTagFilter,
    isReadFilter, setIsReadFilter,
    dateRangeFilter, setDateRangeFilter,
    resetFilters,
  } = useConversationsCtx();

  const { data: tags = [] } = useQuery({ queryKey: ['conversations', 'tags'], queryFn: conversationsApi.listTags });

  const statuses: (ConversationStatus | 'all')[] = ['all', 'open', 'closed', 'snoozed', 'archived'];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`w-[290px] bg-surface border border-border shadow-luxury ring-1 ring-white/10 rounded-xl p-4 text-[13px] overflow-y-auto max-h-[calc(100vh-180px)] z-50 ${
        placement === 'top' ? 'absolute left-0 bottom-full mb-2' : 'absolute right-0 top-full mt-2'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-text-main">Filters</span>
          <button onClick={resetFilters} className="text-[12px] text-text-muted hover:text-text-main">Reset</button>
        </div>

        {/* Status */}
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Status</p>
          <div className="flex flex-wrap gap-1">
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  statusFilter === s
                    ? 'bg-primary border-primary text-white'
                    : 'border-border text-text-muted hover:border-text-muted hover:text-text-main'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Read/Unread */}
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Read state</p>
          <div className="flex gap-1">
            {[
              { label: 'All', value: undefined },
              { label: 'Unread', value: false },
              { label: 'Read', value: true },
            ].map(opt => (
              <button
                key={opt.label}
                onClick={() => setIsReadFilter(opt.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  isReadFilter === opt.value
                    ? 'bg-primary border-primary text-white'
                    : 'border-border text-text-muted hover:border-text-muted hover:text-text-main'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tag */}
        {tags.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Tag</p>
            <select
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              className="w-full bg-surface-hover border border-border text-text-main rounded-lg px-2 py-1.5 text-[12px] focus:outline-none"
            >
              <option value="">Any tag</option>
              {tags.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date range */}
        <div className="mb-1">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Date range</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRangeFilter?.from ?? ''}
              onChange={e => setDateRangeFilter({ ...dateRangeFilter, from: e.target.value || undefined })}
              className="flex-1 bg-surface-hover border border-border text-text-main rounded-lg px-2 py-1 text-[11px] focus:outline-none"
            />
            <input
              type="date"
              value={dateRangeFilter?.to ?? ''}
              onChange={e => setDateRangeFilter({ ...dateRangeFilter, to: e.target.value || undefined })}
              className="flex-1 bg-surface-hover border border-border text-text-main rounded-lg px-2 py-1 text-[11px] focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg text-[13px] transition-colors"
        >
          Apply
        </button>
      </div>
    </>
  );
}

// ── Row skeleton ──────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="px-3.5 py-3 space-y-2 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3.5 bg-surface-hover rounded w-1/3" />
        <div className="h-3 bg-surface-hover rounded w-12" />
      </div>
      <div className="h-3 bg-surface-hover rounded w-3/4" />
      <div className="h-2.5 bg-surface-hover rounded w-1/4" />
    </div>
  );
}

// ── Sort Options ──────────────────────────────────────────────────────────────
export const SORT_OPTIONS: { value: 'newest' | 'oldest' | 'unread_first'; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'unread_first', label: 'Unread first' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function ConversationListPane() {
  const qc = useQueryClient();

  const {
    sort, setSort,
    activeFilterCount,
    selectedId, setSelectedId,
    selectedIds, toggleSelected, clearSelection,
    queryFilters,
  } = useConversationsCtx();

  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [snoozeForId, setSnoozeForId] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.conversations.list(), queryFilters],
    queryFn: () => conversationsApi.list(queryFilters),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => conversationsApi.patch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.conversations.list() }),
  });

  const del = useMutation({
    mutationFn: (id: string) => conversationsApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      if (selectedId === id) setSelectedId(null);
    },
  });

  const bulk = useMutation({
    mutationFn: (data: Parameters<typeof conversationsApi.bulk>[0]) => conversationsApi.bulk(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      clearSelection();
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => conversationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.conversations.list() }),
  });

  const markUnread = useMutation({
    mutationFn: (id: string) => conversationsApi.markUnread(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.conversations.list() }),
  });

  const handleSnooze = (id: string, until: string) => {
    patch.mutate({ id, data: { snoozedUntil: until, status: 'snoozed' } });
    setSnoozeForId(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    del.mutate(id);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasBulk = selectedIds.length > 0;
  const unreadCount = conversations.filter(c => c.unreadCount > 0).length;

  return (
    <>
      <div className="w-[360px] shrink-0 border-r border-border/60 bg-surface/85 flex flex-col h-full font-inter overflow-hidden backdrop-blur-md z-10">
        {/* ── Header ──────────────────────────────── */}
        <div className="shrink-0 border-b border-border/50 bg-surface/90 backdrop-blur-sm">
          {/* Title row */}
          <div className="h-[52px] flex items-center justify-between px-4">
            {/* New Conversation Plus Button on the left */}
            <button
              onClick={() => setShowNewConv(true)}
              className="p-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white shadow-xs transition-colors flex items-center justify-center"
              title="New Conversation"
            >
              <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
            </button>

            {/* Actions: Sort, Filter */}
            <div className="flex items-center gap-1.5">
              {/* Sort */}
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setShowSort(p => !p)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                  title="Sort"
                >
                  <ArrowDownUp className="w-4 h-4" />
                </button>
                {showSort && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSort(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-44 bg-surface border border-border shadow-luxury ring-1 ring-white/10 rounded-xl overflow-hidden py-1">
                      {SORT_OPTIONS.map(o => (
                        <button
                          key={o.value}
                          onClick={() => { setSort(o.value); setShowSort(false); }}
                          className={`w-full text-left px-4 py-2.5 text-[13px] flex items-center justify-between transition-colors ${
                            sort === o.value ? 'text-primary font-bold bg-primary/10' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                          }`}
                        >
                          {o.label}
                          {sort === o.value && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Filter */}
              <div className="relative flex-shrink-0" ref={filterRef}>
                <button
                  onClick={() => setShowFilter(p => !p)}
                  className={`p-1.5 rounded-lg transition-colors relative ${
                    activeFilterCount > 0 ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
                  title="Filter"
                >
                  <Filter className="w-4 h-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {showFilter && <FilterPopover onClose={() => setShowFilter(false)} />}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bulk Actions Bar ────────────────────── */}
        {hasBulk && (
          <div className="px-4 py-2 bg-primary/10 border-b border-primary/30 flex items-center justify-between text-[12px] text-text-main shrink-0">
            <span className="font-semibold">{selectedIds.length} selected</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => bulk.mutate({ conversationIds: selectedIds, action: 'mark_read' })}
                className="px-2 py-1 hover:bg-surface-hover rounded transition-colors"
              >
                Mark Read
              </button>
              <button
                onClick={() => bulk.mutate({ conversationIds: selectedIds, action: 'archive' })}
                className="px-2 py-1 hover:bg-surface-hover rounded transition-colors"
              >
                Archive
              </button>
              <button
                onClick={() => bulk.mutate({ conversationIds: selectedIds, action: 'delete' })}
                className="px-2 py-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
              >
                Delete
              </button>
              <button onClick={clearSelection} className="p-1 hover:bg-surface-hover rounded text-text-muted">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Conversation List ───────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border/30">
          {isLoading && (
            <>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </>
          )}

          {isError && (
            <div className="p-8 text-center text-red-400 text-sm">
              <p className="font-semibold mb-2">Failed to load conversations</p>
              <button onClick={() => refetch()} className="btn-secondary text-xs">Retry</button>
            </div>
          )}

          {!isLoading && !isError && conversations.length === 0 && (
            <div className="p-8 text-center text-text-muted">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-bold text-text-main text-[14px]">No conversations</p>
              <p className="text-[12px] mt-1 text-text-muted">No messages match your current filters.</p>
              <button
                onClick={() => setShowNewConv(true)}
                className="mt-4 px-3.5 py-1.5 bg-primary text-white rounded-lg text-[12px] font-bold shadow-xs hover:opacity-90 transition-opacity"
              >
                + Start Conversation
              </button>
            </div>
          )}

          {conversations.map(conv => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              isSelected={selectedId === conv.id}
              isBulkSelected={selectedIds.includes(conv.id)}
              hasBulk={hasBulk}
              onSelect={() => setSelectedId(conv.id)}
              onToggleBulk={() => toggleSelected(conv.id)}
              onMarkRead={() => markRead.mutate(conv.id)}
              onMarkUnread={() => markUnread.mutate(conv.id)}
              onSnooze={() => setSnoozeForId(conv.id)}
              onArchive={() => patch.mutate({ id: conv.id, data: { status: 'archived' } })}
              onDelete={() => handleDelete(conv.id)}
              snoozeOpen={snoozeForId === conv.id}
              onSnoozeClose={() => setSnoozeForId(null)}
              onSnoozeConfirm={(until) => handleSnooze(conv.id, until)}
            />
          ))}
        </div>
      </div>

      {showNewConv && <NewConversationModal onClose={() => setShowNewConv(false)} />}
    </>
  );
}

// ── Conversation Row ──────────────────────────────────────────────────────────
function ConversationRow({
  conv, isSelected, isBulkSelected, hasBulk,
  onSelect, onToggleBulk,
  onMarkRead, onMarkUnread, onSnooze, onArchive, onDelete,
  snoozeOpen, onSnoozeClose, onSnoozeConfirm,
}: {
  conv: Conversation;
  isSelected: boolean;
  isBulkSelected: boolean;
  hasBulk: boolean;
  onSelect: () => void;
  onToggleBulk: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onSnooze: () => void;
  onArchive: () => void;
  onDelete: () => void;
  snoozeOpen: boolean;
  onSnoozeClose: () => void;
  onSnoozeConfirm: (until: string) => void;
}) {
  const contact = conv.contact;
  const displayName = contact
    ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || contact.email || 'Unknown'
    : conv.subject || 'Unknown';

  const isUnread = conv.unreadCount > 0;
  const tags: string[] = Array.isArray(conv.tags) ? conv.tags : (conv.tagsJson ? JSON.parse(conv.tagsJson) : []);

  const lastTs = conv.lastMessageAt
    ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
    : '';

  const preview = (() => {
    const msgs = conv.messages;
    if (!msgs || msgs.length === 0) return conv.subject ?? '';
    const last = msgs[msgs.length - 1];
    return last.body ?? '';
  })();

  const noContact = !conv.contactId;

  return (
    <div
      className={`relative group transition-colors border-b border-border/40 border-l-4 ${
        isSelected
          ? 'bg-primary/10 border-l-primary text-text-main shadow-xs'
          : isBulkSelected
          ? 'bg-primary/5 border-l-primary/60 text-text-main'
          : 'border-l-transparent hover:bg-surface-hover/70'
      }`}
    >
      {/* Checkbox for bulk */}
      <div
        className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 transition-opacity ${
          hasBulk ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <button
          onClick={e => { e.stopPropagation(); onToggleBulk(); }}
          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            isBulkSelected ? 'bg-primary border-primary text-white' : 'border-border bg-surface hover:border-primary'
          }`}
        >
          {isBulkSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>
      </div>

      <button
        onClick={onSelect}
        className="w-full text-left flex flex-col gap-1 px-3.5 py-3 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-text-muted shrink-0">
              <ChannelIcon channel={conv.channel} />
            </span>
            <span className={`text-[13px] truncate ${isUnread ? 'font-bold text-text-main' : 'font-semibold text-text-main/90'}`}>
              {displayName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
            <span className="text-[11px] text-text-muted tabular-nums">{lastTs}</span>
          </div>
        </div>

        {/* Preview */}
        <p className={`text-[12px] truncate leading-relaxed ${isUnread ? 'text-text-main/90 font-medium' : 'text-text-muted'}`}>
          {preview || <span className="italic text-text-muted/50">No messages</span>}
        </p>

        {/* Bottom row: tags + assignee */}
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {tags.slice(0, 2).map((tag, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted border border-border font-medium">
              {tag}
            </span>
          ))}
          {tags.length > 2 && (
            <span className="text-[10px] text-text-muted">+{tags.length - 2}</span>
          )}

          {conv.assignedUser && (
            <div className="ml-auto w-4.5 h-4.5 rounded-full bg-surface-hover flex items-center justify-center text-[9px] font-bold text-text-main border border-border shrink-0">
              {(conv.assignedUser.name?.[0] ?? 'U').toUpperCase()}
            </div>
          )}
        </div>
      </button>

      {/* Hover quick actions — positioned in bottom right corner */}
      <div className="absolute right-2.5 bottom-2 hidden group-hover:flex items-center gap-0.5 bg-surface/95 backdrop-blur-md border border-border shadow-luxury rounded-lg p-0.5 z-20">
        <button onClick={e => { e.stopPropagation(); isUnread ? onMarkRead() : onMarkUnread(); }} title={isUnread ? 'Mark read' : 'Mark unread'} className="p-1.5 rounded-md text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
          <Circle className={`w-3.5 h-3.5 ${isUnread ? 'fill-primary text-primary' : ''}`} />
        </button>
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); onSnooze(); }} title="Snooze" className="p-1.5 rounded-md text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
            <Clock className="w-3.5 h-3.5" />
          </button>
          {snoozeOpen && (
            <SnoozePicker onPick={until => { onSnoozeClose(); onSnoozeConfirm(until); }} />
          )}
        </div>
        <button onClick={e => { e.stopPropagation(); onArchive(); }} title="Archive" className="p-1.5 rounded-md text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete" className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-surface-hover transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
