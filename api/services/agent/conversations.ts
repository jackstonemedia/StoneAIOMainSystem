// Phase 2 (AI Agent) — persisted chat conversations.
// The panel passes a conversationId after the first turn; without one,
// turns are stateless (the harness path) and nothing is persisted.
import type { PrismaClient } from '@prisma/client';

type Db = PrismaClient;

export async function getOrCreateConversation(
  database: Db,
  workspaceId: string,
  userId: string,
  conversationId?: string,
) {
  if (conversationId) {
    const existing = await database.agentConversation.findFirst({
      where: { id: conversationId, workspaceId },
    });
    if (existing) return existing;
    // Unknown or foreign id: never attach to it — start fresh instead.
  }
  return database.agentConversation.create({
    data: { workspaceId, userId },
  });
}

export async function appendMessage(
  database: Db,
  conversationId: string,
  role: 'user' | 'model',
  content: string,
): Promise<void> {
  if (!content.trim()) return;
  await database.agentConversationMessage.create({
    data: { conversationId, role, content },
  });
  await database.agentConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

export async function listConversations(database: Db, workspaceId: string, userId: string) {
  return database.agentConversation.findMany({
    where: { workspaceId, userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
  });
}

export async function getConversationHistory(
  database: Db,
  workspaceId: string,
  conversationId: string,
): Promise<{ role: string; content: string }[]> {
  const conv = await database.agentConversation.findFirst({
    where: { id: conversationId, workspaceId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!conv) return [];
  return conv.messages.map((m) => ({ role: m.role, content: m.content }));
}
