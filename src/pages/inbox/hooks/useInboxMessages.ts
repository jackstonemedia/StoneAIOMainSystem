import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../lib/api/inbox';

export function useInboxMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['inbox', 'messages', conversationId],
    queryFn: () => (conversationId ? inboxApi.listMessages(conversationId) : null),
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, data }: { conversationId: string; data: any }) =>
      inboxApi.sendMessage(conversationId, data),
    onSuccess: (message, variables) => {
      // Optimistic-like update or just invalidate
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
    },
  });
}
