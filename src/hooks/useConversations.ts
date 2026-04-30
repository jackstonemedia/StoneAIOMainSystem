/**
 * Conversation data hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../lib/api/conversations';
import { queryKeys } from '../lib/queryKeys';
import type { SendMessageInput } from '../types/conversation';

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations.list(),
    queryFn: conversationsApi.list,
    staleTime: 15_000,
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
    refetchInterval: 15_000, // poll for new messages
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
