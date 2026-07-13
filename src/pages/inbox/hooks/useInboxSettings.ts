import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../lib/api/inbox';

export function useInboxLabels() {
  return useQuery({
    queryKey: ['inbox', 'labels'],
    queryFn: () => inboxApi.listLabels(),
  });
}

export function useInboxTeams() {
  return useQuery({
    queryKey: ['inbox', 'teams'],
    queryFn: () => inboxApi.listTeams(),
  });
}

export function useInboxCannedResponses(q?: string) {
  return useQuery({
    queryKey: ['inbox', 'canned-responses', q],
    queryFn: () => inboxApi.listCannedResponses(q),
  });
}

export function useInboxChannels() {
  return useQuery({
    queryKey: ['inbox', 'channels'],
    queryFn: () => inboxApi.listChannels(),
  });
}

export function useInboxAgents() {
  return useQuery({
    queryKey: ['inbox', 'agents'],
    queryFn: () => inboxApi.listAgents(),
  });
}
