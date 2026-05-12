import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface Release {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export function useReleases() {
  return useQuery({
    queryKey: ['ap-releases'],
    queryFn: async () => {
      const { data } = await apiClient.get<Release[]>('/releases');
      return data;
    },
  });
}

export function useCreateRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const { data } = await apiClient.post<Release>('/releases', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap-releases'] }),
  });
}

export function usePushToGit() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/releases/git/push');
      return data;
    },
  });
}
