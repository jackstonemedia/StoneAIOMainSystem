import React, { createContext, useContext, useState, useMemo } from 'react';
import type { ConversationStatus, ConversationPriority, AgentAvailability } from '../types/inbox';

interface InboxContextValue {
  activeView: 'all' | 'mine' | 'unassigned' | 'pending' | 'snoozed';
  statusFilter: ConversationStatus | 'all';
  inboxChannelId: string | null;
  teamId: string | null;
  labelId: string | null;
  priority: ConversationPriority | null;
  searchQuery: string;
  sortBy: 'last_activity' | 'created_at' | 'priority';
  
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  
  myAvailability: AgentAvailability;
  setMyAvailability: (status: AgentAvailability) => void;
  
  // Setters for filters
  setActiveView: (view: 'all' | 'mine' | 'unassigned' | 'pending' | 'snoozed') => void;
  setStatusFilter: (status: ConversationStatus | 'all') => void;
  setInboxChannelId: (id: string | null) => void;
  setTeamId: (id: string | null) => void;
  setLabelId: (id: string | null) => void;
  setPriority: (priority: ConversationPriority | null) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: 'last_activity' | 'created_at' | 'priority') => void;
}

const InboxContext = createContext<InboxContextValue | undefined>(undefined);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<'all' | 'mine' | 'unassigned' | 'pending' | 'snoozed'>('all');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('open');
  const [inboxChannelId, setInboxChannelId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [labelId, setLabelId] = useState<string | null>(null);
  const [priority, setPriority] = useState<ConversationPriority | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'last_activity' | 'created_at' | 'priority'>('last_activity');
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [myAvailability, setMyAvailability] = useState<AgentAvailability>('online');

  const value = useMemo(() => ({
    activeView, setActiveView,
    statusFilter, setStatusFilter,
    inboxChannelId, setInboxChannelId,
    teamId, setTeamId,
    labelId, setLabelId,
    priority, setPriority,
    searchQuery, setSearchQuery,
    sortBy, setSortBy,
    selectedConversationId, setSelectedConversationId,
    myAvailability, setMyAvailability
  }), [
    activeView, statusFilter, inboxChannelId, teamId, labelId, priority,
    searchQuery, sortBy, selectedConversationId, myAvailability
  ]);

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used within InboxProvider');
  return ctx;
}
