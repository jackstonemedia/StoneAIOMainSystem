import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../lib/api/inbox';
import type { InboxFilters } from '../types/inbox';

export function useInboxConversations(filters: InboxFilters) {
  return useInfiniteQuery({
    queryKey: ['inbox', 'conversations', filters],
    queryFn: ({ pageParam = 1 }) => inboxApi.listConversations({ ...filters, page: pageParam as number }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    initialPageParam: 1,
    staleTime: 10_000,
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => inboxApi.updateConversation(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'conversation', data.id] });
    },
  });
}
