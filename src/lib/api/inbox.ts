/**
 * Minimal Live Chat (website widget) API client.
 *
 * These are the /api/inbox read/write endpoints — the same service the
 * archived inbox UI used, now wired into the live Conversations page so
 * widget chats are visible and answerable (Tier 1 Fix 2). The widget itself
 * talks to /api/widget, not these routes.
 */
import { apiClient } from '../apiClient';

export interface LiveChatContact {
  id: string;
  name: string | null;
  email: string | null;
}

export interface LiveChatConversation {
  id: string;
  displayId: number;
  status: string;
  priority: string | null;
  subject: string | null;
  assignedUserId: string | null;
  unreadCount: number;
  lastActivityAt: string | null;
  createdAt: string;
  inboxChannel: { id: string; name: string; channelType: string };
  inboxContact: LiveChatContact | null;
}

export interface LiveChatMessage {
  id: string;
  senderType: 'agent' | 'contact' | 'bot' | 'system';
  senderId: string | null;
  content: string;
  createdAt: string;
}

export interface InboxChannel {
  id: string;
  name: string;
  channelType: string;
  isEnabled: boolean;
  embedToken: string | null;
  welcomeMessage: string | null;
  awayMessage: string | null;
  widgetColor: string;
}

const BASE = '/inbox';

export const inboxApi = {
  listConversations: (): Promise<{
    conversations: LiveChatConversation[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> => apiClient.get(`${BASE}/conversations`).then((r: any) => r.data),

  listMessages: (conversationId: string): Promise<{ messages: LiveChatMessage[]; hasMore: boolean }> =>
    apiClient.get(`${BASE}/conversations/${conversationId}/messages`).then((r: any) => r.data),

  // The route forces senderType 'agent' and senderId = the current user;
  // the message is delivered to the website visitor in real time.
  sendMessage: (conversationId: string, content: string): Promise<LiveChatMessage> =>
    apiClient.post(`${BASE}/conversations/${conversationId}/messages`, { content }).then((r: any) => r.data),

  // Clears the unread badge when an agent opens the thread.
  markRead: (conversationId: string): Promise<{ success: boolean }> =>
    apiClient.post(`${BASE}/conversations/${conversationId}/mark-read`).then((r: any) => r.data),

  // ── Live chat provisioning + channels (Tranche A fix 13) ────────────────
  // POST /provision used to have no caller at all: a fresh workspace had
  // no live-chat channel and no way to get one.
  getProvisionStatus: (): Promise<{ provisioned: boolean }> =>
    apiClient.get(`${BASE}/provision`).then((r: any) => r.data),

  provision: (): Promise<{ success: boolean }> =>
    apiClient.post(`${BASE}/provision`).then((r: any) => r.data),

  listChannels: (): Promise<InboxChannel[]> =>
    apiClient.get(`${BASE}/channels`).then((r: any) => r.data),

  createChannel: (data: { name: string; channelType: string; welcomeMessage?: string; awayMessage?: string }): Promise<InboxChannel> =>
    apiClient.post(`${BASE}/channels`, data).then((r: any) => r.data),

  updateChannel: (id: string, data: Partial<InboxChannel>): Promise<InboxChannel> =>
    apiClient.patch(`${BASE}/channels/${id}`, data).then((r: any) => r.data),

  getEmbedCode: (id: string): Promise<{ token: string; html: string }> =>
    apiClient.get(`${BASE}/channels/${id}/embed`).then((r: any) => r.data),
};
