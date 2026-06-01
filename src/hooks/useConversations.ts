/**
 * Conversation data hooks.
 */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi, channelConnectionsApi } from '../lib/api/conversations';
import { getStoredToken } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';
import type { Conversation, SendMessageInput } from '../types/conversation';

export function useConversations() {
  const qc = useQueryClient();

  // Real-time SSE — invalidates list whenever the server publishes a new_message event.
  // Falls back to polling (refetchInterval) automatically if Redis is not configured.
  // NOTE: EventSource cannot set Authorization headers, so we pass the JWT as a query
  // param (?token=...) and the server middleware reads it from req.query for SSE paths.
  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    const connect = async () => {
      let url = '/api/channels/sse';
      const token = await getStoredToken();
      if (token) url += `?token=${encodeURIComponent(token)}`;

      if (cancelled) return;
      es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'new_message') {
            qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
            if (payload.conversationId) {
              qc.invalidateQueries({ queryKey: queryKeys.conversations.messages(payload.conversationId) });
            }
          }
        } catch {}
      };
    };

    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [qc]);

  return useQuery({
    queryKey: queryKeys.conversations.list(),
    queryFn: conversationsApi.list,
    staleTime: 15_000,
    refetchInterval: 15_000, // polling fallback when Redis/SSE is unavailable
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(id),
    queryFn: () => conversationsApi.get(id),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useConversationMessages(id: string) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(id),
    queryFn: () => conversationsApi.getMessages(id),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SendMessageInput) =>
      conversationsApi.sendMessage(conversationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { contactId?: string; channel: string; subject?: string }) =>
      conversationsApi.createConversation(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  });
}

export function usePatchConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Conversation, 'status' | 'starred' | 'assignedUserId' | 'subject'>> }) =>
      conversationsApi.patch(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  });
}

export function useChannelConnections() {
  return useQuery({
    queryKey: queryKeys.conversations.channelConnections(),
    queryFn: channelConnectionsApi.list,
    staleTime: 30_000,
  });
}

export function useDisconnectChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => channelConnectionsApi.disconnect(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.channelConnections() });
    },
  });
}
