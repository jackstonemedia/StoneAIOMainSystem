import { apiClient } from '../apiClient';

export type UnifiedSource = 'legacy' | 'live';

export interface UnifiedThread {
  id: string;
  source: UnifiedSource;
  contactLabel: string;
  channel: string;
  channelLabel: string;
  subject: string | null;
  preview: string | null;
  lastActivityAt: string | null;
  unreadCount: number;
  status: string;
  assignedUserId: string | null;
}

export interface UnifiedMessage {
  id: string;
  sender: string;
  body: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
  status: string | null;
  private?: boolean;
}

export interface UnifiedListParams {
  q?: string;
  status?: string;
  unreadOnly?: boolean;
  assignedUserId?: string;
  page?: number;
  pageSize?: number;
}

export const unifiedInboxApi = {
  list: (params: UnifiedListParams = {}) =>
    apiClient
      .get<{ threads: UnifiedThread[]; total: number; unreadTotal: number }>('/inbox/unified', { params })
      .then((r) => r.data),

  unread: () =>
    apiClient.get<{ unread: number }>('/inbox/unified/unread').then((r) => r.data),

  getThread: (source: UnifiedSource, id: string) =>
    apiClient
      .get<{ thread: UnifiedThread; messages: UnifiedMessage[] }>(`/inbox/unified/${source}/${id}`)
      .then((r) => r.data),

  sendMessage: (source: UnifiedSource, id: string, body: string) =>
    apiClient.post(`/inbox/unified/${source}/${id}/messages`, { body }).then((r) => r.data),

  markRead: (source: UnifiedSource, id: string) =>
    apiClient.post(`/inbox/unified/${source}/${id}/mark-read`).then((r) => r.data),
};
