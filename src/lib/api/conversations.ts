/**
 * Typed Conversations API functions.
 */
import { apiClient } from '../apiClient';
import type { Conversation, ConversationMessage, SendMessageInput } from '../../types/conversation';

export const conversationsApi = {
  list: () =>
    apiClient.get<Conversation[]>('/business/conversations').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Conversation>(`/business/conversations/${id}`).then((r) => r.data),

  create: (data: Partial<Conversation>) =>
    apiClient.post<Conversation>('/business/conversations', data).then((r) => r.data),

  getMessages: (id: string) =>
    apiClient.get<ConversationMessage[]>(`/business/conversations/${id}/messages`).then((r) => r.data),

  sendMessage: (id: string, data: SendMessageInput) =>
    apiClient
      .post<ConversationMessage>(`/business/conversations/${id}/messages`, data)
      .then((r) => r.data),
};
