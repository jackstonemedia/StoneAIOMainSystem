/**
 * Assistant Repository — Stone AIO
 *
 * Single point of data access for all assistant tables.
 * Guarantees strict workspaceId and userId tenancy scoping.
 */

import { withTenant } from './rls.js';
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantToolCall,
  AssistantSettings,
  AssistantWorkspaceSettings,
  AssistantUsage,
} from '@prisma/client';

export interface ListConversationsOptions {
  cursor?: string;
  limit?: number;
  q?: string;
  projectId?: string;
}

export interface CreateConversationInput {
  title?: string;
  projectId?: string;
  mode?: string;
  thinking?: string;
}

export interface UpdateConversationInput {
  title?: string;
  projectId?: string | null;
  pinnedAt?: Date | null;
  mode?: string;
  thinking?: string;
}

export interface SaveUserMessageInput {
  content: string;
  parts?: Array<Record<string, unknown>>;
  model?: string;
}

export interface SaveAssistantMessageInput {
  parts: Array<Record<string, unknown>>;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  status?: string;
  thoughtSignatures?: Record<string, unknown>;
  searchableText?: string;
}

export class AssistantRepository {
  /**
   * List conversations for the authenticated user and workspace.
   */
  async listConversations(
    workspaceId: string,
    userId: string,
    options: ListConversationsOptions = {}
  ): Promise<{ items: AssistantConversation[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit || 30, 100);

    return await withTenant(workspaceId, async (tx) => {
      const where: Record<string, unknown> = {
        workspaceId,
        userId,
      };

      if (options.projectId) {
        where.projectId = options.projectId;
      }

      if (options.q && options.q.trim()) {
        where.OR = [
          { title: { contains: options.q.trim(), mode: 'insensitive' } },
          {
            messages: {
              some: {
                searchableText: { contains: options.q.trim(), mode: 'insensitive' },
              },
            },
          },
        ];
      }

      const items = await tx.assistantConversation.findMany({
        where,
        take: limit + 1,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        orderBy: [{ pinnedAt: 'desc' }, { updatedAt: 'desc' }],
      });

      let nextCursor: string | null = null;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem ? nextItem.id : null;
      }

      return { items, nextCursor };
    });
  }

  /**
   * Get a conversation with its messages, verifying workspace and user ownership.
   */
  async getConversation(
    workspaceId: string,
    userId: string,
    conversationId: string
  ): Promise<(AssistantConversation & { messages: AssistantMessage[] }) | null> {
    return await withTenant(workspaceId, async (tx) => {
      const convo = await tx.assistantConversation.findFirst({
        where: {
          id: conversationId,
          workspaceId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return convo as (AssistantConversation & { messages: AssistantMessage[] }) | null;
    });
  }

  /**
   * Create a new conversation.
   */
  async createConversation(
    workspaceId: string,
    userId: string,
    data: CreateConversationInput = {}
  ): Promise<AssistantConversation> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantConversation.create({
        data: {
          workspaceId,
          userId,
          title: data.title || 'New Conversation',
          projectId: data.projectId || null,
          mode: data.mode || 'unset',
          thinking: data.thinking || 'auto',
        },
      });
    });
  }

  /**
   * Update an existing conversation.
   */
  async updateConversation(
    workspaceId: string,
    userId: string,
    conversationId: string,
    data: UpdateConversationInput
  ): Promise<AssistantConversation | null> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantConversation.findFirst({
        where: { id: conversationId, workspaceId, userId },
      });
      if (!existing) return null;

      return await tx.assistantConversation.update({
        where: { id: conversationId },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
          ...(data.pinnedAt !== undefined ? { pinnedAt: data.pinnedAt } : {}),
          ...(data.mode !== undefined ? { mode: data.mode } : {}),
          ...(data.thinking !== undefined ? { thinking: data.thinking } : {}),
        },
      });
    });
  }

  /**
   * Delete a conversation and its messages permanently.
   */
  async deleteConversation(
    workspaceId: string,
    userId: string,
    conversationId: string
  ): Promise<boolean> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantConversation.findFirst({
        where: { id: conversationId, workspaceId, userId },
      });
      if (!existing) return false;

      await tx.assistantConversation.delete({
        where: { id: conversationId },
      });
      return true;
    });
  }

  /**
   * Save a user message to a conversation.
   */
  async saveUserMessage(
    workspaceId: string,
    userId: string,
    conversationId: string,
    data: SaveUserMessageInput
  ): Promise<AssistantMessage> {
    return await withTenant(workspaceId, async (tx) => {
      const convo = await tx.assistantConversation.findFirst({
        where: { id: conversationId, workspaceId, userId },
      });
      if (!convo) {
        throw new Error('Conversation not found or unauthorized');
      }

      const parts = data.parts || [{ type: 'text', text: data.content }];

      const message = await tx.assistantMessage.create({
        data: {
          workspaceId,
          userId,
          conversationId,
          role: 'user',
          parts: parts as any,
          searchableText: data.content,
          model: data.model || null,
        },
      });

      await tx.assistantConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return message;
    });
  }

  /**
   * Save an assistant response to a conversation.
   */
  async saveAssistantMessage(
    workspaceId: string,
    userId: string,
    conversationId: string,
    data: SaveAssistantMessageInput
  ): Promise<AssistantMessage> {
    return await withTenant(workspaceId, async (tx) => {
      const convo = await tx.assistantConversation.findFirst({
        where: { id: conversationId, workspaceId, userId },
      });
      if (!convo) {
        throw new Error('Conversation not found or unauthorized');
      }

      // Extract text content for searchable text
      const textParts = data.parts
        .filter((p) => p.type === 'text' && typeof p.text === 'string')
        .map((p) => p.text as string)
        .join(' ');

      const message = await tx.assistantMessage.create({
        data: {
          workspaceId,
          userId,
          conversationId,
          role: 'assistant',
          parts: data.parts as any,
          thoughtSignatures: (data.thoughtSignatures as any) || undefined,
          status: data.status || 'complete',
          model: data.model,
          inputTokens: data.inputTokens || 0,
          outputTokens: data.outputTokens || 0,
          searchableText: data.searchableText || textParts,
        },
      });

      await tx.assistantConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return message;
    });
  }

  /**
   * Save feedback on a message.
   */
  async updateMessageFeedback(
    workspaceId: string,
    userId: string,
    messageId: string,
    feedback: Record<string, unknown>
  ): Promise<AssistantMessage | null> {
    return await withTenant(workspaceId, async (tx) => {
      const msg = await tx.assistantMessage.findFirst({
        where: { id: messageId, workspaceId, userId },
      });
      if (!msg) return null;

      return await tx.assistantMessage.update({
        where: { id: messageId },
        data: { feedback: feedback as any },
      });
    });
  }

  /**
   * Truncate messages in a conversation after a given messageId (used for message edit).
   */
  async truncateMessagesAfter(
    workspaceId: string,
    userId: string,
    conversationId: string,
    messageId: string
  ): Promise<number> {
    return await withTenant(workspaceId, async (tx) => {
      const target = await tx.assistantMessage.findFirst({
        where: { id: messageId, conversationId, workspaceId, userId },
      });
      if (!target) return 0;

      const deleted = await tx.assistantMessage.deleteMany({
        where: {
          conversationId,
          workspaceId,
          createdAt: { gt: target.createdAt },
        },
      });

      return deleted.count;
    });
  }

  /**
   * Get the last assistant message in a conversation (used for regenerate).
   */
  async getLastAssistantMessage(
    workspaceId: string,
    userId: string,
    conversationId: string
  ): Promise<AssistantMessage | null> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantMessage.findFirst({
        where: {
          conversationId,
          workspaceId,
          userId,
          role: 'assistant',
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  /**
   * Delete the last assistant message (used before regenerate).
   */
  async deleteMessage(
    workspaceId: string,
    userId: string,
    messageId: string
  ): Promise<boolean> {
    return await withTenant(workspaceId, async (tx) => {
      const msg = await tx.assistantMessage.findFirst({
        where: { id: messageId, workspaceId, userId },
      });
      if (!msg) return false;

      await tx.assistantMessage.delete({ where: { id: messageId } });
      return true;
    });
  }

  /**
   * Get user settings, creating defaults if not yet present.
   */
  async getSettings(
    workspaceId: string,
    userId: string
  ): Promise<AssistantSettings> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantSettings.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      });
      if (existing) return existing;

      return await tx.assistantSettings.create({
        data: {
          workspaceId,
          userId,
          defaultMode: 'ask',
          thinking: 'auto',
          voice: 'default',
          speed: 1.0,
          memoryEnabled: true,
          pastChatSearch: true,
          notify: {},
        },
      });
    });
  }

  /**
   * Update user settings.
   */
  async updateSettings(
    workspaceId: string,
    userId: string,
    data: Partial<AssistantSettings>
  ): Promise<AssistantSettings> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantSettings.upsert({
        where: { workspaceId_userId: { workspaceId, userId } },
        create: {
          workspaceId,
          userId,
          defaultMode: data.defaultMode || 'ask',
          thinking: data.thinking || 'auto',
          voice: data.voice || 'default',
          speed: data.speed ?? 1.0,
          memoryEnabled: data.memoryEnabled ?? true,
          pastChatSearch: data.pastChatSearch ?? true,
          notify: (data.notify as any) || {},
        },
        update: {
          ...(data.defaultMode !== undefined ? { defaultMode: data.defaultMode } : {}),
          ...(data.thinking !== undefined ? { thinking: data.thinking } : {}),
          ...(data.voice !== undefined ? { voice: data.voice } : {}),
          ...(data.speed !== undefined ? { speed: data.speed } : {}),
          ...(data.memoryEnabled !== undefined ? { memoryEnabled: data.memoryEnabled } : {}),
          ...(data.pastChatSearch !== undefined ? { pastChatSearch: data.pastChatSearch } : {}),
          ...(data.notify !== undefined ? { notify: data.notify as any } : {}),
        },
      });
    });
  }

  /**
   * Get workspace settings, creating defaults if not yet present.
   */
  async getWorkspaceSettings(
    workspaceId: string
  ): Promise<AssistantWorkspaceSettings> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantWorkspaceSettings.findUnique({
        where: { workspaceId },
      });
      if (existing) return existing;

      return await tx.assistantWorkspaceSettings.create({
        data: {
          workspaceId,
          maxMode: 'full',
          fullAutonomyRoles: ['owner', 'admin'],
          requireApprovalFor: {},
          bulkThreshold: 25,
          dailyLimits: {},
          enabled: true,
        },
      });
    });
  }

  /**
   * Update workspace settings (admin/owner only).
   */
  async updateWorkspaceSettings(
    workspaceId: string,
    data: Partial<AssistantWorkspaceSettings>
  ): Promise<AssistantWorkspaceSettings> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantWorkspaceSettings.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          maxMode: data.maxMode || 'full',
          fullAutonomyRoles: (data.fullAutonomyRoles as any) || ['owner', 'admin'],
          requireApprovalFor: (data.requireApprovalFor as any) || {},
          bulkThreshold: data.bulkThreshold ?? 25,
          dailyLimits: (data.dailyLimits as any) || {},
          enabled: data.enabled ?? true,
        },
        update: {
          ...(data.maxMode !== undefined ? { maxMode: data.maxMode } : {}),
          ...(data.fullAutonomyRoles !== undefined ? { fullAutonomyRoles: data.fullAutonomyRoles as any } : {}),
          ...(data.requireApprovalFor !== undefined ? { requireApprovalFor: data.requireApprovalFor as any } : {}),
          ...(data.bulkThreshold !== undefined ? { bulkThreshold: data.bulkThreshold } : {}),
          ...(data.dailyLimits !== undefined ? { dailyLimits: data.dailyLimits as any } : {}),
          ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        },
      });
    });
  }

  /**
   * Record usage counters for a user today.
   */
  async incrementUsage(
    workspaceId: string,
    userId: string,
    usage: {
      messages?: number;
      searches?: number;
      researchRuns?: number;
      images?: number;
      tokens?: number;
    }
  ): Promise<AssistantUsage> {
    const today = new Date().toISOString().slice(0, 10);

    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantUsage.upsert({
        where: {
          workspaceId_userId_day: {
            workspaceId,
            userId,
            day: today,
          },
        },
        create: {
          workspaceId,
          userId,
          day: today,
          messages: usage.messages || 0,
          searches: usage.searches || 0,
          researchRuns: usage.researchRuns || 0,
          images: usage.images || 0,
          tokens: usage.tokens || 0,
        },
        update: {
          ...(usage.messages ? { messages: { increment: usage.messages } } : {}),
          ...(usage.searches ? { searches: { increment: usage.searches } } : {}),
          ...(usage.researchRuns ? { researchRuns: { increment: usage.researchRuns } } : {}),
          ...(usage.images ? { images: { increment: usage.images } } : {}),
          ...(usage.tokens ? { tokens: { increment: usage.tokens } } : {}),
        },
      });
    });
  }

  /**
   * Get user's daily usage counters for today.
   */
  async getDailyUsage(
    workspaceId: string,
    userId: string,
    day?: string
  ): Promise<AssistantUsage | null> {
    const dateStr = day || new Date().toISOString().slice(0, 10);

    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantUsage.findUnique({
        where: {
          workspaceId_userId_day: {
            workspaceId,
            userId,
            day: dateStr,
          },
        },
      });
    });
  }

  /**
   * Create a tool call record.
   */
  async createToolCall(
    workspaceId: string,
    userId: string,
    data: {
      conversationId?: string;
      messageId?: string;
      taskRunId?: string;
      source?: string;
      toolName: string;
      risk: string;
      args: Record<string, unknown>;
      status?: string;
      result?: unknown;
      error?: string;
    }
  ): Promise<AssistantToolCall> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantToolCall.create({
        data: {
          workspaceId,
          userId,
          conversationId: data.conversationId,
          messageId: data.messageId,
          taskRunId: data.taskRunId,
          source: data.source || 'chat',
          toolName: data.toolName,
          risk: data.risk,
          args: data.args as any,
          status: data.status || 'pending',
          result: data.result ? (data.result as any) : undefined,
          error: data.error,
        },
      });
    });
  }

  /**
   * Update a tool call record (status, result, error, approval).
   */
  async updateToolCall(
    workspaceId: string,
    id: string,
    data: {
      status?: string;
      result?: unknown;
      error?: string;
      approvedByUserId?: string;
      decidedAt?: Date;
      executedAt?: Date;
    }
  ): Promise<AssistantToolCall> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantToolCall.findFirst({
        where: { id, workspaceId },
      });

      if (!existing) {
        throw new Error(`Tool call ${id} not found in workspace.`);
      }

      return await tx.assistantToolCall.update({
        where: { id },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.result !== undefined ? { result: data.result as any } : {}),
          ...(data.error !== undefined ? { error: data.error } : {}),
          ...(data.approvedByUserId !== undefined ? { approvedByUserId: data.approvedByUserId } : {}),
          ...(data.decidedAt !== undefined ? { decidedAt: data.decidedAt } : {}),
          ...(data.executedAt !== undefined ? { executedAt: data.executedAt } : {}),
        },
      });
    });
  }

  /**
   * Atomically claims a tool call for execution if it is in 'pending' status.
   * Prevents race conditions and double-execution on concurrent approvals.
   */
  async claimToolCall(
    workspaceId: string,
    id: string,
    approvedByUserId: string
  ): Promise<boolean> {
    return await withTenant(workspaceId, async (tx) => {
      const res = await tx.assistantToolCall.updateMany({
        where: {
          id,
          workspaceId,
          status: 'pending',
        },
        data: {
          status: 'running',
          approvedByUserId,
        },
      });
      return res.count > 0;
    });
  }

  /**
   * Retrieve a tool call by ID (scoped to workspace).
   */
  async getToolCall(workspaceId: string, id: string): Promise<AssistantToolCall | null> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantToolCall.findFirst({
        where: { id, workspaceId },
      });
    });
  }

  /**
   * List tool calls for a workspace (approvals or audit log).
   */
  async listToolCalls(
    workspaceId: string,
    options: {
      userId?: string;
      conversationId?: string;
      status?: string;
      limit?: number;
    } = {}
  ): Promise<AssistantToolCall[]> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantToolCall.findMany({
        where: {
          workspaceId,
          ...(options.userId ? { userId: options.userId } : {}),
          ...(options.conversationId ? { conversationId: options.conversationId } : {}),
          ...(options.status ? { status: options.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
      });
    });
  }
}

export const assistantRepo = new AssistantRepository();
