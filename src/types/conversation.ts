/**
 * Conversation & messaging domain types.
 */

export type ConversationChannel = 'sms' | 'email' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'whatsapp' | 'chat';
export type ConversationStatus = 'open' | 'closed' | 'snoozed';

export interface Conversation {
  id: string;
  workspaceId: string;
  contactId: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  unreadCount: number;
  subject: string | null;
  externalId: string | null;
  channelConnectionId: string | null;
  lastMessageAt: string | null;
  assignedUserId: string | null;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    color: string | null;
  } | null;
  messages?: ConversationMessage[];
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  sender: string;
  body: string;
  direction: 'inbound' | 'outbound';
  externalId: string | null;
  status: string;
  channel: string | null;
  attachments: string | null;
  createdAt: string;
}

export interface ChannelConnection {
  id: string;
  userId: string;
  provider: 'gmail' | 'outlook' | 'twilio';
  label: string | null;
  email: string | null;
  twilioPhoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
}

export type SendMessageInput = {
  body: string;
  direction?: 'inbound' | 'outbound';
  channel?: ConversationChannel;
  /** Override recipient email address (email channel only) */
  to?: string;
  /** Email subject line (email channel only) */
  subject?: string;
  /** HTML version of the email body (email channel only) */
  htmlBody?: string;
};

/**
 * Parsed metadata stored in the `attachments` JSON field for email messages.
 */
export interface EmailMessageMeta {
  /** Email address of the sender (inbound) or recipient (outbound) */
  fromEmail?: string;
  toEmail?: string;
  subject?: string;
  date?: string;
  /** Full HTML body of the email. Null for plain-text-only emails. */
  htmlBody?: string | null;
}

/** Parse the JSON attachments field into typed metadata. Returns null on failure. */
export function parseEmailMeta(attachments: string | null): EmailMessageMeta | null {
  if (!attachments) return null;
  try { return JSON.parse(attachments) as EmailMessageMeta; }
  catch { return null; }
}
