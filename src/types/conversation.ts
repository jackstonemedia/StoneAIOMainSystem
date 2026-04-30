/**
 * Conversation & messaging domain types.
 */

export type ConversationChannel = 'sms' | 'email' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'whatsapp';
export type ConversationStatus = 'open' | 'closed' | 'snoozed';

export interface Conversation {
  id: string;
  workspaceId: string;
  contactId: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  } | null;
  messages?: ConversationMessage[];
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  sender: string;
  body: string;
  direction: 'inbound' | 'outbound';
  attachments: string | null;
  createdAt: string;
}

export type SendMessageInput = {
  body: string;
  direction?: 'inbound' | 'outbound';
};
