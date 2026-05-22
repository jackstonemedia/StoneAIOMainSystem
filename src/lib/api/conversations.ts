/**
 * Typed Conversations API functions.
 */
import { apiClient } from '../apiClient';
import type { Conversation, ConversationMessage, ChannelConnection, SendMessageInput } from '../../types/conversation';

export const conversationsApi = {
  list: () =>
    apiClient.get<Conversation[]>('/business/conversations').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Conversation>(`/business/conversations/${id}`).then((r) => r.data),

  create: (data: Partial<Conversation>) =>
    apiClient.post<Conversation>('/business/conversations', data).then((r) => r.data),

  patch: (id: string, data: Partial<Pick<Conversation, 'status' | 'starred' | 'assignedUserId' | 'subject'>>) =>
    apiClient.patch<Conversation>(`/business/conversations/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/business/conversations/${id}`).then((r) => r.data),

  markRead: (id: string) =>
    apiClient.post(`/business/conversations/${id}/read-receipts`).then((r) => r.data),

  getMessages: (id: string) =>
    apiClient.get<ConversationMessage[]>(`/business/conversations/${id}/messages`).then((r) => r.data),

  sendMessage: (id: string, data: SendMessageInput) =>
    apiClient
      .post<ConversationMessage>(`/business/conversations/${id}/messages`, data)
      .then((r) => r.data),

  createConversation: (data: { contactId?: string; channel: string; subject?: string }) =>
    apiClient.post<Conversation>('/business/conversations', data).then((r) => r.data),
};

export const channelConnectionsApi = {
  list: () =>
    apiClient.get<ChannelConnection[]>('/channels/connections').then((r) => r.data),

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
};
