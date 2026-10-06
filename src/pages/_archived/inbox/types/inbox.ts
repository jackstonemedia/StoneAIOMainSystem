// ── Inbox TypeScript Types ──────────────────────────────────────────────────

export type InboxChannelType = 'live_chat' | 'email' | 'sms' | 'whatsapp' | 'facebook' | 'instagram' | 'api';
export type ConversationStatus = 'open' | 'resolved' | 'pending' | 'snoozed';
export type ConversationPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type MessageSenderType = 'agent' | 'contact' | 'bot' | 'system';
export type MessageContentType = 'text' | 'email' | 'input_select' | 'cards' | 'article';
export type AgentAvailability = 'online' | 'busy' | 'offline';

export interface InboxChannel {
  id: string;
  workspaceId: string;
  name: string;
  channelType: InboxChannelType;
  avatarUrl: string | null;
  welcomeMessage: string | null;
  awayMessage: string | null;
  widgetColor: string;
  isEnabled: boolean;
  embedToken: string | null;
  settingsJson: string;
  createdAt: string;
  updatedAt: string;
  agents?: InboxChannelAgent[];
}

export interface InboxChannelAgent {
  inboxChannelId: string;
  userId: string;
  availabilityStatus: AgentAvailability;
}

export interface InboxLabel {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  color: string;
  showOnSidebar: boolean;
  createdAt: string;
}

export interface InboxTeam {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members?: InboxTeamMember[];
}

export interface InboxTeamMember {
  teamId: string;
  userId: string;
  createdAt: string;
}

export interface CannedResponse {
  id: string;
  workspaceId: string;
  name: string;
  content: string;
  type: 'text' | 'email';
  folder: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxContact {
  id: string;
  workspaceId: string;
  crmContactId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  externalId: string | null;
  additionalAttributes: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  conversations?: InboxConversation[];
}

export interface MessageContentAttributes {
  email?: { from: string; to: string; subject: string; htmlBody?: string };
  attachments?: { url: string; name: string; size: number; type: string }[];
  ccsJson?: string[];
}

export interface InboxMessage {
  id: string;
  conversationId: string;
  workspaceId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  contentType: MessageContentType;
  content: string;
  contentAttributes: MessageContentAttributes | null;
  private: boolean;
  status: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
  mentions?: InboxMention[];
  // Populated from join
  senderName?: string;
  senderAvatar?: string;
}

export interface InboxMention {
  id: string;
  messageId: string;
  mentionedId: string;
  read: boolean;
  createdAt: string;
}

export interface InboxConversation {
  id: string;
  workspaceId: string;
  displayId: number;
  status: ConversationStatus;
  priority: ConversationPriority | null;
  subject: string | null;
  assignedUserId: string | null;
  teamId: string | null;
  snoozedUntil: string | null;
  firstReplyAt: string | null;
  resolvedAt: string | null;
  waitingSince: string | null;
  unreadCount: number;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  inboxChannel: { id: string; name: string; channelType: InboxChannelType; avatarUrl: string | null; widgetColor: string };
  inboxContact: InboxContact | null;
  team: InboxTeam | null;
  labels: InboxLabel[];
  messages?: InboxMessage[];
  // Populated
  assignedAgent?: { userId: string; name: string; email: string; avatarUrl?: string };
}

export interface InboxConversationList {
  conversations: InboxConversation[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface InboxAgentSignature {
  id: string;
  workspaceId: string;
  userId: string;
  body: string;
}

export interface InboxAgent {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  availabilityStatus: AgentAvailability;
}

export interface InboxReportOverview {
  totalConversations: number;
  resolvedConversations: number;
  openConversations: number;
  pendingConversations: number;
  avgFirstResponseMs: number | null;
  avgResolutionMs: number | null;
}

export interface InboxFilters {
  status?: ConversationStatus | 'all';
  assignedUserId?: string | 'me' | 'unassigned';
  teamId?: string;
  labelId?: string;
  inboxChannelId?: string;
  priority?: ConversationPriority;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface InboxSSEEvent {
  type:
    | 'conversation.created'
    | 'conversation.updated'
    | 'conversation.resolved'
    | 'message.created'
    | 'message.created.private'
    | 'agent.typing'
    | 'contact.typing'
    | 'agent.availability.updated';
  workspaceId: string;
  conversationId?: string;
  payload: Record<string, unknown>;
}
