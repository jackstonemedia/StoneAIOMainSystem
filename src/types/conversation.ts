/**
 * Conversation & messaging domain types.
 */

export type ConversationChannel = 'sms' | 'email' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'whatsapp' | 'chat';
export type ConversationStatus = 'open' | 'closed' | 'snoozed' | 'archived';
export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'opened';

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
  snoozedUntil?: string | null;
  tags?: string[];
  tagsJson?: string;
  isBlocked?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    color: string | null;
    avatarUrl?: string | null;
  } | null;
  messages?: ConversationMessage[];
  assignedUser?: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
  } | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  sender: string;
  body: string;
  direction: 'inbound' | 'outbound';
  externalId: string | null;
  status: MessageDeliveryStatus | string;
  channel: string | null;
  errorMsg?: string | null;
  attachments: string | null;
  isSystemEvent?: boolean;
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
  status?: 'healthy' | 'expired' | 'disconnected';
  createdAt: string;
  updatedAt?: string;
  // Configuration options
  twoWaySync?: boolean;
  signature?: string;
  autoReply?: boolean;
  autoReplyText?: string;
  sharedWithUserIds?: string[];
  archiveOnReply?: boolean;
  forwardingNumber?: string;
  businessHoursAutoReply?: boolean;
  teamRoutingId?: string;
  stopStartHandling?: boolean;
  quietHoursEnabled?: boolean;
}

export interface ConversationTemplate {
  id: string;
  workspaceId: string;
  name: string;
  channel: 'email' | 'sms' | 'both';
  subject?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationTag {
  id: string;
  name: string;
  color: string;
  usageCount: number;
  scope: 'shared' | 'conversations_only';
  createdAt?: string;
}

export interface ConversationFilters {
  channel?: 'all' | 'email' | 'sms';
  view?: 'all' | 'unassigned' | 'mine' | 'unread' | 'snoozed' | 'archived';
  search?: string;
  assignedUserId?: string;
  tag?: string;
  status?: ConversationStatus | 'all';
  dateRange?: { from?: string; to?: string };
  isRead?: boolean;
  sort?: 'newest' | 'oldest' | 'unread_first';
}

export type SendMessageInput = {
  body: string;
  direction?: 'inbound' | 'outbound';
  channel?: ConversationChannel;
  /** Override recipient email address (email channel only) */
  to?: string;
  /** CC email addresses */
  cc?: string[];
  /** BCC email addresses */
  bcc?: string[];
  /** Email subject line (email channel only) */
  subject?: string;
  /** HTML version of the email body (email channel only) */
  htmlBody?: string;
  /** Send & Close flag */
  sendAndClose?: boolean;
  /** Signature included flag */
  includeSignature?: boolean;
};

export interface BulkConversationActionInput {
  conversationIds: string[];
  action: 'mark_read' | 'mark_unread' | 'assign' | 'add_tag' | 'remove_tag' | 'change_status' | 'archive' | 'delete';
  payload?: {
    assignedUserId?: string | null;
    tag?: string;
    status?: ConversationStatus;
  };
}

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
  /** Attached files */
  files?: Array<{ name: string; url: string; size?: number; type?: string }>;
}

/** Parse the JSON attachments field into typed metadata. Returns null on failure. */
export function parseEmailMeta(attachments: string | null): EmailMessageMeta | null {
  if (!attachments) return null;
  try { return JSON.parse(attachments) as EmailMessageMeta; }
  catch { return null; }
}
