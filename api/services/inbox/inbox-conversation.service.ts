import { db } from '../../../infrastructure/database/client.js';
import { publishInboxEvent } from '../channels/realtime.service.js';
import { Prisma } from '@prisma/client';

export async function listConversations(workspaceId: string, filters: any) {
  const { status, assignedUserId, teamId, labelId, inboxChannelId, priority, q, page = 1, pageSize = 25 } = filters;

  const where: Prisma.InboxConversationWhereInput = { workspaceId };
  if (status && status !== 'all') where.status = status;
  if (assignedUserId === 'me' && filters.callerUserId) where.assignedUserId = filters.callerUserId;
  else if (assignedUserId === 'unassigned') where.assignedUserId = null;
  else if (assignedUserId) where.assignedUserId = assignedUserId;
  if (teamId) where.teamId = teamId;
  if (inboxChannelId) where.inboxChannelId = inboxChannelId;
  if (priority) where.priority = priority;
  if (labelId) {
    where.labels = { some: { labelId } };
  }
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: 'insensitive' } },
      { inboxContact: { name: { contains: q, mode: 'insensitive' } } },
      { inboxContact: { email: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [conversations, total] = await Promise.all([
    db.inboxConversation.findMany({
      where,
      include: {
        inboxChannel: { select: { id: true, name: true, channelType: true, avatarUrl: true, widgetColor: true } },
        inboxContact: true,
        labels: { include: { label: true } },
      },
      orderBy: { lastActivityAt: 'desc' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    }),
    db.inboxConversation.count({ where }),
  ]);

  return {
    conversations,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    hasMore: (Number(page) * Number(pageSize)) < total,
  };
}

export async function getConversation(workspaceId: string, id: string) {
  return db.inboxConversation.findFirst({
    where: { id, workspaceId },
    include: {
      inboxChannel: { select: { id: true, name: true, channelType: true, avatarUrl: true, widgetColor: true } },
      inboxContact: true,
      team: true,
      labels: { include: { label: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { mentions: true } },
    },
  });
}

export async function createConversation(workspaceId: string, data: { inboxChannelId: string; inboxContactId?: string; subject?: string }) {
  const result = await db.$transaction(async (tx: any) => {
    const seq = await tx.inboxDisplayIdSequence.upsert({
      where: { workspaceId },
      update: { lastId: { increment: 1 } },
      create: { workspaceId, lastId: 1 },
    });

    // Auto-assignment (Round Robin based on displayId)
    const channelAgents = await tx.inboxChannelAgent.findMany({
      where: { inboxChannelId: data.inboxChannelId },
      orderBy: { userId: 'asc' }
    });
    
    let assignedUserId = null;
    if (channelAgents.length > 0) {
      const index = seq.lastId % channelAgents.length;
      assignedUserId = channelAgents[index].userId;
    }

    return tx.inboxConversation.create({
      data: {
        workspaceId,
        displayId: seq.lastId,
        inboxChannelId: data.inboxChannelId,
        inboxContactId: data.inboxContactId,
        subject: data.subject,
        assignedUserId,
        lastActivityAt: new Date(),
      },
      include: {
        inboxChannel: { select: { id: true, name: true, channelType: true, avatarUrl: true, widgetColor: true } },
        inboxContact: true,
        labels: { include: { label: true } },
      }
    });
  });

  await publishInboxEvent(workspaceId, { type: 'conversation.created', workspaceId, conversationId: result.id, payload: result });
  return result;
}

export async function updateConversation(workspaceId: string, id: string, data: any) {
  if (data.status === 'resolved' && !data.resolvedAt) data.resolvedAt = new Date();
  if (data.status === 'open' && data.resolvedAt) data.resolvedAt = null;

  const result = await db.inboxConversation.update({
    where: { id, workspaceId },
    data,
    include: {
      inboxChannel: { select: { id: true, name: true, channelType: true, avatarUrl: true, widgetColor: true } },
      inboxContact: true,
      labels: { include: { label: true } },
    }
  });

  await publishInboxEvent(workspaceId, { type: 'conversation.updated', workspaceId, conversationId: id, payload: result });
  return result;
}

export async function deleteConversation(workspaceId: string, id: string) {
  await db.inboxConversation.delete({ where: { id, workspaceId } });
}

export async function addConversationLabel(workspaceId: string, conversationId: string, labelId: string) {
  const result = await db.inboxConversationLabel.create({
    data: { conversationId, labelId },
    include: { label: true }
  });
  await publishInboxEvent(workspaceId, { type: 'conversation.updated', workspaceId, conversationId, payload: { labelAdded: result } });
  return result;
}

export async function removeConversationLabel(workspaceId: string, conversationId: string, labelId: string) {
  await db.inboxConversationLabel.delete({
    where: { conversationId_labelId: { conversationId, labelId } }
  });
  await publishInboxEvent(workspaceId, { type: 'conversation.updated', workspaceId, conversationId, payload: { labelRemoved: labelId } });
}
