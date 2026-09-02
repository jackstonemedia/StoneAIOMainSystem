import React, { createContext, useContext, useState, useMemo } from 'react';
import type { ConversationFilters, ConversationStatus } from '../../../types/conversation';

interface ConversationsContextValue {
  // Filters
  channel: 'all' | 'email' | 'sms';
  view: NonNullable<ConversationFilters['view']>;
  search: string;
  sort: NonNullable<ConversationFilters['sort']>;
  statusFilter: ConversationStatus | 'all';
  assigneeFilter: string;
  tagFilter: string;
  isReadFilter: boolean | undefined;
  dateRangeFilter: { from?: string; to?: string } | undefined;

  // Active filter count (for badge)
  activeFilterCount: number;

  // Selection
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;

  // Bulk
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;

  // Setters
  setChannel: (c: 'all' | 'email' | 'sms') => void;
  setView: (v: NonNullable<ConversationFilters['view']>) => void;
  setSearch: (s: string) => void;
  setSort: (s: NonNullable<ConversationFilters['sort']>) => void;
  setStatusFilter: (s: ConversationStatus | 'all') => void;
  setAssigneeFilter: (a: string) => void;
  setTagFilter: (t: string) => void;
  setIsReadFilter: (r: boolean | undefined) => void;
  setDateRangeFilter: (d: { from?: string; to?: string } | undefined) => void;
  resetFilters: () => void;

  // Derived query filters
  queryFilters: ConversationFilters;
}

const ConversationsContext = createContext<ConversationsContextValue | undefined>(undefined);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const [channel, setChannel] = useState<'all' | 'email' | 'sms'>('all');
  const [view, setView] = useState<NonNullable<ConversationFilters['view']>>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<NonNullable<ConversationFilters['sort']>>('newest');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('open');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [isReadFilter, setIsReadFilter] = useState<boolean | undefined>(undefined);
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from?: string; to?: string } | undefined>(undefined);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedIds([]);

  const resetFilters = () => {
    setAssigneeFilter('');
    setTagFilter('');
    setIsReadFilter(undefined);
    setDateRangeFilter(undefined);
    setStatusFilter('open');
  };

  const activeFilterCount = [
    assigneeFilter !== '',
    tagFilter !== '',
    isReadFilter !== undefined,
    dateRangeFilter !== undefined,
    statusFilter !== 'open',
  ].filter(Boolean).length;

  const queryFilters = useMemo<ConversationFilters>(() => ({
    channel: channel !== 'all' ? channel : undefined,
    view,
    search: search || undefined,
    sort,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    assignedUserId: assigneeFilter || undefined,
    tag: tagFilter || undefined,
    isRead: isReadFilter,
    dateRange: dateRangeFilter,
  }), [channel, view, search, sort, statusFilter, assigneeFilter, tagFilter, isReadFilter, dateRangeFilter]);

  const value = useMemo<ConversationsContextValue>(() => ({
    channel, view, search, sort, statusFilter, assigneeFilter, tagFilter, isReadFilter, dateRangeFilter,
    activeFilterCount,
    selectedId, setSelectedId,
    selectedIds, setSelectedIds, toggleSelected, clearSelection,
    setChannel, setView, setSearch, setSort, setStatusFilter,
    setAssigneeFilter, setTagFilter, setIsReadFilter, setDateRangeFilter,
    resetFilters,
    queryFilters,
  }), [
    channel, view, search, sort, statusFilter, assigneeFilter, tagFilter, isReadFilter,
    dateRangeFilter, activeFilterCount, selectedId, selectedIds, queryFilters,
  ]);

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversationsCtx() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error('useConversationsCtx must be used inside ConversationsProvider');
  return ctx;
}
