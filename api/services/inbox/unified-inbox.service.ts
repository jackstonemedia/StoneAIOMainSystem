'use strict';

// Unified inbox (complete-platform item 2) — ONE list + thread over BOTH
// conversation stores, read-both (see workspace/launch/unified-inbox-design.md).
//
// Why read-both, not migrate: the stores have no shared identity key
// (cross-system identity is item 1.23, a follow-up), and each has its
// own reply path with its own side effects. No writer writes to both
// stores for the same message, so a merged read cannot duplicate one.
//
// Reply and mark-read route to the owning store's REAL path — the
// legacy route's send + dispatch, the inbox service's createMessage —
// so nothing about delivery changes; only the surface is unified.

import { db } from '../../../infrastructure/database/client.js';
import { listConversations as listLegacyConversations, sendConversationMessage } from '../business.service.js';
import { listConversations as listInboxConversations } from './inbox-conversation.service.js';
import { createMessage as createInboxMessage } from './inbox-message.service.js';
import { dispatchOutboundMessage } from '../../routes/business.routes.js';

export type UnifiedSource = 'legacy' | 'live';

export interface UnifiedThread {
  id: string;
  source: UnifiedSource;
  contactLabel: string;
  channel: string;
  channelLabel: string;
  subject: string | null;
  preview: string | null;
  lastActivityAt: Date | string | null;
  unreadCount: number;
  status: string;
  assignedUserId: string | null;
}

export interface UnifiedMessage {
  id: string;
  sender: string;
  body: string;
  direction: 'inbound' | 'outbound';
  createdAt: Date | string;
  status: string | null;
  private?: boolean;
}

function legacyContactLabel(c: any): string {
  if (!c) return 'Unknown';
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return name || c.email || c.phone || 'Unknown';
}

function liveContactLabel(c: any, displayId: number): string {
  return c?.name || c?.email || `Visitor #${displayId}`;
}

function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    sms: 'SMS',
    email: 'Email',
    gmail: 'Gmail',
    outlook: 'Outlook',
    live_chat: 'Live chat',
    meta: 'Meta',
    facebook: 'Facebook',
    instagram: 'Instagram',
    whatsapp: 'WhatsApp',
  };
  return labels[channel] ?? channel;
}

function toUnifiedLegacy(row: any): UnifiedThread {
  const latest = row.messages?.[0];
  return {
    id: row.id,
    source: 'legacy',
    contactLabel: legacyContactLabel(row.contact),
    channel: row.channel ?? 'sms',
    channelLabel: channelLabel(row.channel ?? 'sms'),
    subject: row.subject ?? null,
    preview: latest?.body ?? null,
    lastActivityAt: row.lastMessageAt ?? row.updatedAt ?? row.createdAt ?? null,
    unreadCount: row.unreadCount ?? 0,
    status: row.status ?? 'open',
    assignedUserId: row.assignedUserId ?? null,
  };
}

function toUnifiedLive(row: any, latestByConversation: Map<string, any>): UnifiedThread {
  const latest = latestByConversation.get(row.id);
  return {
    id: row.id,
    source: 'live',
    contactLabel: liveContactLabel(row.inboxContact, row.displayId),
    channel: row.inboxChannel?.channelType ?? 'live_chat',
    channelLabel: channelLabel(row.inboxChannel?.channelType ?? 'live_chat'),
    subject: row.subject ?? null,
    preview: latest?.content ?? null,
    lastActivityAt: row.lastActivityAt ?? row.updatedAt ?? row.createdAt ?? null,
    unreadCount: row.unreadCount ?? 0,
    status: row.status ?? 'open',
    assignedUserId: row.assignedUserId ?? null,
  };
}

export interface UnifiedListFilters {
  q?: string;
  status?: string;
  unreadOnly?: boolean;
  assignedUserId?: string; // 'me' | 'unassigned' | a user id
  callerUserId?: string;
  page?: number;
  pageSize?: number;
}

export async function listUnifiedThreads(
  workspaceId: string,
  filters: UnifiedListFilters = {},
): Promise<{ threads: UnifiedThread[]; total: number; unreadTotal: number }> {
  const pageSize = Number(filters.pageSize || 25);
  const fetchN = pageSize * 2; // pagination is approximate across two
  // stores: over-fetch from each, merge by recency, slice to the page.
  // Stated here, not hidden — exact cross-store paging would need a
  // single merged table, which is the migrate design this item rejects.

  const legacyFilters: Record<string, any> = {};
  if (filters.q) legacyFilters.search = filters.q;
  if (filters.status) legacyFilters.status = filters.status;
  if (filters.unreadOnly) legacyFilters.view = 'unread';
  if (filters.assignedUserId) legacyFilters.assignedUserId = filters.assignedUserId;

  const [legacyRows, inboxPage] = await Promise.all([
    listLegacyConversations(workspaceId, legacyFilters, filters.callerUserId),
    listInboxConversations(workspaceId, {
      q: filters.q,
      status: filters.status,
      assignedUserId: filters.assignedUserId,
      callerUserId: filters.callerUserId,
      page: 1,
      pageSize: fetchN,
    }),
  ]);

  // Latest message per inbox thread, one query for the whole page.
  const inboxIds = inboxPage.conversations.map((c: any) => c.id);
  const latestByConversation = new Map<string, any>();
  if (inboxIds.length > 0) {
    const latest = await db.inboxMessage.findMany({
      where: { conversationId: { in: inboxIds } },
      orderBy: { createdAt: 'desc' },
    });
    for (const m of latest) {
      if (!latestByConversation.has(m.conversationId)) latestByConversation.set(m.conversationId, m);
    }
  }

  const threads: UnifiedThread[] = [
    ...legacyRows.map(toUnifiedLegacy),
    ...inboxPage.conversations.map((c: any) => toUnifiedLive(c, latestByConversation)),
  ];

  // Unread-only is applied per-store above, but the legacy 'view'
  // filter and the inbox service may disagree on edge cases — enforce
  // it once here so the merged list never shows a read thread as unread.
  const visible = filters.unreadOnly ? threads.filter((t) => t.unreadCount > 0) : threads;

  visible.sort((a, b) => {
    const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return tb - ta;
  });

  const total = visible.length;
  const page = Number(filters.page || 1);
  const sliced = visible.slice((page - 1) * pageSize, page * pageSize);
  const unreadTotal = visible.reduce((sum, t) => sum + t.unreadCount, 0);

  return { threads: sliced, total, unreadTotal };
}

export async function getUnifiedThread(
  workspaceId: string,
  source: UnifiedSource,
  id: string,
): Promise<{ thread: UnifiedThread; messages: UnifiedMessage[] } | null> {
  if (source === 'legacy') {
    const row = await db.conversation.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, color: true, avatarUrl: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' as const } },
      },
    });
    if (!row || (row as any).workspaceId !== workspaceId) return null;
    const messages = await db.conversationMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
    return {
      thread: toUnifiedLegacy(row),
      messages: messages.map((m: any) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        direction: (m.direction === 'inbound' ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
        createdAt: m.createdAt,
        status: m.status ?? null,
      })),
    };
  }

  const row = await db.inboxConversation.findUnique({
    where: { id },
    include: {
      inboxChannel: { select: { id: true, name: true, channelType: true, avatarUrl: true, widgetColor: true } },
      inboxContact: true,
    },
  });
  if (!row || (row as any).workspaceId !== workspaceId) return null;
  const messages = await db.inboxMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });
  return {
    thread: toUnifiedLive(row, new Map(messages.length ? [[id, messages[messages.length - 1]]] : [])),
    messages: messages.map((m: any) => ({
      id: m.id,
      sender: m.senderType === 'agent' ? 'agent' : m.senderType,
      body: m.content,
      direction: (m.senderType === 'contact' ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
      createdAt: m.createdAt,
      status: m.status ?? null,
      private: !!m.private,
    })),
  };
}

export async function sendUnifiedReply(
  workspaceId: string,
  source: UnifiedSource,
  id: string,
  body: string,
  userId: string | undefined,
  opts: { toEmail?: string; subject?: string; htmlBody?: string; includeSignature?: boolean } = {},
) {
  if (!body?.trim()) throw new Error('body is required');
  if (source === 'legacy') {
    // The exact legacy route path: record the message, then dispatch
    // through the channel. A dispatch failure throws (the route turns
    // it into a 400) — the message row stays, marked failed by the
    // dispatcher, exactly as the legacy composer behaves.
    const msg = await sendConversationMessage(id, body.trim(), userId ?? 'agent', 'outbound');
    await dispatchOutboundMessage({
      workspaceId,
      conversationId: id,
      messageId: msg.id,
      toEmail: opts.toEmail,
      subject: opts.subject,
      body: body.trim(),
      htmlBody: opts.htmlBody,
      includeSignature: opts.includeSignature === true,
    });
    return msg;
  }

  // The exact inbox path: createMessage validates the channel has a
  // sender first and throws honestly when it does not (SMS without
  // Twilio, unknown channels) — before recording a message that was
  // never sent. Live-chat replies reach the visitor via realtime.
  return createInboxMessage(workspaceId, id, {
    senderType: 'agent',
    senderId: userId ?? null,
    content: body.trim(),
  });
}

export async function markUnifiedRead(
  workspaceId: string,
  source: UnifiedSource,
  id: string,
): Promise<void> {
  if (source === 'legacy') {
    await db.conversation.updateMany({
      where: { id, workspaceId },
      data: { unreadCount: 0 },
    });
    return;
  }
  await db.inboxConversation.updateMany({
    where: { id, workspaceId },
    data: { unreadCount: 0 },
  });
}

export async function getUnifiedUnread(workspaceId: string): Promise<number> {
  const [legacy, live] = await Promise.all([
    db.conversation.aggregate({ where: { workspaceId }, _sum: { unreadCount: true } }),
    db.inboxConversation.aggregate({ where: { workspaceId }, _sum: { unreadCount: true } }),
  ]);
  return (legacy._sum.unreadCount ?? 0) + (live._sum.unreadCount ?? 0);
}
