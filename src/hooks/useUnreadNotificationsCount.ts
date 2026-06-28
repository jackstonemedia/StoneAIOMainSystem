import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

export function useUnreadNotificationsCount() {
  const { data, isLoading } = useQuery({
    queryKey: ['unread-notifications-count'],
    queryFn: async () => {
      const res = await apiFetch('/api/notifications/unread-count');
      if (!res.ok) return 0;
      const json = await res.json();
      return json.count || 0;
    },
    staleTime: 60000, // 1 minute
  });

  return { count: data || 0, isLoading };
}
