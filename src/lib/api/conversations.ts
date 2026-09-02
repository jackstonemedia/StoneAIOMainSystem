/**
 * Typed Conversations API functions.
 */
import { apiClient } from '../apiClient';
import type {
  Conversation,
  ConversationMessage,
  ChannelConnection,
  SendMessageInput,
  ConversationTemplate,
  ConversationTag,
  ConversationFilters,
  BulkConversationActionInput,
} from '../../types/conversation';

export const conversationsApi = {
  list: (filters: ConversationFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.channel && filters.channel !== 'all') params.set('channel', filters.channel);
    if (filters.view && filters.view !== 'all') params.set('view', filters.view);
    if (filters.search) params.set('search', filters.search);
    if (filters.assignedUserId) params.set('assignedUserId', filters.assignedUserId);
    if (filters.tag) params.set('tag', filters.tag);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.isRead !== undefined) params.set('isRead', String(filters.isRead));
    if (filters.dateRange?.from) params.set('dateFrom', filters.dateRange.from);
    if (filters.dateRange?.to) params.set('dateTo', filters.dateRange.to);

    const qs = params.toString();
    return apiClient
      .get<Conversation[]>(`/business/conversations${qs ? `?${qs}` : ''}`)
      .then((r) => r.data);
  },

  get: (id: string) =>
    apiClient.get<Conversation>(`/business/conversations/${id}`).then((r) => r.data),

  create: (data: {
    contactId?: string | null;
    channel: string;
    subject?: string | null;
    body?: string;
    to?: string;
    fromChannelId?: string;
  }) => apiClient.post<Conversation>('/business/conversations', data).then((r) => r.data),

  patch: (
    id: string,
    data: Partial<
      Pick<
        Conversation,
        'status' | 'starred' | 'assignedUserId' | 'subject' | 'snoozedUntil' | 'tags' | 'isBlocked' | 'priority'
      >
    >
  ) => apiClient.patch<Conversation>(`/business/conversations/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/business/conversations/${id}`).then((r) => r.data),

  bulk: (data: BulkConversationActionInput) =>
    apiClient.patch<{ success: boolean; updatedCount: number }>('/business/conversations/bulk', data).then((r) => r.data),

  markRead: (id: string) =>
    apiClient.post(`/business/conversations/${id}/read-receipts`).then((r) => r.data),

  markUnread: (id: string) =>
    apiClient.post(`/business/conversations/${id}/mark-unread`).then((r) => r.data),

  getMessages: (id: string) =>
    apiClient.get<ConversationMessage[]>(`/business/conversations/${id}/messages`).then((r) => r.data),

  sendMessage: (id: string, data: SendMessageInput) =>
    apiClient
      .post<ConversationMessage>(`/business/conversations/${id}/messages`, data)
      .then((r) => r.data),

  retryMessage: (conversationId: string, messageId: string) =>
    apiClient
      .post<ConversationMessage>(`/business/conversations/${conversationId}/messages/${messageId}/retry`)
      .then((r) => r.data),

  merge: (id: string, targetConversationId: string) =>
    apiClient
      .post<{ success: boolean; conversation: Conversation }>(`/business/conversations/${id}/merge`, {
        targetConversationId,
      })
      .then((r) => r.data),

  export: (id: string) =>
    apiClient.get<string>(`/business/conversations/${id}/export`, { responseType: 'blob' as any }).then((r) => r.data),

  // ── Templates ─────────────────────────────────────────────────────────────
  listTemplates: (channel?: string) =>
    apiClient
      .get<ConversationTemplate[]>(`/business/templates${channel ? `?channel=${channel}` : ''}`)
      .then((r) => r.data),

  createTemplate: (data: Partial<ConversationTemplate>) =>
    apiClient.post<ConversationTemplate>('/business/templates', data).then((r) => r.data),

  updateTemplate: (id: string, data: Partial<ConversationTemplate>) =>
    apiClient.patch<ConversationTemplate>(`/business/templates/${id}`, data).then((r) => r.data),

  deleteTemplate: (id: string) =>
    apiClient.delete(`/business/templates/${id}`).then((r) => r.data),

  // ── Tags ──────────────────────────────────────────────────────────────────
  listTags: () =>
    apiClient.get<ConversationTag[]>('/business/tags/conversations').then((r) => r.data),

  createTag: (data: { name: string; color: string; scope?: string }) =>
    apiClient.post<ConversationTag>('/business/tags/conversations', data).then((r) => r.data),

  updateTag: (id: string, data: { name?: string; color?: string; scope?: string }) =>
    apiClient.patch<ConversationTag>(`/business/tags/conversations/${id}`, data).then((r) => r.data),

  deleteTag: (id: string) =>
    apiClient.delete(`/business/tags/conversations/${id}`).then((r) => r.data),

  mergeTags: (sourceTagId: string, targetTagId: string) =>
    apiClient
      .post<{ success: boolean }>('/business/tags/conversations/merge', { sourceTagId, targetTagId })
      .then((r) => r.data),
};

export const channelConnectionsApi = {
  list: () =>
    apiClient.get<ChannelConnection[]>('/channels/connections').then((r) => r.data),

  update: (id: string, data: Partial<ChannelConnection>) =>
    apiClient.patch<ChannelConnection>(`/channels/connections/${id}`, data).then((r) => r.data),

  disconnect: (id: string) =>
    apiClient.delete(`/channels/connections/${id}`).then((r) => r.data),

  connectGmail: async () => {
    const res = await apiClient.get<{ url: string }>('/channels/gmail/connect');
    window.location.href = res.data.url;
  },

  connectOutlook: async () => {
    const res = await apiClient.get<{ url: string }>('/channels/outlook/connect');
    window.location.href = res.data.url;
  },

  connectSms: (data: { accountSid: string; authToken: string; phoneNumber: string }) =>
    apiClient.post('/channels/sms/connect', data).then((r) => r.data),

  searchTwilioNumbers: (areaCode: string) =>
    apiClient
      .get<Array<{ phoneNumber: string; friendlyName: string; locality: string; region: string }>>(
        `/channels/sms/available-numbers?areaCode=${encodeURIComponent(areaCode)}`
      )
      .then((r) => r.data),

  provisionTwilioNumber: (data: { phoneNumber: string; friendlyLabel?: string }) =>
    apiClient.post('/channels/sms/provision', data).then((r) => r.data),
};
